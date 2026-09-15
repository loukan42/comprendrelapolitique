/**
 * Positions tirées des programmes, pour le comparateur et le QCM.
 *
 * Usage :
 *   node scripts/import/positions_programme.ts --db data/pg16 --verifier
 *   node scripts/import/positions_programme.ts --db data/pg16
 *
 * Les deux usages lisent la même table : un comparateur montre deux
 * formations côte à côte sur un thème, un QCM montre plusieurs formations sur
 * une même question en masquant leur origine. Le corpus doit être identique,
 * sinon les deux écrans finissent par ne plus dire la même chose.
 *
 * LA GARANTIE DE CE FICHIER.
 *
 * Chaque position est une citation, et le script la vérifie : il télécharge
 * le document source et cherche la phrase dedans. Une citation introuvable
 * n'est pas écrite en base, et le script le dit. Ce contrôle existe parce que
 * l'erreur redoutée n'est pas une faute de frappe mais une reformulation qui
 * se glisserait à la place d'une citation : elle ferait dire à un parti ce
 * qu'il n'a pas écrit, et rien dans l'affichage ne permettrait de s'en
 * apercevoir.
 *
 * La comparaison est insensible à la casse, aux accents et aux espaces
 * multiples : les programmes en ligne appliquent souvent des majuscules par
 * CSS, et le texte extrait d'une page ne reproduit pas fidèlement ses espaces.
 * Elle reste sensible aux mots, qui sont ce qui compte.
 *
 * LES QUESTIONS DU QCM.
 *
 * Une question regroupe des citations qui répondent au même sujet, une par
 * formation au plus. Le regroupement est éditorial : il est écrit ici, en
 * clair, et `--verifier` réimprime chaque question avec ses citations pour
 * qu'on puisse juger si elles se répondent vraiment. Une question qui réunit
 * moins de trois formations n'est pas servie par le QCM, parce qu'un choix
 * entre deux propositions ne compare presque rien.
 *
 * Une bonne question se lit sans connaissance préalable et ne porte que sur
 * un sujet : toutes ses réponses doivent répondre à la même chose. Quand une
 * réponse emploie un terme technique (peine plancher, DPE, part fiscale), la
 * question porte un repère factuel qui l'explique, avec sa source officielle.
 *
 * LES DOCUMENTS CITÉS.
 *
 * Pour une formation dont le candidat a publié son programme de campagne pour
 * 2027, c'est ce programme qui est cité dans le QCM. Sinon, la citation vient
 * du document le plus récent de la formation, dont la nature s'affiche avec
 * la réponse. Les citations de documents plus anciens restent dans le
 * comparateur, sans question.
 */

import { resolve } from "node:path";

import { citationPresente } from "./citations.ts";
import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface QuestionSource {
  id: string;
  theme: string;
  /** Formulation neutre : elle ne doit laisser deviner aucune réponse. */
  intitule: string;
  /**
   * Repère affiché sous la question pour comprendre les réponses : l'état du
   * droit, le sens d'un terme. Factuel, jamais un argument, et toujours avec
   * l'adresse de sa source officielle, dont `--verifier` contrôle l'accès.
   */
  contexte?: { texte: string; source: string };
}

interface PositionSource {
  id: string;
  programmeId: string;
  theme: string;
  sousTheme?: string;
  /** Question du QCM à laquelle la citation répond. Absente : comparateur seul. */
  questionId?: string;
  /** Citation exacte, vérifiée contre le document source. */
  extrait: string;
  /**
   * Formulation courte, affichée au-dessus de la citation et jamais sans
   * elle. Réservée aux citations longues, et limitée à ce que la citation
   * dit : rien n'y est ajouté.
   */
  resumeAffichage?: string;
  /**
   * Page ou section précise du document, quand elle existe. Ne pas y répéter
   * le titre du document : le comparateur affiche les deux côte à côte.
   */
  pageOuSection?: string;
}

/** Nombre de formations en dessous duquel une question n'entre pas dans le QCM. */
const MINIMUM_FORMATIONS = 3;

const QUESTIONS: QuestionSource[] = [
  {
    id: "retraites-age",
    theme: "retraites",
    intitule:
      "À quel âge, ou après combien d'années de travail, doit-on pouvoir partir à la retraite ?",
    contexte: {
      texte:
        "La réforme des retraites du 14 avril 2023 relève progressivement l'âge légal de départ. La loi de financement de la sécurité sociale pour 2026 suspend ce relèvement jusqu'en janvier 2028.",
      source:
        "https://solidarites.gouv.fr/loi-de-financement-de-la-securite-sociale-2026-les-mesures-phares",
    },
  },
  {
    id: "immigration-accueil",
    theme: "immigration",
    intitule: "Quels étrangers la France doit-elle accueillir, et à quelles conditions ?",
  },
  { id: "travail-salaires", theme: "travail", intitule: "Comment faire augmenter les salaires ?" },
  {
    id: "energie-nucleaire",
    theme: "energie",
    intitule: "Quelle place donner au nucléaire et aux énergies renouvelables ?",
  },
  {
    id: "justice-peines",
    theme: "justice",
    intitule: "Quelles peines pour les délinquants ?",
    contexte: {
      texte:
        "La loi du 10 août 2007 a introduit des peines planchers : des peines minimales en cas de récidive, auxquelles le juge pouvait déroger sous conditions.",
      source:
        "https://www.justice.gouv.fr/documentation/etudes-et-statistiques/peines-planchers-application-impact-loi-du-10-aout-2007",
    },
  },
  {
    id: "impots-patrimoine",
    theme: "impots",
    intitule: "Faut-il taxer davantage les plus grandes fortunes ?",
    contexte: {
      texte:
        "L'impôt sur la fortune en vigueur aujourd'hui, l'impôt sur la fortune immobilière (IFI), ne porte que sur les biens immobiliers.",
      source: "https://www.service-public.fr/particuliers/vosdroits/F563",
    },
  },
  { id: "ecole-priorite", theme: "education", intitule: "Quelle priorité pour l'école ?" },
  {
    id: "securite-police",
    theme: "securite",
    intitule: "Quelle priorité pour la police au quotidien ?",
  },
  {
    id: "temps-travail",
    theme: "travail",
    intitule: "Faut-il changer la règle des 35 heures par semaine ?",
    contexte: {
      texte:
        "La durée légale du travail d'un salarié à temps plein est de 35 heures par semaine. Les heures faites au-delà sont des heures supplémentaires.",
      source: "https://www.service-public.fr/particuliers/vosdroits/F1911",
    },
  },
  {
    id: "familles",
    theme: "famille",
    intitule: "Comment aider les familles qui ont des enfants ?",
    contexte: {
      texte:
        "Pour un couple, les deux premiers enfants à charge donnent chacun droit à une demi-part fiscale, et chaque enfant à partir du troisième à une part entière. À revenu égal, plus un foyer a de parts, moins il paie d'impôt sur le revenu.",
      source: "https://www.service-public.fr/particuliers/vosdroits/F2705",
    },
  },
  {
    id: "deficit-dette",
    theme: "finances",
    intitule: "Que faire de la dette et du déficit publics ?",
  },
  {
    id: "sante-deserts",
    theme: "sante",
    intitule: "Comment faire venir des médecins là où il en manque ?",
  },
  {
    id: "industrie-concurrence",
    theme: "economie",
    intitule: "Comment protéger l'industrie française de la concurrence étrangère ?",
  },
  {
    id: "logement",
    theme: "logement",
    intitule: "Quelle mesure prendre en priorité pour le logement ?",
    contexte: {
      texte:
        "Le diagnostic de performance énergétique (DPE) classe les logements selon leur consommation d'énergie et leurs émissions de gaz à effet de serre.",
      source: "https://www.service-public.fr/particuliers/vosdroits/F16096",
    },
  },
  {
    id: "institutions-citoyens",
    theme: "institutions",
    intitule: "Comment donner aux citoyens plus de poids dans les décisions ?",
  },
  { id: "impots-tva", theme: "impots", intitule: "Sur quels produits baisser la TVA ?" },
  { id: "drogue", theme: "securite", intitule: "Comment lutter contre le trafic de drogue ?" },
];

