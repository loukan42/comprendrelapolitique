/**
 * Charge une législature dans une base PostgreSQL locale et contrôle le
 * résultat.
 *
 * Usage :
 *   node scripts/import/charger.ts <législature> <dir_archives> [--db chemin]
 *
 * `dir_archives` contient les archives décompressées, une par jeu :
 *   <dir>/scrutins/json/            VTANR*.json
 *   <dir>/dossiers/json/            dossierParlementaire/ et document/
 *   <dir>/acteurs/json/             acteur/ et organe/
 *
 * Sans `--db`, la base est en mémoire : utile pour vérifier l'import sans rien
 * installer, inutile pour conserver le résultat.
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { appliquerMigration, fermerLot, ouvrirLot, ouvrirPGlite, type Db } from "./db.ts";
import {
  importerActeurs,
  importerDossiers,
  importerScrutins,
  rattacherScrutins,
} from "./importer.ts";
import { LEGISLATURES } from "./sources.ts";

const MIGRATION = resolve("db/migrations/001_officiel.sql");

function chrono(): () => string {
  const t0 = Date.now();
  return () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
}

async function semerLegislatures(db: Db): Promise<void> {
  for (const l of LEGISLATURES) {
    await db.query(
      `INSERT INTO officiel.legislature (id, date_debut, date_fin, archivee)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [l.id, l.dateDebut, l.dateFin, l.archivee],
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const legislature = Number.parseInt(args[0] ?? "", 10);
  const racine = args[1];
  const iDb = args.indexOf("--db");
  const cheminDb = iDb >= 0 ? args[iDb + 1] : undefined;

  if (!legislature || !racine) {
    console.error("usage: charger.ts <législature> <dir_archives> [--db chemin]");
    process.exit(1);
  }

  const dirs = {
    acteurs: join(racine, "acteurs", "json"),
    dossiers: join(racine, "dossiers", "json"),
    scrutins: join(racine, "scrutins", "json"),
  };
  for (const [nom, d] of Object.entries(dirs)) {
    if (!existsSync(d)) {
      console.error(`Répertoire introuvable pour le jeu « ${nom} » : ${d}`);
      process.exit(1);
    }
  }

  const t = chrono();
  const db = await ouvrirPGlite(cheminDb);
  await appliquerMigration(db, MIGRATION);
  await semerLegislatures(db);
  console.log(`Schéma appliqué (${t()})`);

  // L'ordre est imposé par les clés étrangères : organes avant acteurs, acteurs
  // avant mandats, dossiers avant documents et actes, scrutins en dernier.
  const lotActeurs = await ouvrirLot(db, {
    jeu: "acteurs",
    legislature,
    url: `local:${dirs.acteurs}`,
    sha256: "local",
  });
  const a = await importerActeurs(db, dirs.acteurs, lotActeurs, legislature);
  await fermerLot(db, lotActeurs, { inserees: a.organes + a.acteurs + a.mandats });
  console.log(
    `Acteurs  : ${a.organes} organes, ${a.acteurs} acteurs, ${a.mandats} mandats (${t()})`,
  );

  const lotDossiers = await ouvrirLot(db, {
    jeu: "dossiers",
    legislature,
    url: `local:${dirs.dossiers}`,
    sha256: "local",
  });
  const d = await importerDossiers(db, dirs.dossiers, lotDossiers, legislature);
  await fermerLot(db, lotDossiers, { inserees: d.dossiers + d.documents + d.actes });
  console.log(
    `Dossiers : ${d.dossiers} dossiers, ${d.documents} documents, ${d.actes} actes, ` +
      `${d.voteRefs} références de vote (${t()})`,
  );

  const lotScrutins = await ouvrirLot(db, {
    jeu: "scrutins",
    legislature,
    url: `local:${dirs.scrutins}`,
    sha256: "local",
  });
  const s = await importerScrutins(db, dirs.scrutins, lotScrutins);
  await fermerLot(db, lotScrutins, { inserees: s.scrutins + s.groupes + s.votes });
  console.log(
    `Scrutins : ${s.scrutins} scrutins, ${s.groupes} blocs de groupe, ` +
      `${s.votes} votes individuels (${t()})`,
  );
  console.log(`           dont ${s.ecarts} blocs où le nominatif ne correspond pas aux décomptes`);

  const r = await rattacherScrutins(db, lotScrutins);
  console.log(
    `Rattachement : ${r.concordants} concordants, ${r.conflits} conflits, ` +
      `${r.officiel_seul} officiels seuls, ${r.reconstruit_seul} reconstruits seuls (${t()})`,
  );

  if (cheminDb) console.log(`\nBase persistée dans ${cheminDb}`);
  else console.log("\nBase en mémoire : rien n'a été conservé.");

  await db.close();
}

try {
  await main();
} catch (e) {
  // PGlite deverse l'integralite de son bundle dans la trace : on ne garde que
  // le message et le detail, qui sont les seules informations utiles.
  const err = e as { message?: string; detail?: string; constraint?: string };
  console.error(`
Echec de l'import : ${err.message ?? e}`);
  if (err.detail) console.error(`  ${err.detail}`);
  if (err.constraint) console.error(`  contrainte : ${err.constraint}`);
  process.exit(1);
}
