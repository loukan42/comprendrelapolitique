import type { OptionQcm, QuestionQcm } from "./qcmProgrammes";

interface Alternative {
  id: string;
  libelle: string;
  positions: string[];
}

/** Regroupement éditorial sur une décision précise, jamais sur une proximité lexicale.
 * Les citations intégrales restent visibles : partager une orientation ne signifie
 * pas proposer les mêmes modalités. Les sujets aux mesures cumulables sont écartés.
 */
const ARBITRAGES: Record<string, { intitule: string; alternatives: Alternative[] }> = {
  "retraites-age": {
    intitule: "Quelle orientation pour l'âge de départ à la retraite ?",
    alternatives: [
      {
        id: "recul-refuse",
        libelle: "Revenir sur le relèvement de l'âge ou permettre un départ plus tôt",
        positions: ["lfi-retraites", "rn-retraites-2022", "ps-retraites"],
      },
      {
        id: "carrieres",
        libelle: "Différencier les départs selon les carrières et les conditions de vie",
        positions: ["pp-retraites"],
      },
      {
        id: "recul",
        libelle: "Travailler plus longtemps avant la retraite",
        positions: ["hor-retraites", "lr-retraites", "ne-retraites"],
      },
    ],
  },
  "energie-nucleaire": {
    intitule: "Faut-il sortir du nucléaire ou en poursuivre le développement ?",
    alternatives: [
      {
        id: "sortie",
        libelle: "Sortir du nucléaire et abandonner les nouveaux EPR",
        positions: ["lfi-nucleaire"],
      },
      {
        id: "mix",
        libelle: "Conserver le nucléaire dans un mix avec les renouvelables",
        positions: ["ps-energie", "hor-energie"],
      },
      {
        id: "developper",
        libelle: "S'appuyer sur le nucléaire ou construire de nouveaux réacteurs",
        positions: ["rn-nucleaire-2022", "pp-nucleaire", "ren-nucleaire", "ne-nucleaire"],
      },
      {
        id: "financement",
        libelle: "Rebâtir le parc nucléaire et arrêter le financement des renouvelables",
        positions: ["lr-energie-plan"],
      },
    ],
  },
  "impots-patrimoine": {
    intitule: "Faut-il créer ou rétablir un impôt sur les grandes fortunes ?",
    alternatives: [
      {
        id: "isf",
        libelle: "Rétablir l'impôt de solidarité sur la fortune",
        positions: ["lfi-isf", "pcf-isf"],
      },
      {
        id: "zucman",
        libelle: "Instaurer une taxe sur les plus grandes fortunes",
        positions: ["ps-zucman"],
      },
      {
        id: "iff",
        libelle: "Remplacer l'impôt immobilier par un impôt sur la fortune financière",
        positions: ["rn-iff-2022"],
      },
      {
        id: "moratoire",
        libelle: "Ne créer aucun nouvel impôt pendant le quinquennat",
        positions: ["hor-moratoire"],
      },
    ],
  },
};

export interface AlternativeQcm {
  id: string;
  libelle: string;
  options: OptionQcm[];
}

export function alternativesQuestion(question: QuestionQcm): AlternativeQcm[] {
  return (ARBITRAGES[question.id]?.alternatives ?? [])
    .map((a) => ({
      id: a.id,
      libelle: a.libelle,
      options: question.options.filter((o) => a.positions.includes(o.positionId)),
    }))
    .filter((a) => a.options.length > 0);
}

export function selectionnerQuestions(questions: QuestionQcm[]): QuestionQcm[] {
  return questions.flatMap((q) => {
    const arbitrage = ARBITRAGES[q.id];
    if (!arbitrage) return [];
    const alternatives = alternativesQuestion(q);
    const ids = new Set(alternatives.map((a) => a.id));
    // Chaque question doit conserver les deux orientations opposées après chargement.
    const opposition =
      q.id === "retraites-age"
        ? ids.has("recul-refuse") && ids.has("recul")
        : q.id === "energie-nucleaire"
          ? ids.has("sortie") && (ids.has("developper") || ids.has("financement"))
          : ids.has("moratoire") && (ids.has("isf") || ids.has("zucman"));
    const options = alternatives.flatMap((a) => a.options);
    if (!opposition || new Set(options.map((o) => o.formation)).size < 3) return [];
    return [{ ...q, intitule: arbitrage.intitule, options }];
  });
}