const POSITIONS: PositionSource[] = [
  // Les positions du Parti communiste français viennent de la page des dix
  // propositions du parti. La page qui portait le programme complet,
  // pcf.fr/le_programme, répond 404 depuis le 14 septembre 2026.

  // Retraites
  {
    id: "lfi-retraites",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "retraites",
    questionId: "retraites-age",
    extrait: "Rétablir la retraite à 60 ans après quarante années de cotisation",
  },
  {
    id: "rn-retraites-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "retraites",
    questionId: "retraites-age",
    extrait: "Refuser tout allongement de l’âge de départ à la retraite",
  },
  {
    id: "rn-retraites",
    programmeId: "rn-legislatives-2024",
    theme: "retraites",
    extrait:
      "Abroger la réforme des retraites de Macron et mettre en place un système de retraites progressif, qui incite les jeunes à entrer de manière précoce sur le marché du travail",
    resumeAffichage:
      "Abroger la réforme de 2023 et mettre en place un système progressif, incitant à entrer tôt sur le marché du travail",
  },
  {
    id: "ps-retraites",
    programmeId: "ps-vivre-libres",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "Après l’abrogation de la réforme Borne, convoquer une conférence sociale pour définir un nouveau système de retraite par répartition",
    resumeAffichage:
      "Abroger la réforme de 2023, puis définir un nouveau système par répartition en conférence sociale",
  },
  {
    id: "ren-retraites-cotisation",
    programmeId: "attal-travail",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "Pour augmenter le taux d’emploi des seniors, l’enjeu ne sera plus l’âge de départ à la retraite, mais la durée de cotisation",
  },
  {
    id: "ren-retraite-investissement",
    programmeId: "renaissance-conventions",
    theme: "retraites",
    sousTheme: "capitalisation",
    extrait:
      "Ce plan massif s’appuiera sur le développement de la retraite par investissement et une meilleure allocation de l’épargne des Français",
    resumeAffichage: "Développer la retraite par investissement",
  },
  {
    id: "hor-retraites",
    programmeId: "philippe-prospere",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "Garantir l'équilibre de notre système de retraites pour protéger les générations futures : travailler plus tout en prenant en compte la diversité des carrières",
  },
  {
    id: "hor-capitalisation",
    programmeId: "philippe-prospere",
    theme: "retraites",
    sousTheme: "capitalisation",
    extrait: "créer un pilier de capitalisation à 10-15 % des pensions d'ici quinze ans",
  },
  {
    id: "lr-retraites",
    programmeId: "lr-priorite-travail",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "les jeunes doivent entrer plus tôt sur le marché du travail, mais nous ne ferons pas l’économie de partir un peu plus tard à la retraite, en prenant en compte, évidemment, la pénibilité des métiers",
  },
  {
    id: "lr-seniors",
    programmeId: "lr-propositions",
    theme: "retraites",
    extrait: "Libérer le travail des seniors qui ont tous leurs trimestres",
  },
  {
    id: "ne-retraites",
    programmeId: "ne-ambition",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "La réforme des retraites : la priorité de l’augmentation de l’âge de la retraite avant la réforme d’ensemble combinant la répartition et la capitalisation",
  },

  // Énergie
  {
    id: "lfi-nucleaire",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Sortir du nucléaire : abandonner les projets d’EPR",
  },
  {
    id: "rn-nucleaire-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Relancer la filière nucléaire, hydroélectrique et investir dans la filière hydrogène",
  },
  {
    id: "rn-nucleaire",
    programmeId: "rn-legislatives-2024",
    theme: "energie",
    extrait:
      "Lancer le plan Marie Curie de relance du nucléaire (EPR, SMR, réacteurs à neutrons rapides)",
  },
  {
    id: "ps-energie",
    programmeId: "ps-vivre-libres",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      "Notre mix énergétique doit être guidé par un principe clair : le nucléaire autant que nécessaire, les énergies renouvelables autant que possible",
  },
  {
    id: "hor-energie",
    programmeId: "philippe-conquerante",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      "Assurer notre souveraineté énergétique en relançant le nucléaire, en développant les renouvelables et en électrifiant massivement nos usages",
  },
  {
    id: "lr-energie-plan",
    programmeId: "lr-energie",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Rebâtir un parc nucléaire et stopper le financement des renouvelables",
  },
  {
    id: "lr-nucleaire",
    programmeId: "lr-propositions",
    theme: "energie",
    extrait: "Inscrire le parc nucléaire dans une trajectoire « 80 ans »",
  },
  {
    id: "lr-eolien",
    programmeId: "lr-propositions",
    theme: "energie",
    extrait: "Stopper le subventionnement de nouvelles capacités éoliennes et photovoltaïques",
  },
  {
    id: "ren-nucleaire",
    programmeId: "renaissance-conventions",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      'Nous tiendrons l’objectif de construction de 14 EPR et lancerons un plan d’accélération "SMR 2030"',
  },
  {
    id: "ne-nucleaire",
    programmeId: "ne-civique",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Favoriser la production d’énergie décarbonée en s’appuyant sur le nucléaire",
  },

  // Salaires et temps de travail
  {
    id: "lfi-smic",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Porter immédiatement le SMIC mensuel à 1600 euros net et indexer les salaires sur l’inflation",
  },
  {
    id: "ps-smic",
    programmeId: "ps-vivre-libres",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Réhausser le SMIC à 1 690 € net et ouvrir une conférence sociale pour augmenter les salaires au-dessus du SMIC",
  },
  {
    id: "pcf-smic",
    programmeId: "pcf-10-propositions",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait: "Hausser le Smic (20%), augmenter les salaires et les minima sociaux",
  },
  {
    id: "rn-salaires-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Permettre aux entreprises une hausse des salaires de 10% (jusqu'à 3 smic) en exonérant cette augmentation de cotisations patronales",
  },
  {
    id: "rn-salaires",
    programmeId: "rn-legislatives-2024",
    theme: "travail",
    sousTheme: "salaires",
    extrait:
      "permettre aux entreprises d’augmenter les salaires de 10 % jusqu’à trois fois le SMIC, en les exonérant de l’augmentation des cotisations patronales pendant trois à cinq ans",
    resumeAffichage:
      "Exonérer de cotisations patronales supplémentaires, pendant trois à cinq ans, les hausses de salaire de 10 % jusqu'à trois SMIC",
  },
  {
    id: "ren-salaire-net",
    programmeId: "attal-travail",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Nous y arriverons enfin en réduisant les charges salariales pour faire monter le salaire net",
  },
  {
    id: "hor-salaire-net",
    programmeId: "philippe-prospere",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Rééquilibrer le financement du modèle social pour qu'il ne repose plus uniquement sur le travail et augmenter le salaire net des actifs",
  },
  {
    id: "lr-zero-cotisation",
    programmeId: "lr-propositions",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait: "Travailler plus et gagner plus grâce au seuil « zéro cotisation »",
  },
  {
    id: "lfi-32h",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "travail",
    sousTheme: "temps de travail",
    questionId: "temps-travail",
    extrait: "passer aux 32 heures dans les métiers pénibles ou de nuit",
  },
  {
    id: "ren-heures-sup",
    programmeId: "attal-travail",
    theme: "travail",
    sousTheme: "temps de travail",
    questionId: "temps-travail",
    extrait: "Je proposerai de supprimer le plafond d’heures supplémentaires",
  },
  {
    id: "lr-35h",
    programmeId: "lr-priorite-travail",
    theme: "travail",
    sousTheme: "temps de travail",
    questionId: "temps-travail",
    extrait:
      "Je propose que l’organisation du temps de travail soit laissée à la négociation collective dans chaque entreprise ou chaque branche, en arrêtant de se référer à une durée hebdomadaire de 35 heures",
  },
  {
    id: "ren-code-travail",
    programmeId: "attal-travail",
    theme: "travail",
    extrait:
      "Je propose que le Gouvernement, des experts et les partenaires sociaux réécrivent un code plus simple, structuré autour de quelques articles fondamentaux",
  },
  {
    id: "lr-code-travail",
    programmeId: "lr-propositions",
    theme: "travail",
    extrait:
      "Refonder le code du travail sur 50 principes, rendre le reste à la négociation collective",
  },
  {
    id: "lr-chomage",
    programmeId: "lr-propositions",
    theme: "travail",
    sousTheme: "chômage",
    extrait: "Réformer l'assurance chômage pour accélérer le retour à l'emploi",
  },

  // Impôts
  {
    id: "lfi-isf",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Rétablir et renforcer l’impôt de solidarité sur la fortune (ISF), incluant un volet climatique visant à taxer les gros pollueurs",
  },
  {
    id: "pcf-isf",
    programmeId: "pcf-10-propositions",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait: "Rétablir l’ISF, taxer les dividendes",
  },
  {
    id: "ps-zucman",
    programmeId: "ps-refaire-societe",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Instaurer la taxe Zucman de 2 % sur le patrimoine des grandes fortunes de plus de 100 millions d’euros",
  },
  {
    id: "rn-iff-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Supprimer l’IFI qui taxe l’enracinement et créer un IFF, impôt sur la fortune financière, pour taxer la spéculation",
  },
  {
    id: "rn-iff",
    programmeId: "rn-legislatives-2024",
    theme: "impots",
    extrait:
      "Remplacer l’impôt sur la fortune immobilière (IFI) qui entrave la conservation et la transmission des patrimoines et épargne de tout effort contributif les fortunes exclusivement mobilières, par un impôt sur la fortune financière (IFF)",
    resumeAffichage:
      "Remplacer l'impôt sur la fortune immobilière par un impôt sur la fortune financière",
  },
  {
    id: "hor-moratoire",
    programmeId: "philippe-prospere",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Sceller un moratoire normatif et fiscal : pas de nouvelle norme et de nouvel impôt sur le quinquennat",
  },
  {
    id: "lr-transmission",
    programmeId: "lr-propositions",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait: "Libérer la transmission du capital productif",
  },
  {
    id: "lr-prelevements",
    programmeId: "lr-propositions",
    theme: "impots",
    extrait: "Réduire franchement les prélèvements obligatoires",
  },
  {
    id: "rn-tva-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Baisser la TVA de 20% à 5.5% sur les produits énergétiques (carburants, fioul, gaz et électricité) en tant que biens de première nécessité",
  },
  {
    id: "rn-tva-energie",
    programmeId: "rn-legislatives-2024",
    theme: "impots",
    extrait: "Baisse de la TVA sur l'ensemble des produits énergétiques",
  },
  {
    id: "lfi-tva",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Réduire la TVA sur les produits de première nécessité et réinstaurer une « TVA grand luxe » pour la financer",
  },
  {
    id: "ps-tva",
    programmeId: "ps-refaire-societe",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Créer un « panier de lutte contre la précarité » regroupant les produits de première nécessité et soumis à un taux réduit et stable de TVA de 5,5 %",
  },
  {
    id: "ren-tva",
    programmeId: "renaissance-conventions",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Passer la TVA sur les véhicules électriques de 20 à 5,5% pendant 5 ans en substitution partielle de la prime",
  },

  // Finances publiques
  {
    id: "ren-deficit",
    programmeId: "attal-dette-etat",
    theme: "finances",
    questionId: "deficit-dette",
    extrait: "L’objectif est clair : zéro déficit en 10 ans maximum",
  },
  {
    id: "hor-regle-or",
    programmeId: "philippe-prospere",
    theme: "finances",
    questionId: "deficit-dette",
    extrait:
      "Inscrire dans la Constitution une règle d’or de maîtrise des déficits, et ramener le déficit de plus de 5 % à 2 % du PIB en fin de quinquennat",
  },
  {
    id: "lfi-dette-bce",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "finances",
    questionId: "deficit-dette",
    extrait:
      "Faire racheter par la BCE la dette publique qui circule sur les marchés financiers sans passer par les banques privées",
  },
  {
    id: "ne-dette",
    programmeId: "ne-destin",
    theme: "finances",
    questionId: "deficit-dette",
    extrait:
      "La France doit également s’engager vers la baisse de la dette publique par rapport au PIB",
  },

  // Immigration
  {
    id: "ren-immigration-points",
    programmeId: "attal-frontieres",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait:
      "un système à points comme au Canada, fondé sur des critères simples, une offre d’emploi stable, un logement, parler français, connaître nos valeurs et les respecter",
  },
  {
    id: "ren-immigration",
    programmeId: "renaissance-regalien",
    theme: "immigration",
    extrait:
      "nous portons une immigration de travail, avec des critères précis et l’instauration d’un permis à point",
  },
  {
    id: "hor-quotas",
    programmeId: "philippe-sure",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait:
      "Mettre en place une politique de quotas migratoires permettant de choisir notre immigration économique",
  },
  {
    id: "hor-regroupement",
    programmeId: "philippe-sure",
    theme: "immigration",
    extrait: "Restreindre l’immigration familiale",
  },
  {
    id: "hor-algerie",
    programmeId: "philippe-sure",
    theme: "immigration",
    extrait:
      "Dénoncer l’accord de 1968 avec l’Algérie pour reprendre le contrôle des flux migratoires avec ce pays",
  },
  {
    id: "rn-peuplement",
    programmeId: "rn-presidentiel-2022",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait: "Mettre fin à l’immigration de peuplement et au regroupement familial",
  },
  {
    id: "rn-regularisations",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    extrait: "Suspension de toutes les régularisations de clandestins par les préfets",
  },
  {
    id: "rn-regroupement",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    extrait:
      "Restriction du regroupement familial par le durcissement des conditions (emploi stable, ressources précisément définies, etc.)",
  },
  {
    id: "rn-droit-du-sol",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    extrait: "Suppression du droit du sol",
  },
  {
    id: "lfi-sejour",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait:
      "Faciliter l’accès aux visas, régulariser les travailleurs, étudiants, parents d’enfants scolarisés et instituer la carte de séjour de dix ans comme titre de séjour de référence",
    resumeAffichage:
      "Régulariser travailleurs, étudiants et parents d'enfants scolarisés, et faire de la carte de dix ans le titre de référence",
  },
  {
    id: "ps-sejour",
    programmeId: "ps-refaire-societe",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait:
      "Permettre l’obtention d’un titre de séjour à toute personne étrangère disposant d’un contrat de travail depuis au moins 6 mois",
  },

  // Justice
  {
    id: "hor-courtes-peines",
    programmeId: "philippe-sure",
    theme: "justice",
    questionId: "justice-peines",
    extrait:
      "Mettre en place des courtes peines en s'inspirant des pays du Nord qui condamnent dès la première infraction à une peine courte et dissuasive plutôt que d'enfermer trop tard et trop longtemps",
  },
  {
    id: "hor-jap",
    programmeId: "philippe-sure",
    theme: "justice",
    extrait:
      "Supprimer le juge d'application des peines afin de garantir que ce qu'un juge a décidé ne soit pas défait par un autre que lui",
  },
  {
    id: "rn-peines-planchers",
    programmeId: "rn-presidentiel-2022",
    theme: "justice",
    questionId: "justice-peines",
    extrait:
      "Rétablir les peines planchers pour que tout criminel et délinquant aient une sanction",
  },
  {
    id: "ps-peines-alternatives",
    programmeId: "ps-etre-en-securites",
    theme: "justice",
    questionId: "justice-peines",
    extrait: "Réviser le droit des peines pour promouvoir les peines alternatives en milieu ouvert",
  },
  {
    id: "ne-sanction",
    programmeId: "ne-ambition",
    theme: "justice",
    questionId: "justice-peines",
    extrait:
      "l’effectivité de la sanction devra être atteinte à la fois par le raccourcissement des délais de jugement, par l’augmentation des places de prison et par le recours plus effectif des peines alternatives à la prison",
  },

  // Sécurité
  {
    id: "rn-police-municipale",
    programmeId: "rn-legislatives-2024",
    theme: "securite",
    questionId: "securite-police",
    extrait:
      "Rendre obligatoire la création d’une police municipale pour les communes de plus de 10 000 habitants",
  },
  {
    id: "ps-police",
    programmeId: "ps-etre-en-securites",
    theme: "securite",
    questionId: "securite-police",
    extrait: "Reconstruire une police de proximité",
  },
  {
    id: "lfi-recepisse",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "securite",
    questionId: "securite-police",
    extrait:
      "Mettre en place le récépissé de contrôle d’identité par les forces de l’ordre pour lutter contre le contrôle au faciès",
  },
  {
    id: "hor-narco",
    programmeId: "philippe-sure",
    theme: "securite",
    sousTheme: "drogue",
    questionId: "drogue",
    extrait:
      "Créer un « état d’urgence narco » avec des moyens juridiques d’exception limités dans le temps et dans l’espace, allant jusqu’à l’utilisation ciblée de la reconnaissance faciale",
  },
  {
    id: "lfi-cannabis",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "securite",
    sousTheme: "drogue",
    questionId: "drogue",
    extrait:
      "Légaliser et encadrer par un monopole d’État la consommation, la production et la vente de cannabis à des fins récréatives",
  },
  {
    id: "ps-cannabis",
    programmeId: "ps-etre-en-securites",
    theme: "securite",
    sousTheme: "drogue",
    questionId: "drogue",
    extrait:
      "Lancer une convention citoyenne sur l’usage des drogues et la légalisation du cannabis",
  },

  // Éducation
  {
    id: "ren-classes",
    programmeId: "attal-ecole",
    theme: "education",
    questionId: "ecole-priorite",
    extrait:
      "nous devons viser moins de 20 élèves par classe comme dans les meilleurs systèmes éducatifs européens",
  },
  {
    id: "lfi-classes",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "education",
    questionId: "ecole-priorite",
    extrait:
      "Réduire partout les effectifs par classe pour faire mieux que la moyenne en Europe, qui est actuellement à 19 élèves par classe",
  },
  {
    id: "hor-chefs-etablissement",
    programmeId: "philippe-enfants",
    theme: "education",
    questionId: "ecole-priorite",
    extrait:
      "Faire des chefs d'établissements les véritables patrons de l'école : liberté d'adapter les méthodes et les horaires, d'imposer l'uniforme, de fixer les règles de discipline, de choisir et d'évaluer les enseignants",
  },
  {
    id: "rn-fondamentaux",
    programmeId: "rn-presidentiel-2022",
    theme: "education",
    questionId: "ecole-priorite",
    extrait:
      "Remettre au cœur des programmes l’enseignement du français, des mathématiques et de l’histoire",
  },

  // Famille
  {
    id: "hor-part-fiscale",
    programmeId: "philippe-enfants",
    theme: "famille",
    questionId: "familles",
    extrait:
      "Accorder une part fiscale dès le deuxième enfant pour que chaque naissance soit reconnue et soutenue par la nation, pas seulement à partir de la troisième",
  },
  {
    id: "rn-part-fiscale",
    programmeId: "rn-presidentiel-2022",
    theme: "famille",
    questionId: "familles",
    extrait: "Instituer une part fiscale complète dès le deuxième enfant",
  },
  {
    id: "ren-livret-creches",
    programmeId: "attal-travail",
    theme: "famille",
    questionId: "familles",
    extrait:
      "Je propose un nouveau livret d’épargne, sur le modèle du livret A, pour orienter l’épargne des Français vers le financement de nouvelles places en crèche",
  },
  {
    id: "lr-revenu-familial",
    programmeId: "lr-priorite-travail",
    theme: "famille",
    questionId: "familles",
    extrait:
      "Je propose la création d’un revenu familial, pour aider toutes les familles : 240 euros pour chaque enfant, quel que soit le niveau de revenus des parents",
  },
  {
    id: "lfi-creches",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "famille",
    questionId: "familles",
    extrait:
      "Planifier la création de crèches (publiques et d’entreprises publiques) et de jardins d’enfants à effectifs réduits",
  },

  // Santé
  {
    id: "ps-deserts",
    programmeId: "ps-etre-en-securites",
    theme: "sante",
    questionId: "sante-deserts",
    extrait: "Lutter contre les déserts médicaux en régulant l’installation des médecins libéraux",
  },
  {
    id: "lfi-deserts",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "sante",
    questionId: "sante-deserts",
    extrait: "Créer un réseau public de centres de santé pluridisciplinaires ou communautaires",
  },
  {
    id: "rn-deserts-2022",
    programmeId: "rn-presidentiel-2022",
    theme: "sante",
    questionId: "sante-deserts",
    extrait:
      "Agir contre les déserts médicaux grâce à des incitations financières fortes pour les soignants et augmenter le nombre de maisons de santé",
  },
  {
    id: "rn-medecine",
    programmeId: "rn-legislatives-2024",
    theme: "sante",
    extrait: "Augmenter le nombre d’étudiants en médecine (fin du numerus apertus)",
  },

  // Économie
  {
    id: "ren-chine",
    programmeId: "attal-frontieres",
    theme: "economie",
    questionId: "industrie-concurrence",
    extrait:
      "des taxes à l’importation ciblées sur les produits chinois vendus à perte (acier, voitures électriques, panneaux solaires)",
  },
  {
    id: "hor-chine",
    programmeId: "philippe-prospere",
    theme: "economie",
    questionId: "industrie-concurrence",
    extrait:
      "Protéger le marché européen face à la concurrence déloyale chinoise, en imposant transferts de technologie, quotas de production et joint-ventures dans les secteurs stratégiques",
  },
  {
    id: "rn-libre-echange",
    programmeId: "rn-presidentiel-2022",
    theme: "economie",
    questionId: "industrie-concurrence",
    extrait:
      "Protéger notre économie de la concurrence déloyale et revoir les accords de libre-échange qui ne respectent pas les intérêts de la France",
  },
  {
    id: "lfi-protectionnisme",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "economie",
    questionId: "industrie-concurrence",
    extrait:
      "L’instauration d’un protectionnisme solidaire protègera l’industrie d’une concurrence déloyale ou fondée sur le non-respect des droits humains ou l’extractivisme forcené",
  },

  // Logement
  {
    id: "lfi-loyers",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "logement",
    questionId: "logement",
    extrait: "Encadrer les loyers partout sur le territoire et à la baisse dans les grandes villes",
  },
  {
    id: "lr-dpe",
    programmeId: "lr-propositions",
    theme: "logement",
    questionId: "logement",
    extrait: "Mettre fin aux interdictions de louer liées au DPE",
  },
  {
    id: "rn-logement",
    programmeId: "rn-legislatives-2024",
    theme: "logement",
    questionId: "logement",
    extrait:
      "Instaurer une priorité d’accès au logement social pour les travailleurs des secteurs prioritaires",
  },

  // Institutions
  {
    id: "rn-ric",
    programmeId: "rn-presidentiel-2022",
    theme: "institutions",
    questionId: "institutions-citoyens",
    extrait: "Instaurer le Référendum d’Initiative Citoyenne et mettre en place la proportionnelle",
  },
  {
    id: "lfi-constituante",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "institutions",
    questionId: "institutions-citoyens",
    extrait: "Convoquer une Constituante pour passer à la 6e République",
  },
  {
    id: "ps-referendum",
    programmeId: "ps-refaire-societe",
    theme: "institutions",
    questionId: "institutions-citoyens",
    extrait:
      "Instaurer une démocratie continue et participative en facilitant l’usage du référendum grâce à l’abaissement du seuil pour le référendum d’initiative partagée (RIP) avec 1 million de signatures et la création d’un référendum d’initiative citoyenne (RIC)",
  },

  // Place publique : L'Acte I, projet du parti de Raphaël Glucksmann.
  {
    id: "pp-retraites",
    programmeId: "pp-acte-1",
    theme: "retraites",
    questionId: "retraites-age",
    extrait:
      "cesser la focalisation sur le seul âge légal qui produit l’injustice et fonder notre philosophie sur les inégalités de conditions et d’espérance de vie : certains doivent pouvoir partir à la retraite à 60 ans, d’autres devront travailler davantage",
  },
  {
    id: "pp-immigration",
    programmeId: "pp-acte-1",
    theme: "immigration",
    questionId: "immigration-accueil",
    extrait:
      "Créer des voies légales et sécurisées d’immigration de travail et passer des accords bilatéraux (au niveau français ou européen) avec les pays d’origine",
  },
  {
    id: "pp-smic",
    programmeId: "pp-acte-1",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Augmenter le SMIC à 1600 euros net dans les deux ans qui suivent notre accession au pouvoir",
  },
  {
    id: "pp-nucleaire",
    programmeId: "pp-acte-1",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      "Conforter le rôle du nucléaire, énergie pilotable et décarbonée, en assurant la sûreté des centrales existantes et la construction à temps de nouvelles unités",
  },
  {
    id: "pp-fiscalite",
    programmeId: "pp-acte-1",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Lancer un grand chantier fiscal visant à rééquilibrer la répartition de la taxation entre le travail, le capital, l’héritage et les retraites",
  },
  {
    id: "pp-dette",
    programmeId: "pp-acte-1",
    theme: "finances",
    questionId: "deficit-dette",
    extrait:
      "Assainir durablement les finances publiques par une trajectoire crédible de désendettement, pour emprunter à des conditions plus favorables et investir dans l’avenir",
  },
  {
    id: "pp-initiative",
    programmeId: "pp-acte-1",
    theme: "institutions",
    questionId: "institutions-citoyens",
    extrait:
      "Instaurer un droit d’initiative citoyenne, permettant de déclencher des séquences démocratiques avec des référendums à l’échelle locale et nationale",
  },
  {
    id: "pp-proportionnelle",
    programmeId: "pp-acte-1",
    theme: "institutions",
    extrait:
      "Instaurer immédiatement la proportionnelle, de préférence par circonscriptions régionales avec un fléchage départemental des candidats",
  },
  {
    id: "pp-narcotrafic",
    programmeId: "pp-acte-1",
    theme: "securite",
    sousTheme: "drogue",
    questionId: "drogue",
    extrait: "Muscler les moyens d’enquête contre le narcotrafic",
  },
  {
    id: "pp-commerce",
    programmeId: "pp-acte-1",
    theme: "economie",
    questionId: "industrie-concurrence",
    extrait:
      "Renforcer nos outils de défense commerciale pour activer des clauses de protection quand un secteur est menacé, sanctionner le dumping, surveiller de près les investissements étrangers dans les secteurs stratégiques",
  },
  {
    id: "pp-ecole",
    programmeId: "pp-acte-1",
    theme: "education",
    questionId: "ecole-priorite",
    extrait:
      "Réduire le nombre d’élèves par enseignant en primaire et l’expérimenter dans le second degré",
  },
  {
    id: "pp-loyers",
    programmeId: "pp-acte-1",
    theme: "logement",
    questionId: "logement",
    extrait:
      "Encadrer les loyers dans les zones en grande tension pour garantir l’accès au logement aux ménages modestes",
  },
  {
    id: "pp-peines",
    programmeId: "pp-acte-1",
    theme: "justice",
    questionId: "justice-peines",
    extrait:
      "Lutter contre la surpopulation carcérale en adaptant les peines aux profils des détenus",
  },
  {
    id: "pp-creches",
    programmeId: "pp-acte-1",
    theme: "famille",
    questionId: "familles",
    extrait: "Mettre en place un encadrement strict des crèches privées",
  },
];

