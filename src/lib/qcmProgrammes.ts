/**
 * Calcul du QCM des programmes, exécuté dans le navigateur.
 *
 * Même contrainte que le quiz des votes (docs/QUIZ_METHODOLOGY.md section 1) :
 * un choix entre des propositions politiques est une opinion politique, donnée
 * sensible au sens de l'article 9 du RGPD. Ce module ne reçoit que des données
 * publiques chargées avant tout choix, et n'importe aucun code serveur ;
 * `confidentialite.test.ts` le vérifie.
 *
 * Ce que le résultat compte, et ce qu'il ne compte pas.
 *
 * Il compte combien de fois la citation d'une formation a été choisie, rapporté
 * au nombre de questions où cette formation était proposée. Le rapport est ce
 * qui rend le décompte honnête : le corpus ne couvre pas toutes les formations
 * sur tous les sujets, et un décompte brut favoriserait mécaniquement celle
 * qui figure dans le plus de questions.
 *
 * Il ne mesure pas une proximité politique. Une question porte une citation
 * par formation, choisie par le site parmi d'autres ; un autre choix de
 * citations pourrait donner un autre résultat. L'écran de résultat le dit.
 */

export interface OptionQcm {
  positionId: string;
  formation: string;
  /** Candidat nommé par le document, quand il y en a un. */
  candidat?: string | null;
  extrait: string;
  resumeAffichage: string | null;
  titreDocument: string | null;
  natureDocument: string;
  url: string | null;
}

export interface QuestionQcm {
  id: string;
  theme: string;
  intitule: string;
  /** Repère factuel affiché sous la question, avec l'adresse de sa source. */
  contexte?: string | null;
  sourceContexte?: string | null;
  options: OptionQcm[];
}

/**
 * Un choix de l'utilisateur. `positionId` à null signifie « aucune de ces
 * propositions » : la question compte comme répondue, aucune formation n'est
 * choisie. Une question passée n'a pas de choix du tout.
 */
export interface ChoixQcm {
  questionId: string;
  positionId: string | null;
}

export interface LigneResultatQcm {
  formation: string;
  /** Nombre de questions où la citation de la formation a été choisie. */
  choisie: number;
  /** Nombre de questions répondues où la formation figurait parmi les choix. */
  proposee: number;
  part: number;
}

export interface ResultatQcm {
  lignes: LigneResultatQcm[];
  repondues: number;
  aucune: number;
}

/** En dessous, le résultat n'est pas affiché : trop peu pour dire quoi que ce soit. */
export const MINIMUM_REPONDUES = 3;

/**
 * Une question n'est servie que si elle réunit au moins ce nombre de
 * formations. Même seuil que `scripts/import/positions_programme.ts`, qui
 * l'annonce dans son mode `--verifier`.
 */
export const MINIMUM_FORMATIONS_PAR_QUESTION = 3;

export function calculerResultatQcm(questions: QuestionQcm[], choix: ChoixQcm[]): ResultatQcm {
  const parQuestion = new Map(questions.map((q) => [q.id, q]));
  const compte = new Map<string, { choisie: number; proposee: number }>();
  let repondues = 0;
  let aucune = 0;

  for (const c of choix) {
    const question = parQuestion.get(c.questionId);
    if (!question) continue;

    // Un choix qui ne correspond à aucune option de la question est ignoré
    // plutôt que compté comme « aucune » : ce serait attribuer à
    // l'utilisateur un rejet qu'il n'a pas exprimé.
    const choisie =
      c.positionId === null ? null : question.options.find((o) => o.positionId === c.positionId);
    if (c.positionId !== null && !choisie) continue;

    repondues += 1;
    if (!choisie) aucune += 1;

    // Une formation ne compte qu'une fois par question, même si le corpus
    // venait à lui attribuer deux citations sur le même sujet.
    for (const formation of new Set(question.options.map((o) => o.formation))) {
      const ligne = compte.get(formation) ?? { choisie: 0, proposee: 0 };
      ligne.proposee += 1;
      if (choisie?.formation === formation) ligne.choisie += 1;
      compte.set(formation, ligne);
    }
  }

  const lignes = [...compte.entries()]
    .map(([formation, l]) => ({
      formation,
      choisie: l.choisie,
      proposee: l.proposee,
      part: l.choisie / l.proposee,
    }))
    .sort(
      (a, b) =>
        b.part - a.part || b.choisie - a.choisie || a.formation.localeCompare(b.formation, "fr"),
    );

  return { lignes, repondues, aucune };
}

/**
 * Mélange de Fisher-Yates. L'ordre d'affichage des options change à chaque
 * partie : une formation toujours présentée en premier bénéficierait de
 * l'effet de position, bien documenté dans les questionnaires à choix.
 *
 * `alea` est injecté pour que les tests soient reproductibles.
 */
export function melanger<T>(elements: readonly T[], alea: () => number = Math.random): T[] {
  const copie = [...elements];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  }
  return copie;
}
