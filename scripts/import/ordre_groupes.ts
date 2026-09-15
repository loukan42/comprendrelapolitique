/**
 * Placement gauche-droite des groupes parlementaires, pour l'hémicycle.
 *
 * Usage :
 *   node scripts/import/ordre_groupes.ts --db data/pg16
 *   node scripts/import/ordre_groupes.ts --db data/pg16 --verifier
 *
 * `--verifier` n'écrit rien : il imprime l'ordre obtenu, législature par
 * législature, de la gauche vers la droite. C'est le contrôle qui compte, et
 * il se fait à l'œil : un groupe mal placé se voit immédiatement dans la
 * liste, alors qu'il est invisible sur le dessin final.
 *
 * Pourquoi ce fichier existe : voir db/migrations/005_groupe_ordre.sql. La
 * source ne publie pas d'axe gauche-droite, seulement un rapport au
 * gouvernement (« Majoritaire », « Opposition »), vide pour la XVIIe.
 *
 * Ce que ce placement est, et n'est pas. Il suit l'ordre conventionnel des
 * bancs de l'Assemblée, celui qu'emploient les comptes rendus et les
 * représentations de presse. Il ne prétend pas mesurer une distance
 * idéologique : entre deux groupes voisins, l'écart de rang ne veut rien
 * dire, seul l'ordre compte. Les cas discutables sont signalés dans leur
 * motif plutôt que lissés.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirBase, type Db } from "./db.ts";

interface Placement {
  uid: string;
  rang: number;
  motif: string;
}

/**
 * Les non-inscrits ne sont pas placés sur l'axe : ce n'est pas un groupe
 * politique mais l'absence de groupe, et ses membres viennent de toutes les
 * familles. Leur donner une place sur l'axe affirmerait une orientation
 * commune qui n'existe pas. Ils sont donc rangés en fin d'arc, et la légende
 * de l'hémicycle le dit.
 */
const RANG_NON_INSCRITS = 9000;

const PLACEMENTS: Placement[] = [
  // ----- XVe législature (2017-2022) -----
  { uid: "PO730958", rang: 1010, motif: "XVe, La France insoumise, gauche de l'hémicycle." },
  {
    uid: "PO730940",
    rang: 1020,
    motif: "XVe, Gauche démocrate et républicaine, groupe à dominante communiste.",
  },
  {
    uid: "PO771789",
    rang: 1030,
    motif: "XVe, Écologie Démocratie Solidarité, groupe écologiste issu de la majorité en 2020.",
  },
  {
    uid: "PO730946",
    rang: 1040,
    motif: "XVe, Nouvelle Gauche, groupe socialiste avant son changement de nom.",
  },
  { uid: "PO758835", rang: 1041, motif: "XVe, Socialistes et apparentés." },
  {
    uid: "PO759900",
    rang: 1055,
    motif:
      "XVe, Libertés et Territoires. Placement discutable : groupe composite, à dominante régionaliste et radicale, sans ligne gauche-droite homogène. Placé au centre faute de mieux.",
  },
  {
    uid: "PO730964",
    rang: 1060,
    motif: "XVe, La République en Marche, majorité présidentielle, centre.",
  },
  { uid: "PO730970", rang: 1065, motif: "XVe, Mouvement Démocrate et apparentés, centre." },
  { uid: "PO774834", rang: 1066, motif: "XVe, MoDem et Démocrates apparentés, même famille." },
  {
    uid: "PO771923",
    rang: 1070,
    motif: "XVe, Agir ensemble, centre-droit issu de la majorité.",
  },
  { uid: "PO767217", rang: 1074, motif: "XVe, UDI, Agir et Indépendants, centre-droit." },
  { uid: "PO744425", rang: 1075, motif: "XVe, UDI, Agir et Indépendants, second organe." },
  { uid: "PO771889", rang: 1076, motif: "XVe, UDI et Indépendants, centre-droit." },
  { uid: "PO765636", rang: 1077, motif: "XVe, UDI et Indépendants, second organe." },
  {
    uid: "PO730952",
    rang: 1078,
    motif: "XVe, Les Constructifs : républicains, UDI, indépendants, droite modérée.",
  },
  { uid: "PO730934", rang: 1080, motif: "XVe, Les Républicains, droite." },
  { uid: "PO723569", rang: RANG_NON_INSCRITS + 15, motif: "XVe, non-inscrits, hors axe." },

  // ----- XVIe législature (2022-2024) -----
  { uid: "PO800490", rang: 2010, motif: "XVIe, La France insoumise - NUPES." },
  { uid: "PO800502", rang: 2020, motif: "XVIe, Gauche démocrate et républicaine - NUPES." },
  { uid: "PO800526", rang: 2030, motif: "XVIe, Écologiste - NUPES." },
  {
    uid: "PO800496",
    rang: 2040,
    motif: "XVIe, Socialistes et apparentés, membre de l'intergroupe NUPES.",
  },
  { uid: "PO830170", rang: 2041, motif: "XVIe, Socialistes et apparentés, après la NUPES." },
  {
    uid: "PO800532",
    rang: 2055,
    motif:
      "XVIe, LIOT. Même réserve qu'en XVe pour Libertés et Territoires : groupe composite, placé au centre sans que cela résume une ligne.",
  },
  { uid: "PO800538", rang: 2060, motif: "XVIe, Renaissance, majorité présidentielle, centre." },
  { uid: "PO800484", rang: 2065, motif: "XVIe, Démocrate (MoDem et Indépendants), centre." },
  { uid: "PO800514", rang: 2070, motif: "XVIe, Horizons et apparentés, centre-droit." },
  { uid: "PO800508", rang: 2080, motif: "XVIe, Les Républicains, droite." },
  { uid: "PO800520", rang: 2100, motif: "XVIe, Rassemblement National, droite de l'hémicycle." },
  { uid: "PO793087", rang: RANG_NON_INSCRITS + 16, motif: "XVIe, non-inscrits, hors axe." },

  // ----- XVIIe législature (depuis 2024) -----
  { uid: "PO845413", rang: 3010, motif: "XVIIe, La France insoumise - Nouveau Front Populaire." },
  { uid: "PO845514", rang: 3020, motif: "XVIIe, Gauche Démocrate et Républicaine." },
  { uid: "PO845439", rang: 3030, motif: "XVIIe, Écologiste et Social." },
  { uid: "PO845419", rang: 3040, motif: "XVIIe, Socialistes et apparentés." },
  {
    uid: "PO845485",
    rang: 3055,
    motif:
      "XVIIe, LIOT, groupe composite placé au centre, même réserve que pour les législatures précédentes.",
  },
  { uid: "PO845407", rang: 3060, motif: "XVIIe, Ensemble pour la République, centre." },
  { uid: "PO845454", rang: 3065, motif: "XVIIe, Les Démocrates, centre." },
  { uid: "PO845470", rang: 3070, motif: "XVIIe, Horizons & Indépendants, centre-droit." },
  { uid: "PO845425", rang: 3080, motif: "XVIIe, Droite Républicaine, droite." },
  {
    uid: "PO847173",
    rang: 3090,
    motif: "XVIIe, UDR, droite issue d'une scission des Républicains, placée entre DR et RN.",
  },
  {
    uid: "PO872880",
    rang: 3091,
    motif: "XVIIe, Union des droites pour la République, même groupe renommé.",
  },
  {
    uid: "PO845520",
    rang: 3092,
    motif: "XVIIe, À Droite, scission tardive rattachée à la même zone que l'UDR.",
  },
  { uid: "PO845401", rang: 3100, motif: "XVIIe, Rassemblement National, droite de l'hémicycle." },
  { uid: "PO840056", rang: RANG_NON_INSCRITS + 17, motif: "XVIIe, non-inscrits, hors axe." },
];

