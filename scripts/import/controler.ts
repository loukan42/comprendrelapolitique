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

/**
 * Pour un écart connu et documenté (référence orpheline vers un autre jeu,
 * qualité inégale d'une archive historique) plutôt qu'un chiffre exact : échoue
 * seulement si l'écart mesuré dépasse le seuil, pour absorber une variation
 * mineure déjà documentée sans masquer une régression de l'importeur.
 */
function verifierMax(intitule: string, obtenu: unknown, seuil: number): void {
  const n = Number(obtenu);
  const ok = Number.isFinite(n) && n <= seuil;
  if (!ok) echecs++;
  console.log(`  ${ok ? "OK  " : "ECHEC"}  ${intitule} : ${obtenu}`);
  if (!ok) console.log(`          seuil ${seuil}, obtenu ${obtenu}`);
}

/** Symétrique de verifierMax, pour un plancher de couverture. */
function verifierMin(intitule: string, obtenu: unknown, seuil: number): void {
  const n = Number(obtenu);
  const ok = Number.isFinite(n) && n >= seuil;
  if (!ok) echecs++;
  console.log(`  ${ok ? "OK  " : "ECHEC"}  ${intitule} : ${obtenu}`);
  if (!ok) console.log(`          seuil ${seuil}, obtenu ${obtenu}`);
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

  console.log("\n=== Débats : la séance des motions de censure du 20 mars 2023 ===");
  const nDebats = await un<string>(db, "SELECT count(*) FROM officiel.debat_seance");
  if (Number(nDebats) > 0) {
    // officiel.scrutin.seance_ref est le seul point d'ancrage entre un débat et
    // le reste du modèle (DATA_SOURCES section 7 ter) : aucun champ du XML ne
    // référence un dossier ou un scrutin directement. On vérifie qu'il pointe
    // bien vers la séance qui a précédé les deux votes.
    const seanceUid = await un<string>(
      db,
      "SELECT DISTINCT seance_ref FROM officiel.scrutin WHERE uid IN ('VTANR5L16V1240', 'VTANR5L16V1241')",
    );
    verifier(
      "la séance des deux motions de censure est chargée",
      await un(db, "SELECT count(*) FROM officiel.debat_seance WHERE uid = $1", [seanceUid]),
      1,
    );
    verifier(
      "datée du 20 mars 2023",
      await un(db, "SELECT date_seance_jour FROM officiel.debat_seance WHERE uid = $1", [
        seanceUid,
      ]),
      "lundi 20 mars 2023",
    );
    // Le texte de l'intervention qui annonce le résultat reproduit exactement
    // les chiffres officiels du scrutin (278 voix pour, 287 requises) : preuve
    // que le texte importé correspond bien à l'événement, pas seulement sa date.
    verifier(
      "le résultat de la motion Pancher est lisible dans le compte rendu",
      await un(
        db,
        `SELECT count(*) FROM officiel.intervention
          WHERE seance_uid = $1 AND texte LIKE '%Pour l' || chr(8217) || 'adoption 278%'`,
        [seanceUid],
      ),
      1,
    );
    afficher(
      "interventions de cette séance",
      await un(db, "SELECT count(*) FROM officiel.intervention WHERE seance_uid = $1", [seanceUid]),
    );
  }
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
    // Seuils fixés avec une marge au-dessus des valeurs mesurées sur la XVIe
    // (docs/DATA_MODEL.md section 7 bis, docs/DATA_SOURCES.md section 7 bis.4) :
    // assez de marge pour absorber le gradient de qualité déjà documenté sur
    // une archive historique, pas assez pour laisser passer une régression de
    // l'importeur sans échec.
    verifierMax(
      "amendements référençant un document absent du jeu Dossiers",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.document d ON d.uid = a.document_uid
         WHERE d.uid IS NULL`,
      ),
      70, // mesuré : 47 sur 163 789 (0,03 %)
    );
    verifierMax(
      "amendements référençant un dossier absent",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.dossier d ON d.uid = a.dossier_uid
         WHERE d.uid IS NULL`,
      ),
      5, // mesuré : 0, la référence concorde sur l'intégralité du corpus
    );
    verifierMax(
      "auteurs d'amendement absents du jeu Acteurs",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement a
          LEFT JOIN officiel.acteur ac ON ac.uid = a.auteur_acteur_uid
         WHERE a.auteur_acteur_uid IS NOT NULL AND ac.uid IS NULL`,
      ),
      25, // mesuré : 13 sur 162 290 auteurs de type acteur
    );
    verifierMax(
      "cosignataires absents du jeu Acteurs",
      await un(
        db,
        `SELECT count(*) FROM officiel.amendement_cosignataire c
          LEFT JOIN officiel.acteur ac ON ac.uid = c.acteur_uid
         WHERE ac.uid IS NULL`,
      ),
      5000, // mesuré : 3 681 sur 3 148 274 (0,12 %)
    );
  }

  console.log("\n=== Débats ===");
  const nInterventions = await un<string>(db, "SELECT count(*) FROM officiel.intervention");
  if (Number(nInterventions) > 0) {
    // Débats non fournis pour toutes les législatures (voir docs/PIPELINE.md) :
    // ce bloc ne s'exécute que si le jeu a été chargé. Seule la XVIe a été
    // mesurée à ce stade.
    const ATTENDUS_DEBATS: Record<
      number,
      {
        seances: number;
        points: number;
        interventions: number;
        orateurs: number;
        sansActeur: number;
      }
    > = {
      16: {
        seances: 605,
        points: 31541,
        interventions: 337041,
        orateurs: 312097,
        sansActeur: 29733,
      },
    };
    const attenduDeb = ATTENDUS_DEBATS[legislature];
    if (attenduDeb) {
      verifier(
        "séances",
        await un(db, "SELECT count(*) FROM officiel.debat_seance"),
        attenduDeb.seances,
      );
      verifier(
        "points de sommaire",
        await un(db, "SELECT count(*) FROM officiel.debat_point"),
        attenduDeb.points,
      );
      verifier("interventions", nInterventions, attenduDeb.interventions);
      verifier(
        "liens orateur",
        await un(db, "SELECT count(*) FROM officiel.intervention_orateur"),
        attenduDeb.orateurs,
      );
      // Compte les paragraphes sans attribut id_acteur dans le XML : une
      // mention procédurale (didascalie, ouverture/fermeture de séance), pas
      // un orateur non identifié (docs/DATA_SOURCES.md section 7 ter.3). Fixé
      // par la source, donc vérifié à l'identique plutôt qu'avec un seuil.
      verifier(
        "interventions sans acteur identifié par la source",
        await un(db, "SELECT count(*) FROM officiel.intervention WHERE acteur_uid IS NULL"),
        attenduDeb.sansActeur,
      );
    } else {
      afficher("interventions chargées", nInterventions);
      afficher(
        "interventions sans acteur identifié par la source",
        await un(db, "SELECT count(*) FROM officiel.intervention WHERE acteur_uid IS NULL"),
      );
    }
    // 'PA0' et les identifiants négatifs ne sont pas des acteurs (voir
    // db/migrations/001_officiel.sql) : jamais recopiés dans acteur_uid.
    verifier(
      "aucun acteur fictif « PA0 » en base",
      await un(db, `SELECT count(*) FROM officiel.intervention WHERE acteur_uid = 'PA0'`),
      0,
    );
    // Gradient de qualité déjà documenté (docs/DATA_SOURCES.md section 7 ter.3,
    // même nature que les orphelins d'amendements) : mesuré à 13 sur 656
    // acteurs distincts référencés par les débats de la XVIe (2 %).
    verifierMax(
      "acteurs référencés par les débats mais absents du jeu Acteurs",
      await un(
        db,
        `SELECT count(DISTINCT i.acteur_uid) FROM officiel.intervention i
          LEFT JOIN officiel.acteur a ON a.uid = i.acteur_uid
         WHERE i.acteur_uid IS NOT NULL AND a.uid IS NULL`,
      ),
      25,
    );
    // Le seul point d'ancrage vers le reste du modèle : `seanceRef`, identique
    // à `officiel.scrutin.seance_ref`. Combien de séances chargées ont au
    // moins un scrutin, et réciproquement. Une couverture, pas un orphelin :
    // un plancher, mesuré sur la XVIe à 506 séances sur 605 (83,6 %) et 4 097
    // scrutins sur 4 106 (99,8 %).
    verifierMin(
      "séances de débat avec au moins un scrutin rattaché",
      await un(
        db,
        `SELECT count(*) FROM officiel.debat_seance ds
          WHERE EXISTS (SELECT 1 FROM officiel.scrutin s WHERE s.seance_ref = ds.uid)`,
      ),
      480,
    );
    verifierMin(
      "scrutins dont la séance de débat est chargée",
      await un(
        db,
        `SELECT count(*) FROM officiel.scrutin s
          WHERE EXISTS (SELECT 1 FROM officiel.debat_seance ds WHERE ds.uid = s.seance_ref)`,
      ),
      4050,
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
