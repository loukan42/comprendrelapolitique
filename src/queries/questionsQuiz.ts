/**
 * Formulation vulgarisée des questions de quiz (spécification section 10,
 * méthodologie QUIZ_METHODOLOGY.md section 2.2) : une question compréhensible
 * sans jargon, se terminant par un point d'interrogation, permettant à
 * quelqu'un qui ne suit pas la politique de se positionner « pour » ou
 * « contre » sans avoir à déchiffrer un intitulé administratif.
 *
 * Chaque entrée est rattachée à un `dossier_uid` réel et reformule le
 * contenu du texte tel que décrit par son titre officiel et son
 * `objet_libelle` (`officiel.scrutin`), sans ajouter de disposition qui n'y
 * figure pas. Rédigé à la main plutôt que généré à la volée : la
 * méthodologie l'exige (« la formulation peut être proposée par l'IA mais
 * doit être relue par un humain avant publication »), et une reformulation
 * automatique de plusieurs centaines de titres hétérogènes ne peut pas
 * garantir cette fidélité.
 *
 * Une question de quiz qui n'a pas encore de fiche ici retombe sur le
 * libellé officiel transformé en question (voir `formulerQuestion` dans
 * `quiz.ts`) : moins lisible, mais jamais un texte inventé.
 */

export interface FormulationQuestion {
  question: string;
  contexte: string;
}

