/**
 * Contrôles sur une base chargée.
 *
 * Un import qui se termine sans erreur n'est pas un import correct. Ce script
 * interroge la base sur des faits dont la réponse est connue par ailleurs :
 * des chiffres mesurés sur les fichiers bruts, et des événements politiques
 * vérifiables. Un écart signale une régression de l'importeur, pas une
 * curiosité.
 *
 * Usage :
 *   node scripts/import/charger.ts 16 <dir> --db <chemin>
 *   node scripts/import/controler.ts <chemin>
 */

import { ouvrirPGlite, type Db } from "./db.ts";

let echecs = 0;

function verifier(intitule: string, obtenu: unknown, attendu: unknown): void {
  const ok = String(obtenu) === String(attendu);
  if (!ok) echecs++;
  console.log(`  ${ok ? "OK  " : "ECHEC"}  ${intitule}`);
  if (!ok) console.log(`          attendu ${attendu}, obtenu ${obtenu}`);
}

function afficher(intitule: string, valeur: unknown): void {
  console.log(`         ${intitule} : ${valeur}`);
}

async function un<T>(db: Db, sql: string, params: unknown[] = []): Promise<T | undefined> {
  const r = await db.query<Record<string, T>>(sql, params);
  return r[0] ? (Object.values(r[0])[0] as T) : undefined;
}

