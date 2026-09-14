/**
 * Charge une législature dans une base PostgreSQL locale et contrôle le
 * résultat.
 *
 * Usage :
 *   node scripts/import/charger.ts <législature> <dir_archives> [--db chemin] [--amendements dir] [--debats dir]
 *
 * `dir_archives` contient les archives décompressées, une par jeu :
 *   <dir>/scrutins/json/            VTANR*.json
 *   <dir>/dossiers/json/            dossierParlementaire/ et document/
 *   <dir>/acteurs/json/             acteur/ et organe/
 *
 * Les amendements sont hors MVP (347 Mo pour la seule XVIe) et ne sont chargés
 * que si `<dir_archives>/amendements/json/` existe ou qu'un chemin est fourni
 * explicitement via `--amendements`. Ce jeu range ses fichiers sur deux
 * niveaux de répertoires, `json/<dossier>/<document>/*.json`, contrairement
 * aux autres (voir docs/DATA_SOURCES.md section 7 bis).
 *
 * Les débats (comptes rendus XML) sont hors MVP eux aussi et ne sont chargés
 * que si `<dir_archives>/debats/xml/compteRendu/` existe ou qu'un chemin est
 * fourni via `--debats`. Seule la XVIe a été inspectée à ce stade (voir
 * docs/DATA_SOURCES.md section 7 ter).
 *
 * Sans `--db`, la base est en mémoire : utile pour vérifier l'import sans rien
 * installer, inutile pour conserver le résultat.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { appliquerMigration, fermerLot, ouvrirLot, ouvrirPGlite, type Db } from "./db.ts";
import {
  importerActeurs,
  importerAmendements,
  importerDebats,
  importerDossiers,
  importerScrutins,
  rattacherScrutins,
} from "./importer.ts";
import { LEGISLATURES } from "./sources.ts";

const MIGRATION = resolve("db/migrations/001_officiel.sql");

/**
 * Métadonnées de l'archive d'un jeu, écrites par `telecharger.ts` dans
 * `<dossier parent>/_archives/<législature>-<jeu>.json` : URL officielle,
 * date `Last-Modified` servie par l'Assemblée, taille et empreinte.
 *
 * Sans elles, un lot ne portait que `local:<dossier>` et aucune date, et le
 * site ne pouvait pas dire de quand datent ses données. Une archive récupérée
 * autrement que par `telecharger.ts` n'a pas ce fichier : le lot reste alors
 * marqué local, sans date inventée.
 */
