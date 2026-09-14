/**
 * Banque du quiz des votes, livrée au navigateur (docs/QUIZ_ENGINE.md, T1.4).
 *
 * Tout ce qui sert au calcul est public : les questions, les scrutins qui les
 * fondent, et la position de chaque formation, calculée d'avance par
 * `data:positions` à partir des votes individuels. La fonction ne reçoit rien :
 * les réponses restent dans le navigateur, où `quizPosition.ts` fait le calcul
 * (docs/QUIZ_METHODOLOGY.md section 1).
 *
 * Une base chargée sans `data:questions` ni `data:positions` renvoie une
 * banque vide, et la page le dit plutôt que de répondre 500.
 */

import { createServerFn } from "@tanstack/react-start";
import type { ParametresScoring, PositionConnue } from "../lib/quizPosition";
import { requete, tableDisponible } from "./db";

export interface ScrutinQuestion {
  uid: string;
  /** Date au format AAAA-MM-JJ. */
  date: string;
  titre: string;
  /** +1 : voter pour ce texte va dans le sens de la question ; -1 : contre. */
  sens: 1 | -1;
  /** Dossier du texte voté, pour le lien vers sa page. */
  dossierUid: string | null;
}

export interface QuestionBanque {
  id: string;
  intitule: string;
  description: string | null;
  theme: string;
  scrutins: ScrutinQuestion[];
}

export interface FormationBanque {
  id: string;
  libelle: string;
  libelleCourt: string | null;
}

export interface BanqueQuiz {
  parametres: ParametresScoring | null;
  questions: QuestionBanque[];
  formations: FormationBanque[];
  positions: PositionConnue[];
}

const VIDE: BanqueQuiz = { parametres: null, questions: [], formations: [], positions: [] };

/**
 * Ordre de passage : les thèmes alternent, pour que deux questions sur le même
 * sujet ne se suivent pas. L'ordre reste le même d'une partie à l'autre : le
 * quiz de la V1 est un quiz fixe, explicable.
 */
function alternerThemes(questions: QuestionBanque[]): QuestionBanque[] {
  const parTheme = new Map<string, QuestionBanque[]>();
  for (const q of questions) parTheme.set(q.theme, [...(parTheme.get(q.theme) ?? []), q]);
  const files = [...parTheme.values()];
  const ordre: QuestionBanque[] = [];
  while (ordre.length < questions.length) {
    for (const file of files) {
      const q = file.shift();
      if (q) ordre.push(q);
    }
  }
  return ordre;
}

export const chargerBanqueQuiz = createServerFn({ method: "GET" }).handler(
  async (): Promise<BanqueQuiz> => {
    if (!(await tableDisponible("enrichissement.question_position"))) return VIDE;

    const [p] = await requete<{
      demi_vie_mois: number;
      min_scrutins: number;
      min_votes: number;
      seuil_confiance_haute: number;
      seuil_confiance_moyenne: number;
      poids_sujet_important: number;
    }>(
      `SELECT demi_vie_mois, min_scrutins, min_votes,
              seuil_confiance_haute::float8 AS seuil_confiance_haute,
              seuil_confiance_moyenne::float8 AS seuil_confiance_moyenne,
              poids_sujet_important::float8 AS poids_sujet_important
         FROM enrichissement.parametres_scoring
        WHERE actif`,
    );
    if (!p) return VIDE;

    const positions = await requete<{
      question_id: string;
      formation_id: string;
      position: number;
      confiance: number;
    }>(
      `SELECT qp.question_id, qp.formation_id,
              qp.position::float8 AS position, qp.confiance::float8 AS confiance
         FROM enrichissement.question_position qp
         JOIN enrichissement.question q ON q.id = qp.question_id
        WHERE q.actif`,
    );
    const avecPosition = new Set(positions.map((r) => r.question_id));

    const questions = await requete<{
      id: string;
      intitule: string;
      description: string | null;
      theme: string;
    }>(
      `SELECT id, intitule, description, theme
         FROM enrichissement.question
        WHERE actif
        ORDER BY id`,
    );

    const scrutins = await requete<{
      question_id: string;
      uid: string;
      date: string;
      titre: string;
      sens: number;
      dossier_uid: string | null;
    }>(
      `SELECT qs.question_id, s.uid, s.date_scrutin::text AS date, s.titre, qs.sens,
              sd.dossier_uid
         FROM enrichissement.question_scrutin qs
         JOIN enrichissement.question q ON q.id = qs.question_id AND q.actif
         JOIN officiel.scrutin s ON s.uid = qs.scrutin_uid
         LEFT JOIN LATERAL (
           SELECT dossier_uid FROM officiel.scrutin_dossier
            WHERE scrutin_uid = s.uid AND dossier_uid IS NOT NULL
            LIMIT 1
         ) sd ON true
        ORDER BY s.date_scrutin`,
    );

    const formations = await requete<{
      id: string;
      libelle: string;
      libelle_court: string | null;
    }>(
      `SELECT f.id, f.libelle, f.libelle_court
         FROM enrichissement.formation f
        WHERE f.id IN (SELECT DISTINCT formation_id FROM enrichissement.question_position)
        ORDER BY f.rang NULLS LAST, f.libelle`,
    );

    // Une question sans aucune position publiée ne compare personne : elle
    // n'est pas posée.
    const banque = questions
      .filter((q) => avecPosition.has(q.id))
      .map((q) => ({
        id: q.id,
        intitule: q.intitule,
        description: q.description,
        theme: q.theme,
        scrutins: scrutins
          .filter((s) => s.question_id === q.id)
          .map((s) => ({
            uid: s.uid,
            date: s.date,
            titre: s.titre,
            sens: (s.sens === -1 ? -1 : 1) as 1 | -1,
            dossierUid: s.dossier_uid,
          })),
      }));

    return {
      parametres: {
        demiVieMois: p.demi_vie_mois,
        minScrutins: p.min_scrutins,
        minVotes: p.min_votes,
        seuilConfianceHaute: p.seuil_confiance_haute,
        seuilConfianceMoyenne: p.seuil_confiance_moyenne,
        poidsSujetImportant: p.poids_sujet_important,
      },
      questions: alternerThemes(banque),
      formations: formations.map((f) => ({
        id: f.id,
        libelle: f.libelle,
        libelleCourt: f.libelle_court,
      })),
      positions: positions.map((r) => ({
        questionId: r.question_id,
        formationId: r.formation_id,
        position: r.position,
        confiance: r.confiance,
      })),
    };
  },
);
