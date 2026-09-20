/** Recensement éditorial du programme de 2012, sans verdict sur son exécution.
 * Les pages imprimées diffèrent des pages du PDF, qui contient des doubles pages.
 * Chaque résumé couvre le numéro entier ; une évaluation peut n'en couvrir qu'un volet.
 */
export const SOURCE_HOLLANDE = {
  titre: "Mes 60 engagements pour la France",
  auteur: "François Hollande, programme présidentiel de 2012",
  archive: "Les Jours",
  url: "https://lesjours.fr/ressources/document/propositions-hollande/Soixante-engagements-Franc%CC%A7ois-Hollande-V2.pdf",
  consulteLe: "2026-09-16",
  mandatId: "hollande-2012-2017",
};

export interface EngagementProgramme {
  numero: number;
  theme: string;
  titre: string;
  resume: string;
  pages: string;
  pagePdf: number;
}

// Résumés du site, et non citations. Les montants sont les objectifs annoncés.
export const PROGRAMME_HOLLANDE: EngagementProgramme[] = [
  {
    numero: 1,
    theme: "Économie",
    titre: "Banque publique d’investissement",
    resume:
      "Créer une banque publique d’investissement avec des fonds régionaux pour les PME, les entreprises stratégiques et l’économie sociale et solidaire.",
    pages: "7",
    pagePdf: 5,
  },
  {
    numero: 2,
    theme: "Économie",
    titre: "Financement et accompagnement des PME",
    resume:
      "Créer un livret d’épargne industrie, porter le plafond du livret développement durable à 12 000 euros, simplifier l’accès au crédit d’impôt recherche et à la commande publique, avec un interlocuteur régional unique.",
    pages: "7",
    pagePdf: 5,
  },
  {
    numero: 3,
    theme: "Économie",
    titre: "Production en France et fiscalité des entreprises",
    resume:
      "Orienter les aides vers l’investissement et l’emploi en France, favoriser les relocalisations et récupérer les aides en cas de délocalisation. Différencier les bénéfices réinvestis et distribués, avec des taux d’impôt sur les sociétés de 35 %, 30 % et 15 % selon la taille.",
    pages: "8",
    pagePdf: 6,
  },
  {
    numero: 4,
    theme: "Numérique",
    titre: "Couverture du territoire en très haut débit",
    resume:
      "Organiser avec les collectivités et l’industrie une couverture intégrale du pays en très haut débit dans les dix ans.",
    pages: "8",
    pagePdf: 6,
  },
  {
    numero: 5,
    theme: "Services publics",
    titre: "Statut public des entreprises et protection européenne",
    resume:
      "Maintenir le statut public des entreprises majoritairement détenues par l’État et demander une directive européenne de protection des services publics.",
    pages: "9",
    pagePdf: 6,
  },
  {
    numero: 6,
    theme: "Agriculture",
    titre: "Agriculture, ruralité et économie maritime",
    resume:
      "Défendre le budget agricole européen, soutenir l’agriculture biologique et l’organisation des producteurs face à la distribution, maintenir les services publics ruraux, moderniser la pêche et développer les énergies marines.",
    pages: "9",
    pagePdf: 6,
  },
  {
    numero: 7,
    theme: "Finance",
    titre: "Régulation et fiscalité des banques",
    resume:
      "Séparer les activités bancaires utiles à l’économie des opérations spéculatives, interdire l’activité dans les paradis fiscaux et les produits toxiques, encadrer les bonus et supprimer les stock-options hors entreprises naissantes. Augmenter de 15 % l’imposition des bénéfices bancaires, proposer une taxe sur les transactions et une agence publique européenne de notation.",
    pages: "10",
    pagePdf: 7,
  },
  {
    numero: 8,
    theme: "Finance",
    titre: "Épargne populaire, frais bancaires et crédit",
    resume:
      "Fixer une rémunération du livret A supérieure à l’inflation, liée à la croissance, plafonner les frais bancaires par la loi et encadrer le crédit à la consommation.",
    pages: "10",
    pagePdf: 7,
  },
  {
    numero: 9,
    theme: "Finances publiques",
    titre: "Déficit public et équilibre budgétaire",
    resume:
      "Ramener le déficit public à 3 % du PIB en 2013, puis à l’équilibre en fin de mandat. Revenir sur des avantages et niches fiscales pour obtenir 29 milliards d’euros de recettes supplémentaires.",
    pages: "11",
    pagePdf: 7,
  },
  {
    numero: 10,
    theme: "Services publics",
    titre: "Fonction publique et révision des politiques publiques",
    resume:
      "Arrêter la RGPP et le non-remplacement automatique d’un fonctionnaire sur deux. Ouvrir en 2012 une concertation syndicale sur les salaires, la précarité, les nominations et les carrières.",
    pages: "11",
    pagePdf: 7,
  },
  {
    numero: 11,
    theme: "Europe",
    titre: "Traité européen, croissance et gouvernance",
    resume:
      "Renégocier le traité issu de l’accord du 9 décembre 2011, réorienter le rôle de la BCE vers la croissance et l’emploi, proposer des euro-obligations, associer les parlements et proposer un nouveau traité franco-allemand.",
    pages: "12",
    pagePdf: 8,
  },
  {
    numero: 12,
    theme: "Europe",
    titre: "Budget européen et investissements",
    resume:
      "Défendre un budget européen 2014-2020 orienté vers les projets industriels, les technologies vertes, le fret ferroviaire et une coopération européenne sur l’énergie.",
    pages: "12 et 13",
    pagePdf: 8,
  },
  {
    numero: 13,
    theme: "Europe",
    titre: "Commerce international et système monétaire",
    resume:
      "Imposer une réciprocité sociale et environnementale dans les échanges, instaurer une contribution climat-énergie aux frontières européennes et agir au G20 sur les parités monétaires.",
    pages: "13",
    pagePdf: 8,
  },
  {
    numero: 14,
    theme: "Fiscalité",
    titre: "Rapprochement de l’impôt sur le revenu et de la CSG",
    resume:
      "Fusionner à terme l’impôt sur le revenu et la CSG dans un prélèvement simplifié, en affecter une partie à la sécurité sociale et imposer les revenus du capital comme ceux du travail.",
    pages: "15",
    pagePdf: 9,
  },
  {
    numero: 15,
    theme: "Fiscalité",
    titre: "Tranche à 45 % et plafond des niches fiscales",
    resume:
      "Créer une tranche d’impôt de 45 % au-dessus de 150 000 euros par part et limiter à 10 000 euros par an la réduction d’impôt obtenue par les niches fiscales.",
    pages: "15",
    pagePdf: 9,
  },
  {
    numero: 16,
    theme: "Famille",
    titre: "Ressources de la politique familiale",
    resume:
      "Maintenir les ressources de la politique familiale, augmenter de 25 % l’allocation de rentrée dès 2012 et abaisser le plafond du quotient familial pour les ménages les plus aisés, en visant moins de 5 % des foyers fiscaux.",
    pages: "15",
    pagePdf: 9,
  },
  {
    numero: 17,
    theme: "Fiscalité",
    titre: "Patrimoine, successions et fraude fiscale",
    resume:
      "Revenir sur les allégements d’ISF de 2011, ramener l’abattement successoral à 100 000 euros par enfant, maintenir l’exonération du conjoint survivant et renforcer la lutte contre la fraude.",
    pages: "15 et 16",
    pagePdf: 9,
  },
  {
    numero: 18,
    theme: "Retraites",
    titre: "Retraite à 60 ans, réforme des retraites et dépendance",
    resume:
      "Rétablir immédiatement le taux plein à 60 ans pour ceux ayant cotisé toutes leurs annuités. Négocier dès l’été 2012 l’âge légal, la pénibilité, les pensions et le financement, et réformer l’accompagnement de la perte d’autonomie.",
    pages: "16",
    pagePdf: 10,
  },
  {
    numero: 19,
    theme: "Santé",
    titre: "Hôpital, répartition des médecins et urgences",
    resume:
      "Réformer la tarification hospitalière, développer des pôles de santé de proximité, fixer un accès aux urgences en une demi-heure au maximum et augmenter la rémunération forfaitaire des généralistes.",
    pages: "17",
    pagePdf: 10,
  },
  {
    numero: 20,
    theme: "Santé",
    titre: "Coût des soins et aide médicale d’État",
    resume:
      "Encadrer les dépassements d’honoraires, favoriser la baisse du prix des médicaments et supprimer le droit d’entrée dans l’aide médicale d’État.",
    pages: "17",
    pagePdf: 10,
  },
  {
    numero: 21,
    theme: "Santé",
    titre: "Assistance médicalisée en fin de vie",
    resume:
      "Permettre sous conditions strictes une assistance médicalisée pour terminer la vie des adultes atteints d’une maladie incurable avancée ou terminale avec des souffrances insupportables qui ne peuvent être apaisées.",
    pages: "18",
    pagePdf: 11,
  },
  {
    numero: 22,
    theme: "Logement",
    titre: "Loyers, construction et logement social",
    resume:
      "Encadrer les loyers excessifs à la location ou relocation et créer une caution pour les jeunes. Viser 2,5 millions de logements sur le mandat, dont 150 000 très sociaux, doubler le plafond du livret A, quintupler les sanctions SRU, porter l’exigence sociale à 25 % et imposer une répartition des constructions par tiers.",
    pages: "18 et 19",
    pagePdf: 11,
  },
  {
    numero: 23,
    theme: "Logement",
    titre: "Terrains de l’État pour construire",
    resume:
      "Mettre gratuitement les terrains disponibles de l’État à disposition des collectivités pour construire des logements dans les cinq ans.",
    pages: "19",
    pagePdf: 11,
  },
  {
    numero: 24,
    theme: "Travail",
    titre: "Emplois précaires et notation sociale des entreprises",
    resume:
      "Augmenter les cotisations chômage des entreprises abusant de l’emploi précaire et imposer une certification annuelle de la gestion sociale aux entreprises de plus de 500 salariés.",
    pages: "19",
    pagePdf: 11,
  },
  {
    numero: 25,
    theme: "Travail",
    titre: "Égalité professionnelle entre femmes et hommes",
    resume:
      "Sanctionner par la loi les inégalités de carrière et de rémunération, notamment par la suppression d’exonérations de cotisations sociales.",
    pages: "20",
    pagePdf: 12,
  },
  {
    numero: 26,
    theme: "Économie",
    titre: "Rémunérations dans les entreprises publiques",
    resume:
      "Limiter à un rapport de 1 à 20 les écarts de rémunération pour les dirigeants des entreprises publiques.",
    pages: "20",
    pagePdf: 12,
  },
  {
    numero: 27,
    theme: "Territoires",
    titre: "Renouvellement urbain et services dans les quartiers",
    resume:
      "Lancer de nouvelles opérations de rénovation urbaine et de cohésion sociale, maintenir les services publics dans les banlieues, renforcer les moyens scolaires et rétablir une présence policière régulière au contact des habitants.",
    pages: "20",
    pagePdf: 12,
  },
  {
    numero: 28,
    theme: "Transports",
    titre: "Trains du quotidien et territoires enclavés",
    resume:
      "Donner la priorité à la qualité des trains du quotidien et à la desserte des territoires enclavés, en Île-de-France et dans les autres régions.",
    pages: "21",
    pagePdf: 12,
  },
  {
    numero: 29,
    theme: "Outre-mer",
    titre: "Investissements, emploi et coût de la vie outre-mer",
    resume:
      "Investir et soutenir l’emploi et la formation des jeunes, combattre les monopoles et marges abusives, créer un ministère rattaché au Premier ministre et une cité de l’outre-mer en Île-de-France.",
    pages: "21",
    pagePdf: 12,
  },
  {
    numero: 30,
    theme: "Société",
    titre: "Contrôles d’identité et discriminations",
    resume:
      "Réformer la procédure des contrôles d’identité pour combattre le délit de faciès, agir contre les discriminations à l’embauche et au logement, le racisme et l’antisémitisme.",
    pages: "21",
    pagePdf: 12,
  },
  {
    numero: 31,
    theme: "Société",
    titre: "Mariage et adoption pour les couples de même sexe",
    resume: "Ouvrir aux couples de même sexe les droits au mariage et à l’adoption.",
    pages: "22",
    pagePdf: 13,
  },
  {
    numero: 32,
    theme: "Handicap",
    titre: "Handicap dans la loi et dans l’emploi",
    resume:
      "Inclure un volet handicap dans chaque loi et renforcer les sanctions pour non-respect du quota de 6 % de travailleurs handicapés dans les entreprises et les administrations.",
    pages: "22",
    pagePdf: 13,
  },
  {
    numero: 33,
    theme: "Emploi",
    titre: "Contrat de génération",
    resume:
      "Créer un contrat associant l’embauche d’un jeune en CDI au maintien dans l’emploi d’un salarié expérimenté jusqu’à la retraite pour transmettre les savoir-faire.",
    pages: "24",
    pagePdf: 14,
  },
  {
    numero: 34,
    theme: "Emploi",
    titre: "Emplois d’avenir et heures supplémentaires",
    resume:
      "Créer 150 000 emplois d’avenir, prioritairement dans les quartiers populaires, et revenir sur la défiscalisation et les exonérations des heures supplémentaires, sauf pour les très petites entreprises.",
    pages: "24",
    pagePdf: 14,
  },
  {
    numero: 35,
    theme: "Travail",
    titre: "Parcours professionnels, formation et licenciements",
    resume:
      "Sécuriser les parcours avec les partenaires sociaux, cibler la formation sur les publics fragiles et renforcer Pôle emploi. Renchérir les licenciements collectifs des entreprises versant des dividendes ou rachetant leurs actions et permettre un recours des salariés au tribunal.",
    pages: "24 et 25",
    pagePdf: 14,
  },
  {
    numero: 36,
    theme: "Éducation",
    titre: "Postes et formation des enseignants",
    resume:
      "Créer 60 000 postes dans l’éducation en cinq ans, tous métiers confondus, prérecruter les enseignants pendant leurs études et rétablir leur formation initiale.",
    pages: "25",
    pagePdf: 14,
  },
  {
    numero: 37,
    theme: "Éducation",
    titre: "Scolarité, qualification et jeunes déscolarisés",
    resume:
      "Accueillir les moins de trois ans en maternelle, renforcer les savoirs fondamentaux et revoir la pédagogie. Diviser par deux les sorties sans qualification, valoriser les filières professionnelles et proposer formation, apprentissage ou service civique aux jeunes déscolarisés de 16 à 18 ans.",
    pages: "25 et 26",
    pagePdf: 14,
  },
  {
    numero: 38,
    theme: "Éducation",
    titre: "Priorité au primaire et rythmes scolaires",
    resume:
      "Affecter prioritairement les nouveaux personnels en maternelle, en primaire et dans les zones en difficulté, et revoir les rythmes scolaires.",
    pages: "26",
    pagePdf: 15,
  },
  {
    numero: 39,
    theme: "Enseignement supérieur",
    titre: "Université, vie étudiante et recherche",
    resume:
      "Décloisonner les premiers cycles, réformer la loi LRU, créer une allocation d’études sous conditions de ressources et encadrer les stages. Développer les échanges, abroger la circulaire sur les étudiants étrangers, simplifier le financement de la recherche et accélérer les Investissements d’avenir.",
    pages: "26 et 27",
    pagePdf: 15,
  },
  {
    numero: 40,
    theme: "Sport",
    titre: "Pratique sportive et solidarité avec le sport amateur",
    resume:
      "Garantir aux jeunes, avec ou sans handicap, la possibilité de pratiquer en club ou association, renforcer la solidarité du sport professionnel vers l’amateur et accueillir de grandes compétitions.",
    pages: "27",
    pagePdf: 15,
  },
  {
    numero: 41,
    theme: "Énergie",
    titre: "Nucléaire, renouvelables et émissions",
    resume:
      "Engager la baisse de la part nucléaire de 75 % à 50 % en 2025, développer les renouvelables et respecter les engagements de réduction des émissions. Fermer Fessenheim tout en achevant l’EPR de Flamanville et en modernisant la filière nucléaire.",
    pages: "27 et 28",
    pagePdf: 15,
  },
  {
    numero: 42,
    theme: "Énergie",
    titre: "Tarification progressive de l’eau et de l’énergie",
    resume:
      "Instaurer une tarification progressive de l’eau, de l’électricité et du gaz, avec l’objectif de sortir 8 millions de personnes de la précarité énergétique.",
    pages: "28",
    pagePdf: 16,
  },
  {
    numero: 43,
    theme: "Logement",
    titre: "Isolation thermique des logements",
    resume:
      "Lancer un plan visant l’isolation thermique d’un million de logements par an pour réduire les dépenses de chauffage et créer des emplois.",
    pages: "28",
    pagePdf: 16,
  },
  {
    numero: 44,
    theme: "Culture",
    titre: "Éducation artistique, création, livre et spectacle",
    resume:
      "Lancer un plan d’éducation artistique, soutenir la création et le maillage culturel avec les collectivités, faire voter une loi sur le spectacle vivant et reprendre le Centre national de la musique. Rétablir une TVA de 5,5 % pour le livre et la billetterie et soutenir les librairies indépendantes.",
    pages: "29",
    pagePdf: 16,
  },
  {
    numero: 45,
    theme: "Culture",
    titre: "Remplacement d’Hadopi et rémunération des auteurs",
    resume:
      "Remplacer Hadopi par une loi conciliant accès aux œuvres et droits des créateurs, renforcer la lutte contre la contrefaçon commerciale et financer les auteurs selon les accès aux œuvres, par les usagers et les acteurs du numérique.",
    pages: "29 et 30",
    pagePdf: 16,
  },
  {
    numero: 46,
    theme: "Institutions",
    titre: "Principes de la laïcité dans la Constitution",
    resume:
      "Inscrire à l’article premier les principes de liberté de conscience, de libre exercice des cultes et de séparation des Églises et de l’État, avec réserve des règles d’Alsace-Moselle.",
    pages: "32",
    pagePdf: 18,
  },
  {
    numero: 47,
    theme: "Institutions",
    titre: "Statut et rémunération du président et des ministres",
    resume:
      "Réformer le statut pénal présidentiel, réduire de 30 % la rémunération du président et des ministres et mettre fin à la présence des anciens présidents au Conseil constitutionnel.",
    pages: "32",
    pagePdf: 18,
  },
  {
    numero: 48,
    theme: "Institutions",
    titre: "Parlement, non-cumul, parité et proportionnelle",
    resume:
      "Renforcer les pouvoirs du Parlement, notamment sur les nominations, légiférer sur le non-cumul, accroître les sanctions pour non-respect de la parité et introduire une part de proportionnelle aux législatives.",
    pages: "33",
    pagePdf: 18,
  },
  {
    numero: 49,
    theme: "Institutions",
    titre: "Inéligibilité après condamnation pour corruption",
    resume: "Porter à dix ans la durée d’inéligibilité des élus condamnés pour corruption.",
    pages: "33",
    pagePdf: 18,
  },
  {
    numero: 50,
    theme: "Immigration",
    titre: "Vote local des étrangers et politique migratoire",
    resume:
      "Accorder le vote local aux étrangers résidant légalement depuis cinq ans, combattre l’immigration illégale et le travail clandestin, sécuriser l’immigration légale et régulariser au cas par cas selon des critères objectifs.",
    pages: "33",
    pagePdf: 18,
  },
  {
    numero: 51,
    theme: "Médias",
    titre: "Audiovisuel public, AFP et sources des journalistes",
    resume:
      "Confier les nominations de l’audiovisuel public à une autorité indépendante, préserver l’indépendance de l’AFP et renforcer la protection des sources journalistiques.",
    pages: "33",
    pagePdf: 18,
  },
  {
    numero: 52,
    theme: "Sécurité",
    titre: "Sécurité de proximité et effectifs de la justice et des forces de l’ordre",
    resume:
      "Créer des zones de sécurité prioritaires, renforcer la sécurité de proximité, porter à 80 les centres éducatifs fermés et créer chaque année 1 000 postes supplémentaires dans la justice, la police et la gendarmerie.",
    pages: "34",
    pagePdf: 19,
  },
  {
    numero: 53,
    theme: "Justice",
    titre: "Indépendance judiciaire et exécution des peines",
    resume:
      "Réformer les nominations et le Conseil supérieur de la magistrature, interdire les interventions gouvernementales dans les affaires individuelles et revenir sur les peines planchers. Faciliter l’accès à la justice, exécuter les peines et assurer la dignité en prison.",
    pages: "34",
    pagePdf: 19,
  },
  {
    numero: 54,
    theme: "Territoires",
    titre: "Décentralisation et finances locales",
    resume:
      "Ouvrir une nouvelle étape de décentralisation, abroger le conseiller territorial, clarifier les compétences et garantir le niveau des dotations. Accroître l’autonomie fiscale et la péréquation entre collectivités.",
    pages: "35",
    pagePdf: 19,
  },
  {
    numero: 55,
    theme: "Travail",
    titre: "Concertation sociale et représentation des salariés",
    resume:
      "Constitutionnaliser la concertation préalable sur les lois concernant les partenaires sociaux, réunir une conférence économique et sociale dès l’été 2012 et faire entrer les salariés dans les conseils d’administration et comités de rémunération des grandes entreprises.",
    pages: "35 et 36",
    pagePdf: 19,
  },
  {
    numero: 56,
    theme: "Institutions",
    titre: "Charte des langues régionales ou minoritaires",
    resume: "Faire ratifier la Charte européenne des langues régionales ou minoritaires.",
    pages: "36",
    pagePdf: 20,
  },
  {
    numero: 57,
    theme: "International",
    titre: "Gouvernance mondiale et aide au développement",
    resume:
      "Soutenir une organisation mondiale de l’environnement, renforcer le multilatéralisme et les relations avec les pays émergents, augmenter l’aide au développement et élargir le Conseil de sécurité en maintenant le siège et le veto français.",
    pages: "36 et 37",
    pagePdf: 20,
  },
  {
    numero: 58,
    theme: "International",
    titre: "Méditerranée, Afrique, francophonie et expatriés",
    resume:
      "Développer les relations avec le sud de la Méditerranée, refonder les relations africaines, relancer la francophonie et accompagner les Français de l’étranger, notamment pour l’enseignement selon leurs revenus.",
    pages: "37",
    pagePdf: 20,
  },
  {
    numero: 59,
    theme: "International",
    titre: "Retrait d’Afghanistan et conflit israélo-palestinien",
    resume:
      "Engager immédiatement le retrait des troupes françaises d’Afghanistan pour l’achever fin 2012, relancer les négociations de paix israélo-palestiniennes et soutenir la reconnaissance internationale de l’État palestinien.",
    pages: "37",
    pagePdf: 20,
  },
  {
    numero: 60,
    theme: "Défense",
    titre: "Défense, dissuasion et sécurité collective",
    resume:
      "Maintenir les deux composantes de la dissuasion nucléaire, les moyens militaires et les liens armée-nation, relancer l’industrie de défense, lutter contre le terrorisme et recentrer l’OTAN sur la sécurité collective.",
    pages: "37 et 38",
    pagePdf: 20,
  },
];

/** Un lien de volet n'attribue jamais son statut au numéro entier. */
export const VOLETS_HOLLANDE: Record<string, { numero: number; couvreTout: boolean }> = {
  "2012-famille-allocation-rentree": { numero: 16, couvreTout: false },
  "2012-retraites-depart-60": { numero: 18, couvreTout: false },
  "2012-societe-mariage-adoption": { numero: 31, couvreTout: true },
};