/**
 * LES AXES DU COMPARATEUR.
 *
 * Pour les questions dont les réponses se rangent entre deux pôles, le
 * comparateur place chaque citation de -2 à +2 et en tire un score de
 * proximité entre formations (`src/lib/benchmarkProgrammes.ts`).
 *
 * Ce placement est une lecture du site, pas une donnée des partis : il est
 * écrit ici, en clair, citation par citation, et la page l'affiche à côté de
 * la citation qu'il résume. Les pôles sont formulés sans jugement, et aucun
 * ne correspond à « gauche » ou « droite » : sur le commerce, La France
 * insoumise et le Rassemblement National se retrouvent du même côté, parce
 * que leurs citations le disent. `--verifier` réimprime chaque axe avec les
 * formations rangées dans l'ordre, pour qu'on puisse juger le placement.
 *
 * Trois questions n'ont pas d'axe (école, institutions, TVA) : leurs réponses
 * portent sur des leviers différents, que l'on ne peut pas ordonner sans
 * inventer une hiérarchie. Elles restent dans le comparateur, sans score.
 */
const AXES: Record<string, { moins: string; plus: string }> = {
  "retraites-age": { moins: "Partir plus tôt", plus: "Travailler plus longtemps" },
  "immigration-accueil": { moins: "Ouvrir davantage", plus: "Restreindre davantage" },
  "travail-salaires": { moins: "Augmenter le SMIC par la loi", plus: "Baisser les cotisations" },
  "energie-nucleaire": { moins: "Moins de nucléaire", plus: "Plus de nucléaire" },
  "justice-peines": { moins: "Alternatives à la prison", plus: "Peines plus sévères" },
  "impots-patrimoine": { moins: "Taxer davantage", plus: "Taxer moins" },
  "securite-police": {
    moins: "Encadrer l'action de la police",
    plus: "Renforcer la présence policière",
  },
  "temps-travail": { moins: "Travailler moins", plus: "Travailler plus" },
  familles: {
    moins: "Des places d'accueil pour les enfants",
    plus: "Des aides financières aux familles",
  },
  "deficit-dette": { moins: "Ne pas en faire la priorité", plus: "Réduire vite le déficit" },
  "sante-deserts": {
    moins: "Réguler l'installation, offre publique",
    plus: "Inciter les soignants",
  },
  "industrie-concurrence": { moins: "Revoir le libre-échange", plus: "Défense commerciale ciblée" },
  logement: { moins: "Encadrer les loyers", plus: "Assouplir les règles" },
  drogue: { moins: "Légaliser et prévenir", plus: "Réprimer" },
};