const MIGRATION = resolve("db/migrations/005_groupe_ordre.sql");

async function verifier(db: Db): Promise<void> {
  const lignes = await db.query<{
    legislature: number | null;
    libelle: string;
    abrege: string | null;
    uid: string;
  }>(`SELECT legislature, libelle, libelle_abrege AS abrege, uid
        FROM officiel.organe WHERE code_type = 'GP'`);
  const parUid = new Map(lignes.map((l) => [l.uid, l]));

  const places = new Set(PLACEMENTS.map((p) => p.uid));
  const manquants = lignes.filter((l) => !places.has(l.uid));

  for (const legislature of [15, 16, 17]) {
    console.log(`\n## ${legislature}e législature, de la gauche vers la droite`);
    const dedans = PLACEMENTS.filter((p) => parUid.get(p.uid)?.legislature === legislature).sort(
      (a, b) => a.rang - b.rang,
    );
    for (const p of dedans) {
      const o = parUid.get(p.uid)!;
      const hors = p.rang >= RANG_NON_INSCRITS ? " (hors axe)" : "";
      console.log(
        `   ${String(p.rang).padStart(5)} ${String(o.abrege ?? "").padEnd(14)} ${o.libelle.slice(0, 45)}${hors}`,
      );
    }
  }

  if (manquants.length > 0) {
    console.log(`\n!! ${manquants.length} groupes sans placement :`);
    for (const m of manquants) console.log(`   L${m.legislature} ${m.abrege} ${m.uid}`);
  } else {
    console.log("\nTous les groupes parlementaires ont un placement.");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: ordre_groupes.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db = await ouvrirBase(chemin);

  if (args.includes("--verifier")) {
    await verifier(db);
    await db.close();
    return;
  }

  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'groupe_ordre') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 005 appliquée");
  }

  await db.query(`DELETE FROM enrichissement.groupe_ordre`);
  let n = 0;
  for (const p of PLACEMENTS) {
    const connu = await db.query<{ uid: string }>(
      `SELECT uid FROM officiel.organe WHERE uid = $1 AND code_type = 'GP'`,
      [p.uid],
    );
    if (connu.length === 0) {
      console.error(`Groupe inconnu, placement ignoré : ${p.uid}`);
      continue;
    }
    await db.query(
      `INSERT INTO enrichissement.groupe_ordre (organe_uid, rang, motif) VALUES ($1, $2, $3)`,
      [p.uid, p.rang, p.motif],
    );
    n += 1;
  }

  const [total] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM officiel.organe WHERE code_type = 'GP'`,
  );
  console.log(`${n} groupes placés sur ${total?.n ?? 0}`);
  await db.close();
}

await main();
