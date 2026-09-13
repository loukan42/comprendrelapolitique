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

export interface ProximiteTheme {
  theme: string;
  libelle: string;
  /** Part moyenne de l'Assemblée qui partageait la réponse de l'utilisateur, sur ce thème. */
  soutienMoyen: number;
  questions: number;
}

export interface QuestionComparee {
  scrutinUid: string;
  question: string;
  dossierTitre: string | null;
  reponse: ReponseQuiz;
  theme: string | null;
  soutienChambre: number;
}

export interface ResultatQuiz {
  parGroupe: ProximiteGroupe[];
  parTheme: ProximiteTheme[];
  accords: QuestionComparee[];
  desaccords: QuestionComparee[];
}

const RESULTAT_VIDE: ResultatQuiz = { parGroupe: [], parTheme: [], accords: [], desaccords: [] };

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

    let soutienTotalPour = 0;
    let soutienTotalContre = 0;
    let soutienTotalAbstention = 0;

    for (const ligne of question.repartition) {
      const part = partAccord(reponse.reponse, ligne);
      const courant = parGroupe.get(ligne.organeUid) ?? {
        libelle: ligne.libelle,
        sommeProximite: 0,
        questions: 0,
      };
      courant.sommeProximite += part;
      courant.questions += 1;
      parGroupe.set(ligne.organeUid, courant);

      soutienTotalPour += ligne.voixPour;
      soutienTotalContre += ligne.voixContre;
      soutienTotalAbstention += ligne.voixAbstention;
    }

    const totalChambre = soutienTotalPour + soutienTotalContre + soutienTotalAbstention;
    if (totalChambre > 0) {
      const soutienChambre =
        reponse.reponse === "POUR"
          ? soutienTotalPour / totalChambre
          : reponse.reponse === "CONTRE"
            ? soutienTotalContre / totalChambre
            : soutienTotalAbstention / totalChambre;
      comparees.push({
        scrutinUid: reponse.scrutinUid,
        question: question.question,
        dossierTitre: question.dossierTitre,
        reponse: reponse.reponse,
        theme: question.theme,
        soutienChambre,
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

  const libelleParTheme = new Map(
    questions.filter((q) => q.theme).map((q) => [q.theme as string, q.themeLibelle ?? q.theme]),
  );
  const sommeParTheme = new Map<string, { somme: number; questions: number }>();
  for (const c of comparees) {
    if (!c.theme) continue;
    const t = sommeParTheme.get(c.theme) ?? { somme: 0, questions: 0 };
    t.somme += c.soutienChambre;
    t.questions += 1;
    sommeParTheme.set(c.theme, t);
  }
  const parTheme = Array.from(sommeParTheme.entries())
    .map(([theme, v]) => ({
      theme,
      libelle: libelleParTheme.get(theme) ?? theme,
      soutienMoyen: v.somme / v.questions,
      questions: v.questions,
    }))
    .sort((a, b) => b.soutienMoyen - a.soutienMoyen);

  const compareesTriees = [...comparees].sort((a, b) => b.soutienChambre - a.soutienChambre);

  return {
    parGroupe: parGroupeTrie,
    parTheme,
    accords: compareesTriees.slice(0, 3),
    desaccords: compareesTriees.slice(-3).reverse(),
  };
}