async function main() {
  const chemin = process.argv[2];
  if (!chemin) {
    console.error("usage: controler.ts <chemin_base>");
    process.exit(1);
  }
  const db = await ouvrirPGlite(chemin);

  console.log("\n=== Volumes, comparés aux mesures sur les fichiers bruts ===");
  verifier("scrutins", await un(db, "SELECT count(*) FROM officiel.scrutin"), 4106);
  verifier("votes individuels", await un(db, "SELECT count(*) FROM officiel.vote"), 602911);
  verifier(
    "blocs groupe-scrutin",
    await un(db, "SELECT count(*) FROM officiel.scrutin_groupe"),
    45175,
  );
  verifier(
    "votes sur l'ensemble",
    await un(db, "SELECT count(*) FROM officiel.scrutin WHERE est_vote_sur_ensemble"),
    209,
  );
  // 24 blocs, et non 39 : l'exploration comptait les categories divergentes
  // (un bloc peut diverger sur plusieurs), l'import compte les blocs.
  verifier(
    "blocs où le nominatif diverge des décomptes",
    await un(db, "SELECT count(*) FROM officiel.scrutin_groupe WHERE NOT nominatif_complet"),
    24,
  );

  console.log("\n=== Règles non négociables (AGENTS.md section 5) ===");
  verifier(
    "aucune position ABSENT : l'absence n'est pas une donnée",
    await un(db, "SELECT count(*) FROM officiel.vote WHERE position::text = 'ABSENT'"),
    0,
  );
  verifier(
    "aucun acteur ne vote deux fois dans un même scrutin",
    await un(
      db,
      `SELECT count(*) FROM (
         SELECT scrutin_uid, acteur_uid FROM officiel.vote
         GROUP BY 1, 2 HAVING count(*) > 1) d`,
    ),
    0,
  );
  verifier(
    "aucun conflit de rattachement ne retient de dossier",
    await un(
      db,
      "SELECT count(*) FROM officiel.scrutin_dossier WHERE methode = 'CONFLIT' AND dossier_uid IS NOT NULL",
    ),
    0,
  );

  console.log("\n=== Intégrité référentielle après import ===");
  afficher(
    "votes renvoyant à un acteur absent",
    await un(
      db,
      `SELECT count(*) FROM officiel.vote v
        LEFT JOIN officiel.acteur a ON a.uid = v.acteur_uid WHERE a.uid IS NULL`,
    ),
  );
  afficher(
    "votes renvoyant à un organe absent",
    await un(
      db,
      `SELECT count(*) FROM officiel.vote v
        LEFT JOIN officiel.organe o ON o.uid = v.organe_uid WHERE o.uid IS NULL`,
    ),
  );
  afficher(
    "documents renvoyant à un dossier absent",
    await un(
      db,
      `SELECT count(*) FROM officiel.document d
        LEFT JOIN officiel.dossier o ON o.uid = d.dossier_uid
        WHERE d.dossier_uid IS NOT NULL AND o.uid IS NULL`,
    ),
  );

  console.log("\n=== Vote par délégation ===");
  const rDeleg = await db.query<{ n: string; pct: string }>(
    `SELECT count(*) FILTER (WHERE par_delegation) AS n,
            round(100.0 * count(*) FILTER (WHERE par_delegation) / count(*), 1) AS pct
       FROM officiel.vote`,
  );
  afficher("votes exprimés par délégation", `${rDeleg[0]?.n} (${rDeleg[0]?.pct} %)`);

  console.log("\n=== Motions de censure du 20 mars 2023 ===");
  const moc = await db.query<{
    uid: string;
    nombre_votants: number;
    suffrages_requis: number;
    sort_code: string;
  }>(
    `SELECT uid, nombre_votants, suffrages_requis, sort_code
       FROM officiel.motion_de_censure
      WHERE date_scrutin = DATE '2023-03-20' ORDER BY uid`,
  );
  verifier("deux motions ce jour-là", moc.length, 2);
  for (const m of moc) {
    afficher(
      m.uid,
      `${m.nombre_votants} voix pour, ${m.suffrages_requis} requises → ${m.sort_code}`,
    );
  }
  // La motion Pancher a manqué de neuf voix : fait vérifiable hors de la base.
  const pancher = moc.find((m) => m.nombre_votants === 278);
  verifier("motion à 278 voix pour 287 requises", pancher?.suffrages_requis, 287);

  console.log("\n=== Réforme des retraites 2023 : adoptée sans vote ===");
  const dossierPlfrss = "DLR5L16N47066";
  // Le dossier de la loi ne porte PAS de code AN21 : le 49.3 vit dans un
  // dossier distinct, « Engagement de la responsabilite du Gouvernement sur... ».
  // Les deux se relient par les actes qu'ils partagent, et par rien d'autre.
  verifier(
    "reconnu comme adopté sans vote",
    await un(db, "SELECT count(*) FROM officiel.dossier_adopte_sans_vote WHERE dossier_uid = $1", [
      dossierPlfrss,
    ]),
    1,
  );
  verifier(
    "relié à son dossier d'engagement de responsabilité",
    await un(
      db,
      `SELECT count(*) FROM officiel.dossier_lie_par_acte l
        JOIN officiel.dossier_49_3 e ON e.dossier_uid = l.dossier_lie_uid
       WHERE l.dossier_uid = $1`,
      [dossierPlfrss],
    ),
    1,
  );
  verifier(
    "aucun vote sur l'ensemble ne lui est rattaché",
    await un(
      db,
      `SELECT count(*) FROM officiel.scrutin_dossier sd
        JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
       WHERE sd.dossier_uid = $1 AND s.est_vote_sur_ensemble`,
      [dossierPlfrss],
    ),
    0,
  );
  afficher(
    "dossiers d'engagement de responsabilité (AN21)",
    await un(db, "SELECT count(*) FROM officiel.dossier_49_3"),
  );
  afficher(
    "textes adoptés sans vote qu'ils permettent d'identifier",
    await un(db, "SELECT count(*) FROM officiel.dossier_adopte_sans_vote"),
  );

  console.log("\n=== Rattachement scrutin / dossier ===");
  for (const r of await db.query<{ methode: string; n: string }>(
    "SELECT methode::text AS methode, count(*) AS n FROM officiel.scrutin_dossier GROUP BY 1 ORDER BY 1",
  )) {
    afficher(r.methode, r.n);
  }
  for (const c of await db.query<{ scrutin_uid: string; a: string; b: string }>(
    `SELECT scrutin_uid, dossier_officiel_uid AS a, dossier_reconstruit_uid AS b
       FROM officiel.scrutin_dossier WHERE methode = 'CONFLIT'`,
  )) {
    afficher("conflit", `${c.scrutin_uid} : officiel ${c.a} contre reconstruit ${c.b}`);
  }

  await db.close();
  console.log(echecs === 0 ? "\nTous les contrôles passent." : `\n${echecs} contrôle(s) en échec.`);
  process.exit(echecs === 0 ? 0 : 1);
}

await main();
