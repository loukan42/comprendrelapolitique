/**
 * Position d'une formation politique sur une question de quiz, et confiance
 * dans cette position.
 *
 * Formules et justifications : docs/QUIZ_ENGINE.md section 4. Ce module les
 * implémente en fonctions pures, sans accès à la base, pour deux raisons :
 * elles sont vérifiables à la main sur un cas construit, et elles tournent
 * aussi bien côté serveur (précalcul) que côté navigateur (recalcul local
 * sans envoyer de réponse).
 *
 * Aucun paramètre n'est écrit en dur ici : ils viennent de
 * `enrichissement.parametres_scoring` et transitent par `ParametresScoring`.
 */

export interface ParametresScoring {
  /** Demi-vie de la décote temporelle, en mois. */
  demiVieMois: number;
  /** Sous ce nombre de scrutins retenus, la position n'est pas publiée. */
  minScrutins: number;
  /** Sous ce nombre de voix cumulées, la position n'est pas publiée. */
  minVotes: number;
  seuilConfianceHaute: number;
  seuilConfianceMoyenne: number;
  poidsSujetImportant: number;
}

/** Un scrutin retenu par une question, vu du côté d'une formation. */
export interface VoteFormation {
  scrutinUid: string;
  /** Date du scrutin, pour la décote temporelle. */
  dateScrutin: Date;
  /** +1 si voter POUR va dans le sens de la question, -1 sinon. */
  sens: 1 | -1;
  /** Poids éditorial du scrutin dans la question. */
  poids: number;
  voixPour: number;
  voixContre: number;
  voixAbstention: number;
}

export interface PositionFormation {
  /** -1 totalement opposée, 0 partagée, +1 totalement favorable. */
  position: number;
  confiance: number;
  couverture: number;
  cohesion: number;
  constance: number;
  nScrutins: number;
  nVotes: number;
  /** Faux quand les seuils de publication ne sont pas atteints. */
  publiable: boolean;
}

/**
 * Décote temporelle. Un vote de dix ans ne dit pas la position d'aujourd'hui
 * aussi bien qu'un vote de l'an dernier, mais il dit quelque chose : la
 * décroissance est douce, pas un couperet.
 */
export function poidsTemporel(dateScrutin: Date, maintenant: Date, demiVieMois: number): number {
  const mois =
    (maintenant.getFullYear() - dateScrutin.getFullYear()) * 12 +
    (maintenant.getMonth() - dateScrutin.getMonth());
  if (mois <= 0) return 1;
  return Math.pow(0.5, mois / demiVieMois);
}

/**
 * Position du groupe sur un scrutin, ramenée dans le sens de la question.
 *
 * L'abstention reste au dénominateur sans compter d'un côté ni de l'autre :
 * un groupe qui s'abstient massivement obtient une position proche de 0, ce
 * qui est exactement ce qu'il a exprimé. Les non-votants sont hors du
 * décompte : une absence n'est pas une position (AGENTS.md section 5,
 * règle 2).
 */
export function positionSurScrutin(v: VoteFormation): number | null {
  const exprimes = v.voixPour + v.voixContre + v.voixAbstention;
  if (exprimes === 0) return null;
  return (v.sens * (v.voixPour - v.voixContre)) / exprimes;
}

/** Part du groupe qui a voté comme la majorité du groupe, sur ce scrutin. */
export function uniteSurScrutin(v: VoteFormation): number | null {
  const exprimes = v.voixPour + v.voixContre + v.voixAbstention;
  if (exprimes === 0) return null;
  return Math.max(v.voixPour, v.voixContre, v.voixAbstention) / exprimes;
}

/**
 * Agrège les scrutins d'une question pour une formation.
 *
 * Trois faiblesses différentes font baisser la confiance, et elles ne se
 * confondent pas : trop peu de données (couverture), un groupe divisé sur
 * chaque scrutin (cohésion), un groupe qui a voté dans un sens puis dans
 * l'autre (constance). Un groupe qui vote +1 sur un texte et -1 sur un autre
 * a une position moyenne de 0 qui ne veut rien dire, et c'est la constance
 * qui le signale.
 */