/** Place de chaque citation sur l'axe de sa question, de -2 à +2. */
const ECHELLES: Record<string, -2 | -1 | 0 | 1 | 2> = {
  // Retraites : de « partir plus tôt » à « travailler plus longtemps ».
  "lfi-retraites": -2,
  "rn-retraites-2022": -1,
  "ps-retraites": -1,
  "pp-retraites": 0,
  "ren-retraites-cotisation": 0,
  "hor-retraites": 1,
  "lr-retraites": 1,
  "ne-retraites": 2,
  // Immigration.
  "lfi-sejour": -2,
  "ps-sejour": -1,
  "pp-immigration": -1,
  "ren-immigration-points": 1,
  "hor-quotas": 1,
  "rn-peuplement": 2,
  // Salaires : les deux leviers, la loi sur le SMIC ou les cotisations.
  "lfi-smic": -2,
  "ps-smic": -2,
  "pcf-smic": -2,
  "pp-smic": -2,
  "rn-salaires-2022": 1,
  "hor-salaire-net": 1,
  "ren-salaire-net": 2,
  "lr-zero-cotisation": 2,
  // Énergie.
  "lfi-nucleaire": -2,
  "ps-energie": 0,
  "pp-nucleaire": 1,
  "hor-energie": 1,
  "ne-nucleaire": 1,
  "ren-nucleaire": 2,
  "rn-nucleaire-2022": 2,
  "lr-energie-plan": 2,
  // Peines.
  "ps-peines-alternatives": -2,
  "pp-peines": -1,
  "ne-sanction": 1,
  "hor-courtes-peines": 1,
  "rn-peines-planchers": 2,
  // Patrimoine.
  "lfi-isf": -2,
  "pcf-isf": -2,
  "ps-zucman": -1,
  "pp-fiscalite": -1,
  "rn-iff-2022": 0,
  "hor-moratoire": 1,
  "lr-transmission": 2,
  // Police.
  "lfi-recepisse": -2,
  "ps-police": 1,
  "rn-police-municipale": 2,
  // Temps de travail.
  "lfi-32h": -2,
  "ren-heures-sup": 1,
  "lr-35h": 2,
  // Familles.
  "lfi-creches": -2,
  "pp-creches": -1,
  "ren-livret-creches": -1,
  "hor-part-fiscale": 1,
  "rn-part-fiscale": 2,
  "lr-revenu-familial": 2,
  // Dette et déficit.
  "lfi-dette-bce": -2,
  "pp-dette": 0,
  "ne-dette": 1,
  "ren-deficit": 1,
  "hor-regle-or": 2,
  // Déserts médicaux.
  "ps-deserts": -2,
  "lfi-deserts": -1,
  "rn-deserts-2022": 2,
  // Commerce.
  "rn-libre-echange": -2,
  "lfi-protectionnisme": -2,
  "pp-commerce": 1,
  "ren-chine": 1,
  "hor-chine": 1,
  // Logement.
  "lfi-loyers": -2,
  "pp-loyers": -1,
  "rn-logement": 0,
  "lr-dpe": 2,
  // Drogue.
  "lfi-cannabis": -2,
  "ps-cannabis": -1,
  "pp-narcotrafic": 1,
  "hor-narco": 2,
};