export const QUESTIONS_VULGARISEES: Record<string, FormulationQuestion> = {
  DLR5L16N47411: {
    question:
      "Faut-il mettre fin à l'obligation vaccinale contre la Covid-19 pour les professionnels de santé ?",
    contexte:
      "Ce texte supprime l'obligation vaccinale contre la Covid-19 imposée aux professionnels de santé et médico-sociaux, et permet à celles et ceux suspendus pour ne pas l'avoir respectée de reprendre leur poste.",
  },
  DLR5L15N44665: {
    question:
      "Faut-il obliger les plateformes en ligne à retirer rapidement les contenus à caractère terroriste ?",
    contexte:
      "Ce texte adapte le droit français à une règle européenne imposant aux hébergeurs de retirer les contenus faisant l'apologie du terrorisme en ligne.",
  },
  DLR5L16N46858: {
    question: "Faut-il garantir un repas à un euro pour tous les étudiants ?",
    contexte:
      "Ce texte élargit à tous les étudiants, quelle que soit leur situation, l'accès à un repas au tarif social d'un euro dans les restaurants universitaires.",
  },
  DLR5L16N46472: {
    question:
      "Faut-il calculer la retraite des agriculteurs non-salariés sur leurs 25 meilleures années de revenus, comme pour les salariés ?",
    contexte:
      "Aujourd'hui, la retraite de base des agriculteurs non-salariés se calcule sur l'ensemble de leur carrière. Ce texte propose de ne retenir que leurs 25 meilleures années, comme c'est déjà le cas pour les salariés.",
  },
  DLR5L16N48163: {
    question:
      "Faut-il conditionner le versement du RSA à des heures d'activité, comme la recherche d'emploi ou une formation ?",
    contexte:
      "Ce texte transforme Pôle emploi en France Travail et introduit une obligation d'activité (recherche d'emploi, formation) pour les bénéficiaires du RSA.",
  },
  DLR5L16N46484: {
    question:
      "Faut-il accélérer les procédures d'expulsion des squatteurs et renforcer les sanctions contre l'occupation illégale d'un logement ?",
    contexte:
      "Ce texte renforce les sanctions contre l'occupation illégale d'un logement et simplifie la procédure d'expulsion des squatteurs.",
  },
  DLR5L16N47118: {
    question:
      "Faut-il faciliter l'expulsion des étrangers en situation irrégulière ayant commis des infractions graves, tout en simplifiant la régularisation dans les métiers en tension ?",
    contexte:
      "Ce texte modifie les règles de séjour et d'expulsion des étrangers : il facilite l'éloignement de personnes condamnées pour des faits graves et crée une voie de régularisation temporaire dans les métiers en tension.",
  },
  DLR5L16N47779: {
    question:
      "Faut-il augmenter les moyens humains et budgétaires de la justice sur la période 2023-2027 ?",
    contexte:
      "Ce texte fixe la trajectoire budgétaire et les objectifs de réforme du ministère de la Justice pour la période 2023 à 2027 (recrutements, numérisation, simplification des procédures).",
  },
  DLR5L16N49364: {
    question:
      "Faut-il renforcer les obligations environnementales imposées à l'industrie textile ?",
    contexte:
      "Ce texte impose de nouvelles obligations aux fabricants et vendeurs de vêtements pour réduire l'impact environnemental de l'industrie textile.",
  },
  DLR5L16N46622: {
    question:
      "Faut-il simplifier les procédures administratives pour construire de nouveaux réacteurs nucléaires à côté de centrales existantes ?",
    contexte:
      "Ce texte simplifie les démarches administratives pour construire de nouvelles installations nucléaires sur des sites qui en accueillent déjà.",
  },
  DLR5L16N48766: {
    question:
      "Faut-il plafonner les marges des industries agroalimentaires et de la grande distribution pour lutter contre l'inflation ?",
    contexte:
      "Ce texte encadre les marges des industries agroalimentaires, du raffinage et de la grande distribution, et fixe un prix d'achat plancher pour les matières premières agricoles.",
  },
  DLR5L16N47719: {
    question:
      "Faut-il approuver ces accords avec le Danemark et la Grèce pour éviter la double imposition des revenus ?",
    contexte:
      "Ce texte approuve deux conventions fiscales bilatérales visant à éviter qu'un même revenu soit imposé deux fois, en France et dans l'autre pays, et à lutter contre la fraude fiscale.",
  },
  DLR5L16N47218: {
    question:
      "Faut-il aider davantage les Français à accéder à une alimentation saine face à la hausse des prix ?",
    contexte:
      "Ce texte vise à soutenir l'accès à une alimentation saine et de qualité dans un contexte de hausse des prix alimentaires.",
  },
  DLR5L16N47443: {
    question:
      "Faut-il rendre obligatoire l'affichage du drapeau français et du drapeau européen sur la façade des mairies ?",
    contexte:
      "Ce texte impose à toutes les communes d'apposer les drapeaux français et européen sur le fronton de leur mairie.",
  },
  DLR5L16N49373: {
    question:
      "Faut-il élargir le corps électoral pour les élections provinciales en Nouvelle-Calédonie ?",
    contexte:
      "Ce texte modifie la Constitution pour ouvrir le droit de vote aux élections provinciales de Nouvelle-Calédonie aux résidents arrivés depuis au moins dix ans, actuellement exclus du corps électoral.",
  },
  DLR5L16N46346: {
    question:
      "Faut-il approuver la trajectoire budgétaire de l'État prévue jusqu'en 2027, avec un objectif de réduction du déficit public ?",
    contexte:
      "Ce texte fixe les grandes orientations budgétaires de l'État pour les années 2023 à 2027 : évolution des dépenses publiques, objectif de réduction du déficit.",
  },
  DLR5L16N46269: {
    question:
      "Faut-il augmenter les moyens humains, matériels et budgétaires de la police et de la gendarmerie ?",
    contexte:
      "Ce texte fixe la trajectoire budgétaire du ministère de l'Intérieur pour les années à venir : recrutements, équipements, numérisation des procédures.",
  },
  DLR5L16N46539: {
    question:
      "Faut-il accélérer les procédures administratives pour développer l'énergie solaire et éolienne ?",
    contexte:
      "Ce texte simplifie et accélère les démarches administratives nécessaires à la construction d'installations de production d'énergies renouvelables (solaire, éolien).",
  },
  DLR5L16N49124: {
    question:
      "Faut-il réorganiser les autorités de contrôle de la sûreté nucléaire pour accompagner la relance de la filière ?",
    contexte:
      "Ce texte réorganise la gouvernance de la sûreté nucléaire et de la radioprotection (fusion des autorités de contrôle) dans le cadre de la relance de la filière nucléaire.",
  },
};
