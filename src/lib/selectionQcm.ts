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
  "immigration-accueil": {
    intitule: "Quelle politique d'accueil et d'immigration ?",
    alternatives: [
      {
        id: "droits-sejour",
        libelle: "Faciliter l'accueil et sécuriser les droits de séjour",
        positions: ["lfi-sejour", "ps-sejour", "pp-immigration"],
      },
      {
        id: "selection-quotas",
        libelle: "Sélectionner davantage les entrées et fixer des quotas",
        positions: ["ren-immigration-points", "hor-quotas"],
      },
      {
        id: "restriction-peuplement",
        libelle: "Réduire fortement l'immigration et privilégier la priorité nationale",
        positions: ["rn-peuplement"],
      },
    ],
  },
  "travail-salaires": {
    intitule: "Comment augmenter les revenus du travail ?",
    alternatives: [
      {
        id: "smic-direct",
        libelle: "Relever directement le salaire minimum",
        positions: ["lfi-smic", "ps-smic", "pcf-smic", "pp-smic"],
      },
      {
        id: "net-cotisations",
        libelle: "Augmenter le revenu net par les cotisations ou les exonérations",
        positions: ["rn-salaires-2022", "ren-salaire-net", "hor-salaire-net", "lr-zero-cotisation"],
      },
    ],
  },
  "justice-peines": {
    intitule: "Quelle réponse aux délits et aux peines ?",
    alternatives: [
      {
        id: "alternatives",
        libelle: "Développer les peines alternatives et la prévention",
        positions: ["ps-peines-alternatives", "pp-peines", "ne-sanction"],
      },
      {
        id: "fermete",
        libelle: "Renforcer les peines et limiter les aménagements",
        positions: ["hor-courtes-peines", "rn-peines-planchers"],
      },
    ],
  },
  "ecole-priorite": {
    intitule: "Quelle priorité pour l'école ?",
    alternatives: [
      {
        id: "moyens",
        libelle: "Réduire les effectifs et donner davantage de moyens aux classes",
        positions: ["lfi-classes", "pp-ecole", "ren-classes"],
      },
      {
        id: "fondamentaux-autorite",
        libelle: "Renforcer les fondamentaux, l'autorité et l'autonomie des établissements",
        positions: ["rn-fondamentaux", "hor-chefs-etablissement"],
      },
    ],
  },
  "securite-police": {
    intitule: "Quelle organisation pour la sécurité ?",
    alternatives: [
      {
        id: "controle-proximite",
        libelle: "Renforcer la police de proximité et le contrôle des pratiques",
        positions: ["lfi-recepisse", "ps-police"],
      },
      {
        id: "renfort-police",
        libelle: "Augmenter les effectifs et les pouvoirs de la police municipale",
        positions: ["rn-police-municipale"],
      },
    ],
  },
  "temps-travail": {
    intitule: "Faut-il réduire ou assouplir le temps de travail ?",
    alternatives: [
      {
        id: "reduire",
        libelle: "Réduire la durée légale du travail",
        positions: ["lfi-32h"],
      },
      {
        id: "assouplir",
        libelle: "Permettre davantage d'heures supplémentaires et de souplesse",
        positions: ["lr-35h", "ren-heures-sup"],
      },
    ],
  },
  familles: {
    intitule: "Comment soutenir les familles ?",
    alternatives: [
      {
        id: "services",
        libelle: "Développer les services publics, notamment les crèches",
        positions: ["lfi-creches", "pp-creches", "ren-livret-creches"],
      },
      {
        id: "fiscalite",
        libelle: "Renforcer les aides fiscales et le quotient familial",
        positions: ["rn-part-fiscale", "hor-part-fiscale", "lr-revenu-familial"],
      },
    ],
  },
  "deficit-dette": {
    intitule: "Quelle priorité pour les finances publiques ?",
    alternatives: [
      {
        id: "investir",
        libelle: "Financer les priorités annoncées avant de réduire rapidement la dette",
        positions: ["lfi-dette-bce", "pp-dette"],
      },
      {
        id: "reduire",
        libelle: "Réduire le déficit et encadrer strictement la dépense",
        positions: ["ne-dette", "ren-deficit", "hor-regle-or"],
      },
    ],
  },
  "sante-deserts": {
    intitule: "Comment lutter contre les déserts médicaux ?",
    alternatives: [
      {
        id: "service-public",
        libelle: "Créer des structures publiques et réguler l'installation",
        positions: ["lfi-deserts", "ps-deserts"],
      },
      {
        id: "incitations",
        libelle: "Attirer les médecins par des incitations et des aides",
        positions: ["rn-deserts-2022"],
      },
    ],
  },
  logement: {
    intitule: "Faut-il encadrer les loyers ?",
    alternatives: [
      {
        id: "encadrer",
        libelle: "Encadrer les loyers pour protéger les locataires",
        positions: ["lfi-loyers", "pp-loyers"],
      },
      {
        id: "offre",
        libelle: "Agir d'abord sur l'offre et la rénovation des logements",
        positions: ["rn-logement", "lr-dpe"],
      },
    ],
  },
  "institutions-citoyens": {
    intitule: "Comment donner davantage de pouvoir aux citoyens ?",
    alternatives: [
      {
        id: "refondation",
        libelle: "Refonder les institutions par une constituante",
        positions: ["lfi-constituante"],
      },
      {
        id: "referendums",
        libelle:
          "Étendre les référendums et l'initiative citoyenne dans les institutions actuelles",
        positions: ["ps-referendum", "pp-initiative", "rn-ric"],
      },
    ],
  },
  "impots-tva": {
    intitule: "Quels produits faut-il taxer moins ?",
    alternatives: [
      {
        id: "premiere-necessite",
        libelle: "Baisser la TVA sur les produits de première nécessité",
        positions: ["lfi-tva", "ps-tva"],
      },
      {
        id: "energie-vehicules",
        libelle: "Cibler l'énergie ou certains véhicules",
        positions: ["rn-tva-2022", "ren-tva"],
      },
    ],
  },
  drogue: {
    intitule: "Quelle politique face au cannabis et au narcotrafic ?",
    alternatives: [
      {
        id: "reguler",
        libelle: "Légaliser et encadrer le cannabis",
        positions: ["lfi-cannabis", "ps-cannabis"],
      },
      {
        id: "reprimer",
        libelle: "Renforcer la répression du trafic et des réseaux",
        positions: ["pp-narcotrafic", "hor-narco"],
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
    // Chaque question doit conserver au moins deux orientations distinctes
    // après chargement. Les groupes sans citation sont retirés ci-dessus.
    const opposition = alternatives.length >= 2;
    const options = alternatives.flatMap((a) => a.options);
    if (!opposition || new Set(options.map((o) => o.formation)).size < 3) return [];
    return [{ ...q, intitule: arbitrage.intitule, options }];
  });
}
