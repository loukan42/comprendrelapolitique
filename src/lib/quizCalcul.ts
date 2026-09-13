/**
 * Calcul de proximité politique, entièrement côté client.
 *
 * docs/QUIZ_METHODOLOGY.md section 1 : une réponse au quiz est une opinion
 * politique, donnée sensible au sens de l'article 9 du RGPD. Ce module ne
 * doit donc jamais être importé par un module serveur, et sa fonction ne
 * doit jamais recevoir autre chose que des données déjà publiques
 * (`QuestionQuiz.repartition`, chargée avant toute réponse) : les réponses
 * de l'utilisateur ne quittent jamais le navigateur.
 *
 * Formules simplifiées par rapport à la section 5 du document : la
 * pondération par `salience_score` et l'atténuation par dossier n'y figurent
 * pas encore, faute d'un score d'importance calculé (docs/SCORING.md).
 * Chaque question compte donc à poids égal, ce qui est documenté comme une
 * simplification provisoire sur la page méthodologie, pas une conformité
 * totale à la section 5.3.
 */

import type { QuestionQuiz } from "../queries/quiz";

export const REPONSES_POSSIBLES = ["POUR", "CONTRE", "ABSTENTION", "NSP"] as const;
export type ReponseQuiz = (typeof REPONSES_POSSIBLES)[number];

export interface ReponseUtilisateur {
  scrutinUid: string;
  reponse: ReponseQuiz;
}

export interface ProximiteGroupe {
  organeUid: string;
  libelle: string | null;
  proximite: number;
  questionsRepondues: number;
}

/** Part des voix d'un groupe qui sont allées dans le même sens que la réponse
 *  de l'utilisateur, sur un texte donné. */
export interface AccordGroupe {
  organeUid: string;
  libelle: string | null;
  accord: number;
}

export interface QuestionComparee {
  scrutinUid: string;
  question: string;
  dossierTitre: string | null;
  reponse: ReponseQuiz;
  theme: string | null;
  /** Tous les groupes ayant voté sur ce texte, du plus proche au plus éloigné
   *  de la réponse donnée. */
  groupes: AccordGroupe[];
}

export interface ResultatQuiz {
  parGroupe: ProximiteGroupe[];
  questions: QuestionComparee[];
}

const RESULTAT_VIDE: ResultatQuiz = { parGroupe: [], questions: [] };

function partAccord(
  reponse: ReponseQuiz,
  l: { voixPour: number; voixContre: number; voixAbstention: number },
): number {
  const total = l.voixPour + l.voixContre + l.voixAbstention;
  if (total === 0) return 0;
  if (reponse === "POUR") return l.voixPour / total;
  if (reponse === "CONTRE") return l.voixContre / total;
  return l.voixAbstention / total;
}

export function calculerResultat(
  questions: QuestionQuiz[],
  reponses: ReponseUtilisateur[],
): ResultatQuiz {
  const questionParScrutin = new Map(questions.map((q) => [q.scrutinUid, q]));
  const utiles = reponses.filter((r) => r.reponse !== "NSP");
  if (utiles.length === 0) return RESULTAT_VIDE;

  const parGroupe = new Map<
    string,
    { libelle: string | null; sommeProximite: number; questions: number }
  >();
  const comparees: QuestionComparee[] = [];

  for (const reponse of utiles) {
    const question = questionParScrutin.get(reponse.scrutinUid);
    if (!question) continue;

    const groupes: AccordGroupe[] = [];
    for (const ligne of question.repartition) {
      if (ligne.voixPour + ligne.voixContre + ligne.voixAbstention === 0) continue;
      const part = partAccord(reponse.reponse, ligne);
      const courant = parGroupe.get(ligne.organeUid) ?? {
        libelle: ligne.libelle,
        sommeProximite: 0,
        questions: 0,
      };
      courant.sommeProximite += part;
      courant.questions += 1;
      parGroupe.set(ligne.organeUid, courant);

      groupes.push({ organeUid: ligne.organeUid, libelle: ligne.libelle, accord: part });
    }

    if (groupes.length > 0) {
      comparees.push({
        scrutinUid: reponse.scrutinUid,
        question: question.question,
        dossierTitre: question.dossierTitre,
        reponse: reponse.reponse,
        theme: question.theme,
        groupes: groupes.sort((a, b) => b.accord - a.accord),
      });
    }
  }

  const parGroupeTrie = Array.from(parGroupe.entries())
    .map(([organeUid, v]) => ({
      organeUid,
      libelle: v.libelle,
      proximite: v.sommeProximite / v.questions,
      questionsRepondues: v.questions,
    }))
    .filter((g) => g.questionsRepondues >= Math.min(3, utiles.length))
    .sort((a, b) => b.proximite - a.proximite);

  return { parGroupe: parGroupeTrie, questions: comparees };
}