function metadonneesArchive(
  dirArchives: string,
  legislature: number,
  jeu: string,
): {
  url: string;
  lastModified: string | null;
  tailleOctets: number | null;
  sha256: string;
} | null {
  const chemin = resolve(dirArchives, "..", "_archives", `${legislature}-${jeu}.json`);
  if (!existsSync(chemin)) return null;
  try {
    const m = JSON.parse(readFileSync(chemin, "utf8")) as {
      url?: string;
      lastModified?: string | null;
      tailleOctets?: number | null;
      sha256?: string;
    };
    if (!m.url || !m.sha256) return null;
    return {
      url: m.url,
      lastModified: m.lastModified ? new Date(m.lastModified).toISOString() : null,
      tailleOctets: m.tailleOctets ?? null,
      sha256: m.sha256,
    };
  } catch {
    return null;
  }
}

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
  const iAmendements = args.indexOf("--amendements");
  // Les amendements ne font pas partie du MVP (95 % du volume, voir
  // docs/DATA_SOURCES.md section 1.2) : le répertoire par défaut n'est chargé
  // que s'il existe, et un chemin explicite reste possible pour une archive
  // rangée ailleurs que sous <dir_archives>/amendements/json.
  const dirAmendementsExplicite = iAmendements >= 0 ? args[iAmendements + 1] : undefined;
  const iDebats = args.indexOf("--debats");
  const dirDebatsExplicite = iDebats >= 0 ? args[iDebats + 1] : undefined;

  if (!legislature || !racine) {
    console.error(
      "usage: charger.ts <législature> <dir_archives> [--db chemin] [--amendements dir] [--debats dir]",
    );
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

  const dirAmendements = dirAmendementsExplicite ?? join(racine, "amendements", "json");
  const chargerAmendements = existsSync(dirAmendements);
  if (dirAmendementsExplicite && !chargerAmendements) {
    console.error(`Répertoire d'amendements introuvable : ${dirAmendements}`);
    process.exit(1);
  }

  const dirDebats = dirDebatsExplicite ?? join(racine, "debats", "xml", "compteRendu");
  const chargerDebats = existsSync(dirDebats);
  if (dirDebatsExplicite && !chargerDebats) {
    console.error(`Répertoire de débats introuvable : ${dirDebats}`);
    process.exit(1);
  }

  const t = chrono();
  const db = await ouvrirPGlite(cheminDb);
  // La migration est idempotente : elle se rejoue sur une base déjà chargée
  // sans rien dupliquer, et c'est ce qui met à niveau une base créée avant une
  // évolution du schéma. La réserver aux bases vierges laissait les anciennes
  // sans les tables et colonnes ajoutées depuis (débats, couleur des organes),
  // et les pages qui les lisent répondaient 500.
  await appliquerMigration(db, MIGRATION);
  console.log(`Schéma appliqué ou mis à niveau (${t()})`);
  await semerLegislatures(db);

  // L'ordre est imposé par les clés étrangères : organes avant acteurs, acteurs
  // avant mandats, dossiers avant documents et actes, scrutins en dernier.
  const lotActeurs = await ouvrirLot(db, {
    jeu: "acteurs",
    legislature,
    url: `local:${dirs.acteurs}`,
    sha256: "local",
    ...metadonneesArchive(dirArchives, legislature, "acteurs"),
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
    ...metadonneesArchive(dirArchives, legislature, "dossiers"),
  });
  const d = await importerDossiers(db, dirs.dossiers, lotDossiers, legislature);
  await fermerLot(db, lotDossiers, { inserees: d.dossiers + d.documents + d.actes });
  console.log(
    `Dossiers : ${d.dossiers} dossiers, ${d.documents} documents, ${d.actes} actes, ` +
      `${d.voteRefs} références de vote (${t()})`,
  );

  if (chargerAmendements) {
    const lotAmendements = await ouvrirLot(db, {
      jeu: "amendements",
      legislature,
      url: `local:${dirAmendements}`,
      sha256: "local",
      ...metadonneesArchive(dirArchives, legislature, "amendements"),
    });
    const am = await importerAmendements(db, dirAmendements, lotAmendements, legislature);
    await fermerLot(db, lotAmendements, { inserees: am.amendements + am.cosignataires });
    console.log(
      `Amendements : ${am.amendements} amendements, ${am.cosignataires} liens de cosignature (${t()})`,
    );
  }

  const lotScrutins = await ouvrirLot(db, {
    jeu: "scrutins",
    legislature,
    url: `local:${dirs.scrutins}`,
    sha256: "local",
    ...metadonneesArchive(dirArchives, legislature, "scrutins"),
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

  if (chargerDebats) {
    const lotDebats = await ouvrirLot(db, {
      jeu: "debats",
      legislature,
      url: `local:${dirDebats}`,
      sha256: "local",
      ...metadonneesArchive(dirArchives, legislature, "debats"),
    });
    const deb = await importerDebats(db, dirDebats, lotDebats, legislature);
    await fermerLot(db, lotDebats, {
      inserees: deb.seances + deb.points + deb.interventions + deb.orateurs,
    });
    console.log(
      `Débats : ${deb.seances} séances, ${deb.points} points de sommaire, ` +
        `${deb.interventions} interventions, ${deb.orateurs} liens orateur (${t()})`,
    );
  }

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