const MIGRATION = resolve("db/migrations/006_programmes.sql");
const MIGRATION_QUESTIONS = resolve("db/migrations/008_programme_questions.sql");

interface Controle {
  p: PositionSource;
  url: string | null;
  formation: string | null;
  trouvee: boolean;
}

async function controler(db: Db): Promise<Controle[]> {
  const resultats: Controle[] = [];
  for (const p of POSITIONS) {
    const [prog] = await db.query<{ url: string | null; formation: string }>(
      `SELECT url, formation FROM enrichissement.programme WHERE id = $1`,
      [p.programmeId],
    );
    if (!prog?.url) {
      resultats.push({ p, url: null, formation: prog?.formation ?? null, trouvee: false });
      continue;
    }
    const trouvee = await citationPresente(prog.url, p.extrait);
    resultats.push({ p, url: prog.url, formation: prog.formation, trouvee });
  }
  return resultats;
}

/**
 * Contrôles de cohérence du corpus, indépendants du réseau. Une erreur ici
 * arrête le script avant toute écriture : ce sont des fautes de saisie, pas
 * des aléas de source.
 */
function erreursDeStructure(resultats: Controle[]): string[] {
  const erreurs: string[] = [];
  const idsQuestions = new Set(QUESTIONS.map((q) => q.id));

  const ids = new Set<string>();
  for (const { p } of resultats) {
    if (ids.has(p.id)) erreurs.push(`identifiant en double : ${p.id}`);
    ids.add(p.id);
    if (p.questionId && !idsQuestions.has(p.questionId)) {
      erreurs.push(`${p.id} renvoie à une question inconnue : ${p.questionId}`);
    }
    const question = QUESTIONS.find((q) => q.id === p.questionId);
    if (question && question.theme !== p.theme) {
      erreurs.push(`${p.id} est rangée sous ${p.theme}, sa question sous ${question.theme}`);
    }
  }

  // Deux citations d'une même formation sur une même question fausseraient
  // le QCM : la formation y aurait deux chances d'être choisie.
  const vues = new Map<string, string>();
  for (const r of resultats) {
    if (!r.p.questionId || !r.formation) continue;
    const cle = `${r.p.questionId}|${r.formation}`;
    const autre = vues.get(cle);
    if (autre) {
      erreurs.push(`${r.formation} a deux citations sur ${r.p.questionId} : ${autre}, ${r.p.id}`);
    }
    vues.set(cle, r.p.id);
  }
  // Une question à axe doit placer toutes ses citations, une question sans
  // axe n'en placer aucune : un score calculé sur un axe à moitié rempli
  // favoriserait les formations placées.
  for (const id of Object.keys(AXES)) {
    if (!idsQuestions.has(id)) erreurs.push(`axe pour une question inconnue : ${id}`);
  }
  for (const id of Object.keys(ECHELLES)) {
    const p = POSITIONS.find((x) => x.id === id);
    if (!p) erreurs.push(`place sur un axe pour une citation inconnue : ${id}`);
    else if (!p.questionId || !AXES[p.questionId]) erreurs.push(`${id} est placée hors d'un axe`);
  }
  for (const { p } of resultats) {
    if (p.questionId && AXES[p.questionId] && ECHELLES[p.id] === undefined) {
      erreurs.push(`${p.id} n'est pas placée sur l'axe de ${p.questionId}`);
    }
  }

  return erreurs;
}

