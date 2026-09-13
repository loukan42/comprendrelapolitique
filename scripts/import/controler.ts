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

/**
 * Controles propres a la XVIe legislature : ils portent sur des evenements
 * dates, et n'ont aucun sens ailleurs.
 */
async function controlesXVIe(db: Db): Promise<void> {
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
}

async function main() {
  const chemin = process.argv[2];
  if (!chemin) {
    console.error("usage: controler.ts <chemin_base>");
    process.exit(1);
  }
  const db = await ouvrirPGlite(chemin);

  // Mesures relevées sur les fichiers bruts, avant tout import. Un écart ici
  // signale que l'importeur perd ou invente des lignes.
  const ATTENDUS: Record<number, Record<string, number>> = {
    15: { scrutins: 4417, votes: 472631, blocs: 40415, ensemble: 376, sansGroupe: 0 },
    16: { scrutins: 4106, votes: 602911, blocs: 45175, ensemble: 209, sansGroupe: 0 },
    17: { scrutins: 8434, votes: 1270476, blocs: 101208, ensemble: 214, sansGroupe: 1916 },
  };

  const legislature = Number(
    await un(
      db,
      "SELECT legislature FROM officiel.scrutin GROUP BY 1 ORDER BY count(*) DESC LIMIT 1",
    ),
  );
  const attendu = ATTENDUS[legislature];
  if (!attendu) {
    console.error(`Aucune mesure de référence pour la législature ${legislature}.`);
    process.exit(1);
  }
  console.log(`\nLégislature chargée : ${legislature}`);

  console.log("\n=== Volumes, comparés aux mesures sur les fichiers bruts ===");
  verifier("scrutins", await un(db, "SELECT count(*) FROM officiel.scrutin"), attendu.scrutins);
  verifier("votes individuels", await un(db, "SELECT count(*) FROM officiel.vote"), attendu.votes);
  verifier(
    "blocs groupe-scrutin",
    await un(db, "SELECT count(*) FROM officiel.scrutin_groupe"),
    attendu.blocs,
  );
  verifier(
    "votes sur l'ensemble",
    await un(db, "SELECT count(*) FROM officiel.scrutin WHERE est_vote_sur_ensemble"),
    attendu.ensemble,
  );
  // Le groupe n'est pas inventé quand la source ne le donne pas : 14 scrutins de
  // la XVIIe listent leurs douze groupes sans en identifier aucun.
  verifier(
    "votes dont le groupe est inconnu",
    await un(db, "SELECT count(*) FROM officiel.vote WHERE organe_uid IS NULL"),
    attendu.sansGroupe,
  );
  verifier(
    "aucun organe fictif « PO0 » en base",
    await un(db, `SELECT count(*) FROM officiel.vote WHERE organe_uid = 'PO0'`),
    0,
  );
  // Les blocs, pas les catégories : un bloc peut diverger sur plusieurs
  // catégories, d'où un compte inférieur à celui de l'exploration.
  afficher(
    "blocs où le nominatif diverge des décomptes",
    await un(db, "SELECT count(*) FROM officiel.scrutin_groupe WHERE NOT nominatif_complet"),
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

  if (legislature === 16) await controlesXVIe(db);

  console.log("\n=== Amendements ===");
  const nAmendements = await un<string>(db, "SELECT count(*) FROM officiel.amendement");
  if (Number(nAmendements) > 0) {
    // Amendements non fournis pour toutes les législatures (voir
    // docs/PIPELINE.md) : ce bloc ne s'exécute que si le jeu a été chargé.
    const ATTENDUS_AMENDEMENTS: Record<number, { amendements: number; cosignatures: number }> = {
      16: { amendements: 163789, cosignatures: 3148274 },
    };
    const attenduAm = ATTENDUS_AMENDEMENTS[legislature];
    if (attenduAm) {
      verifier("amendements", nAmendements, attenduAm.amendements);
      verifier(
        "liens de cosignature",
        await un(db, "SELECT count(*) FROM officiel.amendement_cosignataire"),
        attenduAm.cosignatures,
      );
    } else {
      afficher("amendements chargés", nAmendements);
    }
    // Un amendement non discuté n'a pas de sort : ce n'est pas une absence à
    // corriger (docs/DATA_SOURCES.md section 9). On vérifie la répartition
    // par type d'auteur plutôt qu'un total de « décisions ».
    for (const r of await db.query<{ type_auteur: string; n: string }>(
      "SELECT type_auteur, count(*) AS n FROM officiel.amendement GROUP BY 1 ORDER BY 2 DESC",
    )) {
      afficher(`auteurs « ${r.type_auteur} »`, r.n);
    }
    verifier(
      "un amendement Gouvernement n'a jamais d'acteur pour auteur",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement
          WHERE type_auteur = 'Gouvernement' AND auteur_acteur_uid IS NOT NULL`,
      ),
      0,
    );
    afficher(
      "amendements sans décision (non discutés)",
      await un(db, "SELECT count(*) FROM officiel.amendement WHERE sort_brut IS NULL"),
    );
    afficher(
      "amendements référençant un document absent du jeu Dossiers",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.document d ON d.uid = a.document_uid
         WHERE d.uid IS NULL`,
      ),
    );
    afficher(
      "amendements référençant un dossier absent",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.dossier d ON d.uid = a.dossier_uid
         WHERE d.uid IS NULL`,
      ),
    );
    afficher(
      "auteurs d'amendement absents du jeu Acteurs",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.acteur ac ON ac.uid = a.auteur_acteur_uid
         WHERE a.auteur_acteur_uid IS NOT NULL AND ac.uid IS NULL`,
      ),
    );
    afficher(
      "cosignataires absents du jeu Acteurs",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement_cosignataire c
          LEFT JOIN officiel.acteur ac ON ac.uid = c.acteur_uid
         WHERE ac.uid IS NULL`,
      ),
    );
  }

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
