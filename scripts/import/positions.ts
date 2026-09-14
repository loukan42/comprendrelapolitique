/**
 * Calcul des positions des formations sur les questions du quiz.
 *
 * Usage :
 *   node scripts/import/positions.ts --db data/pg16
 *   node scripts/import/positions.ts --db data/pg16 --detail fin-de-vie
 *
 * `--detail` imprime, pour une question, le décompte scrutin par scrutin qui
 * a servi au calcul. C'est ce qui permet de refaire l'opération à la main
 * depuis `officiel.scrutin_groupe` et de vérifier le moteur sur un fait
 * connu, comme le fait `data:controler` pour l'import (docs/PIPELINE.md).
 *
 * Le calcul lui-même vit dans `src/lib/quizPosition.ts` et n'est pas
 * réimplémenté ici : ce script assemble les données et appelle les mêmes
 * fonctions que le navigateur, pour qu'un écart entre les deux soit
 * impossible.
 */

import {
  calculerPosition,
  niveauConfiance,
  type ParametresScoring,
  type VoteFormation,
} from "../../src/lib/quizPosition.ts";
import { ouvrirPGlite, type Db } from "./db.ts";

interface LigneVote {
  question_id: string;
  formation_id: string;
  formation_libelle: string;
  scrutin_uid: string;
  date_scrutin: string;
  sens: number;
  poids: string;
  voix_pour: number;
  voix_contre: number;
  voix_abstention: number;
}

/**
 * Les voix sont agrégées depuis les votes individuels, comme sur la page
 * d'une loi : le bloc de groupe de la source porte parfois un organe_uid
 * factice, alors que le vote individuel porte le groupe au moment du vote.
 */
const REQUETE_VOTES = `
  SELECT qs.question_id, f.id AS formation_id, f.libelle AS formation_libelle,
         qs.scrutin_uid, s.date_scrutin::date::text AS date_scrutin,
         qs.sens, qs.poids,
         count(*) FILTER (WHERE v.position = 'POUR')::int       AS voix_pour,
         count(*) FILTER (WHERE v.position = 'CONTRE')::int     AS voix_contre,
         count(*) FILTER (WHERE v.position = 'ABSTENTION')::int AS voix_abstention
    FROM enrichissement.question_scrutin qs
    JOIN enrichissement.question q ON q.id = qs.question_id AND q.actif
    JOIN officiel.scrutin s ON s.uid = qs.scrutin_uid
    JOIN officiel.vote v ON v.scrutin_uid = qs.scrutin_uid
    JOIN enrichissement.formation_groupe fg ON fg.organe_uid = v.organe_uid
    JOIN enrichissement.formation f ON f.id = fg.formation_id
   GROUP BY qs.question_id, f.id, f.libelle, qs.scrutin_uid, s.date_scrutin, qs.sens, qs.poids
   ORDER BY qs.question_id, f.rang, s.date_scrutin`;

async function chargerParametres(db: Db): Promise<{ id: number; p: ParametresScoring }> {
  const [row] = await db.query<{
    id: number;
    demi_vie_mois: number;
    min_scrutins: number;
    min_votes: number;
    seuil_confiance_haute: string;
    seuil_confiance_moyenne: string;
    poids_sujet_important: string;
  }>(`SELECT * FROM enrichissement.parametres_scoring WHERE actif`);
  if (!row) throw new Error("Aucun jeu de paramètres actif : lancer data:questions d'abord");
  return {
    id: row.id,
    p: {
      demiVieMois: row.demi_vie_mois,
      minScrutins: row.min_scrutins,
      minVotes: row.min_votes,
      seuilConfianceHaute: Number(row.seuil_confiance_haute),
      seuilConfianceMoyenne: Number(row.seuil_confiance_moyenne),
      poidsSujetImportant: Number(row.poids_sujet_important),
    },
  };
}

function regrouper(lignes: LigneVote[]): Map<string, Map<string, VoteFormation[]>> {
  const parQuestion = new Map<string, Map<string, VoteFormation[]>>();
  for (const l of lignes) {
    const parFormation = parQuestion.get(l.question_id) ?? new Map<string, VoteFormation[]>();
    const votes = parFormation.get(l.formation_id) ?? [];
    votes.push({
      scrutinUid: l.scrutin_uid,
      dateScrutin: new Date(l.date_scrutin),
      sens: l.sens === 1 ? 1 : -1,
      poids: Number(l.poids),
      voixPour: l.voix_pour,
      voixContre: l.voix_contre,
      voixAbstention: l.voix_abstention,
    });
    parFormation.set(l.formation_id, votes);
    parQuestion.set(l.question_id, parFormation);
  }
  return parQuestion;
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  const iDetail = args.indexOf("--detail");
  const detail = iDetail >= 0 ? args[iDetail + 1] : undefined;
  if (!chemin) {
    console.error("usage: positions.ts --db <chemin> [--detail <question_id>]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);
  const { id: parametresId, p } = await chargerParametres(db);
  const lignes = await db.query<LigneVote>(REQUETE_VOTES);
  const parQuestion = regrouper(lignes);

  const libelles = new Map(lignes.map((l) => [l.formation_id, l.formation_libelle]));

  if (detail) {
    const parFormation = parQuestion.get(detail);
    if (!parFormation) {
      console.error(`Question inconnue ou sans vote exploitable : ${detail}`);
      await db.close();
      process.exit(1);
    }
    console.log(`## ${detail}`);
    for (const [formationId, votes] of parFormation) {
      const r = calculerPosition(votes, p);
      console.log(`\n${libelles.get(formationId)}`);
      for (const v of votes) {
        const exprimes = v.voixPour + v.voixContre + v.voixAbstention;
        console.log(
          `   ${v.scrutinUid} ${v.dateScrutin.toISOString().slice(0, 10)} sens ${v.sens > 0 ? "+1" : "-1"} ` +
            `poids ${v.poids} | pour ${v.voixPour} contre ${v.voixContre} abst ${v.voixAbstention} ` +
            `(exprimés ${exprimes})`,
        );
      }
      console.log(
        `   => position ${r.position.toFixed(3)} | confiance ${r.confiance.toFixed(3)} ` +
          `(${niveauConfiance(r.confiance, p)}) | couverture ${r.couverture.toFixed(2)} ` +
          `cohésion ${r.cohesion.toFixed(2)} constance ${r.constance.toFixed(2)}` +
          (r.publiable ? "" : " | NON PUBLIABLE"),
      );
    }
    await db.close();
    return;
  }

  await db.query(`DELETE FROM enrichissement.question_position`);
  let ecrites = 0;
  let ecartees = 0;
  for (const [questionId, parFormation] of parQuestion) {
    for (const [formationId, votes] of parFormation) {
      const r = calculerPosition(votes, p);
      if (!r.publiable) {
        ecartees += 1;
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.question_position
           (question_id, formation_id, position, confiance, couverture, cohesion,
            constance, n_scrutins, n_votes, parametres_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          questionId,
          formationId,
          r.position.toFixed(3),
          r.confiance.toFixed(3),
          r.couverture.toFixed(3),
          r.cohesion.toFixed(3),
          r.constance.toFixed(3),
          r.nScrutins,
          r.nVotes,
          parametresId,
        ],
      );
      ecrites += 1;
    }
  }

  console.log(
    `${ecrites} positions calculées sur ${parQuestion.size} questions` +
      (ecartees > 0 ? `, ${ecartees} écartées faute de données suffisantes` : ""),
  );
  await db.close();
}

await main();