/** Formations dont une citation vérifiée répond à chaque question. */
function couverture(resultats: Controle[]): Map<string, Controle[]> {
  const parQuestion = new Map<string, Controle[]>(QUESTIONS.map((q) => [q.id, []]));
  for (const r of resultats) {
    if (r.p.questionId && r.trouvee) parQuestion.get(r.p.questionId)?.push(r);
  }
  return parQuestion;
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: positions_programme.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement'
                       AND table_name = 'programme_position') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 006 appliquée");
  }
  // Idempotente : rejouée à chaque passage, elle ajoute la table des
  // questions aux bases créées avant elle.
  await appliquerMigration(db, MIGRATION_QUESTIONS);

  const resultats = await controler(db);
  const erreurs = erreursDeStructure(resultats);
  const parQuestion = couverture(resultats);

  if (args.includes("--verifier")) {
    for (const r of resultats) {
      const etat = r.trouvee ? "CITATION TROUVEE  " : "INTROUVABLE       ";
      console.log(`${etat} ${r.p.id.padEnd(28)} ${r.p.theme.padEnd(12)} « ${r.p.extrait} »`);
      if (!r.trouvee) console.log(`                   source : ${r.url ?? "aucune URL"}`);
    }
    const ok = resultats.filter((r) => r.trouvee).length;
    console.log(`\n${ok} citations vérifiées sur ${resultats.length}`);

    // Réimpression par question : c'est là qu'on juge si les citations
    // réunies se répondent vraiment, ce qu'aucun contrôle automatique ne sait
    // faire.
    console.log("\nQuestions du QCM");
    for (const q of QUESTIONS) {
      const dedans = parQuestion.get(q.id) ?? [];
      const servie = dedans.length >= MINIMUM_FORMATIONS ? "servie   " : "ÉCARTÉE  ";
      console.log(`\n  ${servie} ${q.intitule} (${dedans.length} formations)`);
      if (q.contexte) {
        const code = await fetch(q.contexte.source, { signal: AbortSignal.timeout(20000) })
          .then((r) => r.status)
          .catch(() => "échec");
        console.log(`            repère (${code}) : ${q.contexte.texte}`);
      }
      for (const r of dedans) console.log(`            ${r.formation} : « ${r.p.extrait} »`);
    }

    console.log("\nAxes du comparateur (lecture du site, de -2 à +2)");
    for (const q of QUESTIONS) {
      const axe = AXES[q.id];
      if (!axe) continue;
      console.log(`\n  ${q.intitule}\n  -2 ${axe.moins}  ←→  +2 ${axe.plus}`);
      const rangees = [...(parQuestion.get(q.id) ?? [])].sort(
        (x, y) => (ECHELLES[x.p.id] ?? 0) - (ECHELLES[y.p.id] ?? 0),
      );
      for (const r of rangees) {
        console.log(`   ${String(ECHELLES[r.p.id] ?? "?").padStart(2)}  ${r.formation}`);
      }
    }

    for (const e of erreurs) console.error(`ERREUR ${e}`);
    await db.close();
    return;
  }

  if (erreurs.length > 0) {
    for (const e of erreurs) console.error(`ERREUR ${e}`);
    await db.close();
    process.exit(1);
  }

  await db.transaction(async () => {
    await db.query(`DELETE FROM enrichissement.programme_position`);
    await db.query(`DELETE FROM enrichissement.programme_question`);
    for (const [ordre, q] of QUESTIONS.entries()) {
      await db.query(
        `INSERT INTO enrichissement.programme_question
           (id, theme, intitule, ordre, contexte, source_contexte, axe_moins, axe_plus)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          q.id,
          q.theme,
          q.intitule,
          ordre + 1,
          q.contexte?.texte ?? null,
          q.contexte?.source ?? null,
          AXES[q.id]?.moins ?? null,
          AXES[q.id]?.plus ?? null,
        ],
      );
    }
    for (const r of resultats) {
      if (!r.trouvee) {
        console.error(`Citation introuvable dans la source, position ignorée : ${r.p.id}`);
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.programme_position
           (id, programme_id, theme, sous_theme, question_id, extrait, resume_affichage,
            page_ou_section, url_ancre, echelle)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          r.p.id,
          r.p.programmeId,
          r.p.theme,
          r.p.sousTheme ?? null,
          r.p.questionId ?? null,
          r.p.extrait,
          r.p.resumeAffichage ?? null,
          r.p.pageOuSection ?? null,
          r.url,
          ECHELLES[r.p.id] ?? null,
        ],
      );
    }
  });

  const ecrites = resultats.filter((r) => r.trouvee).length;
  const servies = [...parQuestion.values()].filter((d) => d.length >= MINIMUM_FORMATIONS).length;
  console.log(
    `${ecrites} positions écrites sur ${resultats.length}, ` +
      `${servies} questions du QCM sur ${QUESTIONS.length} réunissent au moins ${MINIMUM_FORMATIONS} formations`,
  );
  await db.close();
}

await main();