export function calculerPosition(
  votes: VoteFormation[],
  parametres: ParametresScoring,
  maintenant: Date = new Date(),
): PositionFormation {
  const retenus = votes.filter((v) => positionSurScrutin(v) !== null);

  if (retenus.length === 0) {
    return {
      position: 0,
      confiance: 0,
      couverture: 0,
      cohesion: 0,
      constance: 0,
      nScrutins: 0,
      nVotes: 0,
      publiable: false,
    };
  }

  let sommePoids = 0;
  let sommePosition = 0;
  let sommeUnite = 0;
  let nVotes = 0;

  for (const v of retenus) {
    const poids = v.poids * poidsTemporel(v.dateScrutin, maintenant, parametres.demiVieMois);
    sommePoids += poids;
    sommePosition += poids * positionSurScrutin(v)!;
    sommeUnite += poids * uniteSurScrutin(v)!;
    nVotes += v.voixPour + v.voixContre + v.voixAbstention;
  }

  // Tous les poids temporels peuvent tendre vers zéro sur un corpus très
  // ancien : on ne divise pas par une somme nulle.
  if (sommePoids === 0) {
    return {
      position: 0,
      confiance: 0,
      couverture: 0,
      cohesion: 0,
      constance: 0,
      nScrutins: retenus.length,
      nVotes,
      publiable: false,
    };
  }

  const position = sommePosition / sommePoids;
  const cohesion = sommeUnite / sommePoids;

  let sommeEcarts = 0;
  for (const v of retenus) {
    const poids = v.poids * poidsTemporel(v.dateScrutin, maintenant, parametres.demiVieMois);
    sommeEcarts += poids * Math.pow(positionSurScrutin(v)! - position, 2);
  }
  const dispersion = Math.sqrt(sommeEcarts / sommePoids);
  const constance = Math.max(0, 1 - Math.min(1, dispersion));

  const couverture =
    Math.min(1, retenus.length / parametres.minScrutins) *
    Math.min(1, nVotes / parametres.minVotes);

  const publiable = retenus.length >= parametres.minScrutins && nVotes >= parametres.minVotes;

  return {
    position,
    confiance: couverture * cohesion * constance,
    couverture,
    cohesion,
    constance,
    nScrutins: retenus.length,
    nVotes,
    publiable,
  };
}

export type NiveauConfiance = "élevée" | "moyenne" | "faible";

export function niveauConfiance(confiance: number, p: ParametresScoring): NiveauConfiance {
  if (confiance >= p.seuilConfianceHaute) return "élevée";
  if (confiance >= p.seuilConfianceMoyenne) return "moyenne";
  return "faible";
}

/**
 * Réponses proposées à l'utilisateur.
 *
 * « Ni d'accord ni pas d'accord » vaut 0 : c'est une position mesurée.
 * « Je ne sais pas » ne vaut pas 0, il retire la question du calcul, au
 * numérateur comme au dénominateur. Confondre les deux ferait passer une
 * absence d'avis pour un centrisme.
 */
export const VALEURS_REPONSE = {
  TOUT_A_FAIT_DACCORD: 1,
  PLUTOT_DACCORD: 0.5,
  NI_NI: 0,
  PLUTOT_PAS_DACCORD: -0.5,
  PAS_DU_TOUT_DACCORD: -1,
} as const;

export type ReponseEchelle = keyof typeof VALEURS_REPONSE | "NSP";

/** Accord entre une réponse et une position, sur 0 à 1. */
export function accord(reponse: number, position: number): number {
  return 1 - Math.abs(reponse - position) / 2;
}

export interface ReponseCalcul {
  questionId: string;
  reponse: ReponseEchelle;
  /** L'utilisateur a signalé ce sujet comme important pour lui. */
  important?: boolean;
}

export interface PositionConnue {
  questionId: string;
  formationId: string;
  position: number;
  confiance: number;
}

export interface CompatibiliteFormation {
  formationId: string;
  compatibilite: number;
  /** Confiance moyenne des positions ayant servi au calcul. */
  confianceMoyenne: number;
  questionsRetenues: number;
}

/**
 * Compatibilité entre les réponses d'un utilisateur et chaque formation.
 *
 * La confiance sert de poids : une question sur laquelle la position de la
 * formation est incertaine pèse moins, ce qui évite qu'un groupe divisé
 * arrive en tête par accident.
 */
export function calculerCompatibilite(
  reponses: ReponseCalcul[],
  positions: PositionConnue[],
  parametres: ParametresScoring,
): CompatibiliteFormation[] {
  const utiles = reponses.filter((r) => r.reponse !== "NSP");
  if (utiles.length === 0) return [];

  const parQuestion = new Map<string, ReponseCalcul>();
  for (const r of utiles) parQuestion.set(r.questionId, r);

  const agrege = new Map<string, { somme: number; poids: number; confiance: number; n: number }>();

  for (const p of positions) {
    const r = parQuestion.get(p.questionId);
    if (!r || r.reponse === "NSP") continue;

    const valeur = VALEURS_REPONSE[r.reponse];
    const importance = r.important ? parametres.poidsSujetImportant : 1;
    const poids = importance * p.confiance;
    if (poids === 0) continue;

    const courant = agrege.get(p.formationId) ?? { somme: 0, poids: 0, confiance: 0, n: 0 };
    courant.somme += poids * accord(valeur, p.position);
    courant.poids += poids;
    courant.confiance += p.confiance;
    courant.n += 1;
    agrege.set(p.formationId, courant);
  }

  return Array.from(agrege.entries())
    .map(([formationId, v]) => ({
      formationId,
      compatibilite: v.somme / v.poids,
      confianceMoyenne: v.confiance / v.n,
      questionsRetenues: v.n,
    }))
    .sort((a, b) => b.compatibilite - a.compatibilite);
}
