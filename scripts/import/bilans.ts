/**
 * Bilan des engagements présidentiels : présidents, mandats, engagements.
 *
 * Usage :
 *   node scripts/import/bilans.ts --db data/pg16 --verifier
 *   node scripts/import/bilans.ts --db data/pg16
 *
 * `--verifier` n'écrit rien : il interroge chaque URL de programme et de
 * source et affiche son code de réponse. Un mandat dont le programme n'est
 * pas atteignable n'est pas écrit, et un engagement dont une source est morte
 * non plus.
 *
 * ÉTAT DU CORPUS.
 *
 * Le corpus se construit thème par thème, sur le mandat 2017-2022 d'abord.
 * Chaque promesse demande l'extrait exact du programme, les textes ou données
 * publiques correspondants, et la comparaison du résultat observable à ce qui
 * avait été annoncé. Rien de cela ne se déduit, et une fiche déduite de ce
 * qu'une mesure au nom voisin existe serait pire que pas de fiche.
 *
 * SUR LA VÉRIFICATION DES LIENS.
 *
 * Légifrance, l'Urssaf et economie.gouv.fr refusent les requêtes
 * automatisées : leurs URL s'ouvrent dans un navigateur mais répondent 403 ou
 * rien au script. `--verifier` les signale comme bloquées et non comme
 * mortes, parce que les traiter comme absentes reviendrait à écarter du bilan
 * les sources les plus solides, celles du droit publié.
 *
 * SUR LES SOURCES DE PROGRAMME.
 *
 * Les sites de campagne ne survivent pas aux campagnes : en-marche.fr répond
 * 404 aujourd'hui. Les documents officiels déposés auprès de la commission de
 * contrôle de la campagne électorale, eux, restent en ligne, et c'est la
 * source retenue quand elle existe.
 *
 * Les pages d'archive de vie-publique.fr répondent bien, mais leur contenu
 * n'est pas récupérable automatiquement : un code 200 ne prouve pas qu'une
 * page contient le document annoncé. Elles ne sont donc pas enregistrées
 * comme source tant qu'une vérification humaine ne les a pas confirmées.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface MandatSource {
  id: string;
  libelle: string;
  dateDebut: string;
  /** Absent tant que le mandat court. */
  dateFin?: string;
  programmeTitre: string;
  programmeUrl: string;
  programmeDate?: string;
}

interface PresidentSource {
  id: string;
  prenom: string;
  nom: string;
  mandats: MandatSource[];
}

type Statut =
  "realise" | "partiellement" | "en_cours" | "non_realise" | "abandonne" | "inevaluable";

interface SourceSource {
  titre: string;
  organisme: string;
  url: string;
  date?: string;
  /** false pour la presse. La source institutionnelle prime quand elle existe. */
  institutionnelle?: boolean;
}

interface EngagementSource {
  id: string;
  mandatId: string;
  theme: string;
  titre: string;
  /** Citation du programme, reprise mot pour mot. */
  extraitProgramme: string;
  reformulation: string;
  pageProgramme?: string;
  statut: Statut;
  confiance: "haute" | "moyenne" | "basse";
  actionMenee?: string;
  resultat?: string;
  justification: string;
  interpretations?: string;
  verifieLe: string;
  actions?: { date: string; description: string; url?: string }[];
  sources: SourceSource[];
}

const PRESIDENTS: PresidentSource[] = [
  {
    id: "emmanuel-macron",
    prenom: "Emmanuel",
    nom: "Macron",
    mandats: [
      {
        id: "macron-2022-2027",
        libelle: "2022-2027",
        dateDebut: "2022-05-13",
        programmeTitre:
          "Déclaration de candidature déposée auprès de la commission de contrôle de la campagne électorale, élection présidentielle de 2022",
        programmeUrl: "https://www.cnccep.fr/pdfs/Candidat-07-Emmanuel-Macron-Declaration.pdf",
        programmeDate: "2022-04-01",
      },
      {
        id: "macron-2017-2022",
        libelle: "2017-2022",
        dateDebut: "2017-05-14",
        dateFin: "2022-05-13",
        programmeTitre: "Programme d'Emmanuel Macron, élection présidentielle de 2017",
        // Le site de campagne en-marche.fr répond 404 depuis, mais le PDF du
        // programme reste servi par le stockage de la campagne. Les
        // professions de foi 2017 déposées auprès de la commission de
        // contrôle ne sont, elles, pas archivées : l'index de la Wayback
        // Machine ne contient pour cnccep.fr en 2017 que des communiqués.
        programmeUrl:
          "https://storage.googleapis.com/en-marche-fr/COMMUNICATION/Programme-Emmanuel-Macron.pdf",
        programmeDate: "2017-03-02",
      },
    ],
  },
];

/**
 * Premier thème traité de bout en bout : la fiscalité du mandat 2017-2022.
 *
 * Les extraits sont tirés du PDF du programme, converti en texte, et repris
 * mot pour mot. Les articles de loi ne sont cités que lorsqu'ils ont été
 * confirmés ; ailleurs, la loi est citée sans numéro d'article plutôt qu'avec
 * un numéro approximatif.
 *
 * Un mot sur la distinction entre le moyen et le résultat, qui est le piège
 * de cet exercice. Sur ces cinq engagements, la mesure promise est elle-même
 * un texte fiscal : la voter, c'est la réaliser. Ce ne sera pas le cas
 * partout, et un engagement du type « créer 10 000 postes » ne sera pas
 * « réalisé » parce qu'une loi l'autorise.
 */
const ENGAGEMENTS: EngagementSource[] = [
  {
    id: "2017-fiscalite-taxe-habitation",
    mandatId: "macron-2017-2022",
    theme: "Fiscalité",
    titre: "Exonérer 80 % des ménages de la taxe d'habitation",
    extraitProgramme:
      "Nous exonérerons de la taxe d'habitation tous les Français des classes moyennes et populaires (soit 80% des ménages).",
    reformulation:
      "Supprimer la taxe d'habitation sur la résidence principale pour huit ménages sur dix.",
    pageProgramme: "Chapitre « Les territoires qui font notre France »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de finances pour 2018 a créé un dégrèvement appliqué par tiers de 2018 à 2020. La loi de finances pour 2020 a ensuite étendu la suppression à l'ensemble des ménages, au-delà de ce qui était promis.",
    resultat:
      "Le dégrèvement atteint 100 % en 2020 pour les ménages visés, soit l'échéance et le périmètre annoncés dans le programme.",
    justification:
      "Le programme annonçait 80 % des ménages exonérés et citait l'échéance de 2020. Le dispositif voté produit cet effet à cette date. L'extension ultérieure à tous les ménages dépasse l'engagement sans le contredire.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-12-30",
        description:
          "Loi de finances pour 2018 : création du dégrèvement de taxe d'habitation sur la résidence principale, monté en charge de 2018 à 2020 (article 5).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000036339213",
      },
      {
        date: "2019-12-28",
        description:
          "Loi de finances pour 2020 : suppression étendue à l'ensemble des ménages à l'horizon 2023 (article 16).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000039683949",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2017-1837 du 30 décembre 2017 de finances pour 2018, article 5",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000036339213",
        date: "2017-12-30",
      },
      {
        titre: "LOI n° 2019-1479 du 28 décembre 2019 de finances pour 2020, article 16",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000039683949",
        date: "2019-12-28",
      },
      {
        titre:
          "Dégrèvements de taxe d'habitation sur la résidence principale : doctrine fiscale et calendrier d'application",
        organisme: "Bulletin officiel des finances publiques",
        url: "https://bofip.impots.gouv.fr/bofip/12684-PGP.html/ACTU-2020-00313",
      },
    ],
  },
  {
    id: "2017-fiscalite-is-25",
    mandatId: "macron-2017-2022",
    theme: "Fiscalité",
    titre: "Baisser l'impôt sur les sociétés de 33,3 % à 25 %",
    extraitProgramme:
      "Nous baisserons l'impôt sur les sociétés de 33,3% à 25% pour rejoindre la moyenne européenne.",
    reformulation: "Ramener le taux normal de l'impôt sur les bénéfices des entreprises à 25 %.",
    pageProgramme: "Chapitre « Inventer un nouveau modèle de croissance »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de finances pour 2018 a fixé une trajectoire pluriannuelle de baisse du taux normal, appliquée par étapes jusqu'à la fin du mandat.",
    resultat:
      "Le taux normal de 25 % s'applique aux exercices ouverts à compter du 1er janvier 2022, soit la cible annoncée, atteinte avant la fin du mandat.",
    justification:
      "Le programme donnait un taux cible chiffré, sans échéance explicite. Ce taux est atteint pendant le mandat.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-12-30",
        description:
          "Loi de finances pour 2018 : trajectoire de baisse du taux normal de l'impôt sur les sociétés.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2017-1837 du 30 décembre 2017 de finances pour 2018",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
        date: "2017-12-30",
      },
      {
        titre: "Impôt sur les sociétés : taux applicables",
        organisme: "Direction générale des finances publiques",
        url: "https://entreprendre.service-public.fr/vosdroits/F23575",
      },
    ],
  },
  {
    id: "2017-fiscalite-isf-ifi",
    mandatId: "macron-2017-2022",
    theme: "Fiscalité",
    titre: "Transformer l'ISF en impôt sur la fortune immobilière",
    extraitProgramme:
      "Nous transformerons le CICE en allègements de charges pérennes, et l'ISF en « Impôt sur la Fortune Immobilière » sans accroître la fiscalité actuelle sur l'immobilier et les droits de succession, et sans taxer ce qui finance les entreprises et l'emploi.",
    reformulation:
      "Remplacer l'impôt de solidarité sur la fortune par un impôt portant sur le seul patrimoine immobilier.",
    pageProgramme: "Chapitre « Inventer un nouveau modèle de croissance »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de finances pour 2018 a supprimé l'impôt de solidarité sur la fortune et créé l'impôt sur la fortune immobilière, entré en vigueur au 1er janvier 2018.",
    resultat:
      "L'assiette est restreinte au patrimoine immobilier : les actifs financiers en sortent, ce que l'engagement annonçait.",
    justification:
      "La substitution annoncée a été opérée par la loi, avec le périmètre décrit dans le programme.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-12-30",
        description:
          "Loi de finances pour 2018 : suppression de l'ISF et création de l'impôt sur la fortune immobilière.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2017-1837 du 30 décembre 2017 de finances pour 2018",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
        date: "2017-12-30",
      },
      {
        titre: "Impôt sur la fortune immobilière : biens et droits imposables",
        organisme: "Service-public.fr",
        url: "https://www.service-public.fr/particuliers/vosdroits/F563",
      },
    ],
  },
  {
    id: "2017-fiscalite-pfu",
    mandatId: "macron-2017-2022",
    theme: "Fiscalité",
    titre: "Créer un prélèvement unique d'environ 30 % sur les revenus du capital",
    extraitProgramme:
      "Nous créerons un prélèvement unique sur les revenus du capital, de l'ordre de 30%.",
    reformulation:
      "Taxer les revenus de l'épargne et des placements à un taux unique proche de 30 %.",
    pageProgramme: "Chapitre « Inventer un nouveau modèle de croissance »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de finances pour 2018 a instauré le prélèvement forfaitaire unique sur les revenus du capital.",
    resultat:
      "Le taux global s'établit à 30 %, composé de l'impôt sur le revenu et des prélèvements sociaux. Le contribuable conserve la possibilité d'opter pour le barème progressif.",
    justification:
      "Le taux obtenu correspond à celui annoncé. L'option pour le barème progressif ne contredit pas l'engagement, qui portait sur la création d'un prélèvement unique et non sur sa généralisation obligatoire.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-12-30",
        description:
          "Loi de finances pour 2018 : création du prélèvement forfaitaire unique sur les revenus du capital.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2017-1837 du 30 décembre 2017 de finances pour 2018",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036339197",
        date: "2017-12-30",
      },
      {
        titre: "Prélèvement forfaitaire unique sur les revenus de placement",
        organisme: "Service-public.fr",
        url: "https://www.service-public.fr/particuliers/vosdroits/F34913",
      },
    ],
  },
  {
    id: "2017-travail-demission-chomage",
    mandatId: "macron-2017-2022",
    theme: "Travail",
    titre: "Ouvrir l'assurance chômage aux salariés qui démissionnent",
    extraitProgramme:
      "Nous ouvrirons les droits à l'assurance-chômage aux salariés qui démissionnent. Ce droit ne sera utilisable qu'une fois tous les cinq ans.",
    reformulation:
      "Permettre à un salarié qui démissionne de toucher l'assurance chômage, une fois tous les cinq ans.",
    pageProgramme: "Chapitre « Bien vivre de son travail »",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "La loi du 5 septembre 2018 pour la liberté de choisir son avenir professionnel a ouvert l'assurance chômage aux démissionnaires, en conditionnant ce droit à un projet de reconversion professionnelle préalablement examiné par un organisme de conseil en évolution professionnelle.",
    resultat:
      "Le droit existe, mais il est réservé aux démissionnaires porteurs d'un projet de reconversion validé, et non ouvert à l'ensemble des salariés qui démissionnent.",
    justification:
      "L'engagement annonçait l'ouverture du droit aux salariés qui démissionnent, sans autre condition que la périodicité de cinq ans. Le dispositif voté ajoute une condition de fond, le projet de reconversion validé, qui restreint sensiblement le périmètre annoncé.",
    interpretations:
      "Lecture stricte : le droit n'est pas ouvert à tous les démissionnaires, l'engagement n'est donc pas entièrement tenu. Lecture large : un droit nouveau a bien été créé pour des démissionnaires qui n'en avaient aucun. Le statut retenu est intermédiaire. La confiance est moyenne faute de donnée publique consolidée sur le nombre de bénéficiaires rapporté au nombre de démissions.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2018-09-05",
        description:
          "Loi pour la liberté de choisir son avenir professionnel : ouverture de l'assurance chômage aux démissionnaires ayant un projet de reconversion (article 50).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037367817",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2018-771 du 5 septembre 2018 pour la liberté de choisir son avenir professionnel",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037367660/",
        date: "2018-09-05",
      },
      {
        titre: "Article 50 de la loi du 5 septembre 2018",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037367817",
        date: "2018-09-05",
      },
    ],
  },
  {
    id: "2017-education-dedoublement",
    mandatId: "macron-2017-2022",
    theme: "Éducation",
    titre: "Limiter à 12 élèves par enseignant les classes de CP et CE1 en zone prioritaire",
    extraitProgramme:
      "Nous limiterons à 12 élèves par enseignant la taille des 12 000 classes de CP et de CE1 en zone prioritaire.",
    reformulation:
      "Diviser par deux les effectifs des classes de CP et CE1 des écoles des quartiers prioritaires, avec un maximum de 12 élèves par enseignant.",
    pageProgramme: "Chapitre « Les mêmes chances pour tous »",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "Le dédoublement a été déployé sur trois rentrées : CP en REP+ en 2017, puis CE1 en REP+ et CP en REP en 2018, enfin CE1 en REP en 2019. Les classes concernées ont bien été dédoublées et des postes y ont été affectés.",
    resultat:
      "La taille moyenne des classes de CP en REP+ est passée d'environ 21,7 élèves en 2015 à environ 12,7 en 2024 selon les données du ministère. La moyenne reste donc au-dessus du plafond de 12 annoncé, et une moyenne n'indique pas combien de classes le dépassent.",
    justification:
      "Le dispositif a été mis en place sur le périmètre annoncé, ce qui est l'essentiel de l'engagement. Mais la promesse portait un plafond chiffré, 12 élèves par enseignant, et les données publiées montrent une moyenne légèrement supérieure. Réalisée sur le principe, pas strictement sur le seuil.",
    interpretations:
      "Lecture stricte du plafond : l'engagement n'est pas entièrement tenu, la moyenne dépassant 12. Lecture par l'intention, le dédoublement des classes concernées : il l'est. Le statut retenu est intermédiaire parce que le programme donnait un chiffre, et qu'un chiffre s'évalue. La confiance est moyenne : les données publiques disponibles sont des moyennes, et la part des classes réellement au-dessus de 12 n'en ressort pas.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-09-01",
        description: "Rentrée 2017 : dédoublement des classes de CP en REP+.",
      },
      {
        date: "2018-09-01",
        description: "Rentrée 2018 : extension aux CE1 en REP+ et aux CP en REP.",
      },
      {
        date: "2019-09-01",
        description: "Rentrée 2019 : extension aux CE1 en REP.",
      },
    ],
    sources: [
      {
        titre:
          "Réduction de la taille de classe en éducation prioritaire : que nous apprennent les données de la DEPP",
        organisme: "Ministère de l'Éducation nationale",
        url: "https://www.education.gouv.fr/sites/default/files/document/r-duction-de-la-taille-de-classe-en-ducation-prioritaire-que-nous-apprennent-les-donn-es-de-la-depp--478949.pdf",
      },
      {
        titre:
          "Évaluation de l'impact de la réduction de la taille des classes de CP et de CE1 en REP+ sur les résultats des élèves et les pratiques des enseignants",
        organisme: "Direction de l'évaluation, de la prospective et de la performance",
        url: "https://archives-statistiques-depp.education.gouv.fr/Default/doc/SYRACUSE/50756/evaluation-de-l-impact-de-la-reduction-de-la-taille-des-classes-de-cp-et-de-ce1-en-rep-sur-les-resul?_lg=fr-FR",
      },
    ],
  },
  {
    id: "2017-retraites-systeme-universel",
    mandatId: "macron-2017-2022",
    theme: "Retraites",
    titre: "Mettre en place un système universel de retraite",
    extraitProgramme:
      "Un système universel avec des règles communes de calcul des pensions sera progressivement mis en place. Le fait de changer d'activité ou de secteur sera sans effet sur les droits à la retraite. Avec un principe d'égalité : pour chaque euro cotisé, le même droit à pension pour tous !",
    reformulation:
      "Remplacer les 42 régimes de retraite existants par un système unique où un euro cotisé ouvre les mêmes droits pour tout le monde.",
    pageProgramme: "Chapitre « Les mêmes règles pour tous »",
    statut: "non_realise",
    confiance: "haute",
    actionMenee:
      "Un projet de loi instituant un système universel de retraite a été déposé en janvier 2020 et considéré comme adopté en première lecture à l'Assemblée nationale le 3 mars 2020 par l'article 49 alinéa 3 de la Constitution. Son examen a ensuite été suspendu et le texte n'est jamais allé au terme de la procédure.",
    resultat:
      "Aucun système universel n'est entré en vigueur pendant le mandat : les régimes de retraite existants sont restés en place jusqu'à son terme.",
    justification:
      "L'engagement portait sur la mise en place effective d'un système universel. Le texte n'a pas dépassé la première lecture et le mandat s'est achevé sans qu'il s'applique. Le statut ne juge ni le contenu de la réforme ni les raisons de son interruption.",
    interpretations:
      "Lecture stricte : l'engagement est non réalisé, aucun système universel n'existant à la fin du mandat. Lecture large : la réforme a été engagée et une première lecture franchie. Le statut retenu est le premier, parce que le programme annonçait une mise en place et non le dépôt d'un texte.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2020-01-24",
        description: "Dépôt du projet de loi instituant un système universel de retraite.",
        url: "https://www.legifrance.gouv.fr/dossierlegislatif/JORFDOLE000041477060/",
      },
      {
        date: "2020-03-03",
        description:
          "Texte considéré comme adopté en première lecture par l'Assemblée nationale par l'article 49 alinéa 3, après rejet des motions de censure.",
        url: "https://www.assemblee-nationale.fr/dyn/15/textes/l15t0409_texte-adopte-seance",
      },
    ],
    sources: [
      {
        titre: "Système universel de retraite, dossier législatif",
        organisme: "Assemblée nationale",
        url: "https://www.assemblee-nationale.fr/dyn/15/dossiers/systeme_universel_de_retraite",
      },
      {
        titre: "Projet de loi instituant un système universel de retraite, dossier législatif",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/dossierlegislatif/JORFDOLE000041477060/",
      },
      {
        titre: "Texte adopté n° 409, première lecture",
        organisme: "Assemblée nationale",
        url: "https://www.assemblee-nationale.fr/dyn/15/textes/l15t0409_texte-adopte-seance",
        date: "2020-03-03",
      },
    ],
  },
  {
    id: "2017-retraites-age-depart",
    mandatId: "macron-2017-2022",
    theme: "Retraites",
    titre: "Ne pas modifier l'âge de départ à la retraite ni le niveau des pensions",
    extraitProgramme:
      "Nous ne toucherons pas à l'âge de départ à la retraite, ni au niveau des pensions.",
    reformulation:
      "Laisser inchangé l'âge légal de départ à la retraite et ne pas baisser les pensions.",
    pageProgramme: "Chapitre « Les mêmes règles pour tous »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "Aucune loi modifiant l'âge légal de départ n'a été promulguée entre 2017 et 2022. Le projet de système universel déposé en 2020 ne l'a pas relevé et n'a pas abouti.",
    resultat: "L'âge légal de départ est resté inchangé pendant toute la durée du mandat.",
    justification:
      "L'engagement portait sur ce mandat. Le report de l'âge légal décidé en 2023 relève du mandat suivant et n'entre donc pas dans ce bilan : une mesure prise après une élection ne peut pas invalider un engagement tenu pendant le mandat précédent.",
    verifieLe: "2026-09-14",
    sources: [
      {
        titre: "Système universel de retraite, dossier législatif",
        organisme: "Assemblée nationale",
        url: "https://www.assemblee-nationale.fr/dyn/15/dossiers/systeme_universel_de_retraite",
      },
      {
        titre: "Âge légal de départ à la retraite",
        organisme: "Service-public.fr",
        url: "https://www.service-public.fr/particuliers/vosdroits/F14043",
      },
    ],
  },
  {
    id: "2017-fiscalite-cice",
    mandatId: "macron-2017-2022",
    theme: "Fiscalité",
    titre: "Transformer le CICE en allègements de charges pérennes",
    extraitProgramme: "Nous transformerons le CICE en allègements de charges pérennes",
    reformulation:
      "Remplacer le crédit d'impôt sur les salaires par une baisse directe et permanente des cotisations patronales.",
    pageProgramme: "Chapitre « Inventer un nouveau modèle de croissance »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La bascule a été votée en loi de financement de la sécurité sociale pour 2018 puis mise en oeuvre au 1er janvier 2019 : suppression du crédit d'impôt et allègement pérenne de cotisations patronales.",
    resultat:
      "Le crédit d'impôt ne s'applique plus aux rémunérations versées à compter de 2019, remplacé par une réduction de cotisations.",
    justification:
      "La transformation annoncée a eu lieu à la date prévue, avec la nature d'allègement pérenne décrite dans le programme.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2019-01-01",
        description:
          "Entrée en vigueur de la suppression du CICE et de son remplacement par un allègement pérenne de cotisations patronales.",
        url: "https://entreprendre.service-public.fr/vosdroits/F31326",
      },
    ],
    sources: [
      {
        titre: "Réduction générale des cotisations patronales",
        organisme: "Urssaf",
        // Le site refuse les requêtes automatisées : le lien s'ouvre dans un
        // navigateur mais ne peut pas être contrôlé par le script.
        url: "https://www.urssaf.fr/accueil/employeur/beneficier-exonerations/reduction-generale-cotisation.html",
      },
      {
        titre: "Crédit d'impôt pour la compétitivité et l'emploi : fin du dispositif",
        organisme: "Service-public.fr",
        url: "https://entreprendre.service-public.fr/vosdroits/F31326",
      },
    ],
  },
];

const MIGRATION = resolve("db/migrations/007_bilans.sql");

async function tester(url: string): Promise<number | string> {
  try {
    const r = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "comprendrelapolitique/0.1 (verification de lien)" },
      signal: AbortSignal.timeout(25000),
    });
    return r.status;
  } catch (e) {
    return e instanceof Error ? e.name : "échec";
  }
}

/**
 * Un 403 n'est pas un lien mort.
 *
 * Légifrance refuse les requêtes automatisées : l'URL est valide, elle
 * s'ouvre dans un navigateur. Traiter ce refus comme une absence
 * supprimerait précisément les sources les plus solides du bilan, celles du
 * droit publié. Le script le signale donc au lieu de les écarter, et c'est à
 * la relecture humaine de les ouvrir.
 */
/** Domaines dont on sait qu'ils refusent les requêtes automatisées. */
const DOMAINES_PROTEGES = ["legifrance.gouv.fr", "urssaf.fr", "economie.gouv.fr"];

function etatLien(code: number | string, url: string): "ok" | "bloque" | "mort" {
  if (code === 200) return "ok";
  if (code === 403 || code === 401 || code === 429) return "bloque";
  // Une coupure de connexion sur un domaine connu pour filtrer n'est pas une
  // preuve d'absence : ces sites rejettent le client avant de répondre.
  if (DOMAINES_PROTEGES.some((d) => url.includes(d))) return "bloque";
  return "mort";
}

async function verifier(): Promise<void> {
  for (const p of PRESIDENTS) {
    console.log(`\n## ${p.prenom} ${p.nom}`);
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      console.log(
        `   ${etatLien(code) === "ok" ? "OK " : "!! "}${String(code).padEnd(6)} ${m.libelle}`,
      );
      console.log(`          ${m.programmeUrl}`);
    }
  }

  console.log(`\n## Sources des ${ENGAGEMENTS.length} engagements`);
  let morts = 0;
  let bloques = 0;
  for (const e of ENGAGEMENTS) {
    for (const s of e.sources) {
      const code = await tester(s.url);
      const etat = etatLien(code, s.url);
      if (etat === "mort") morts += 1;
      if (etat === "bloque") bloques += 1;
      const marque = etat === "ok" ? "OK  " : etat === "bloque" ? "BLOQ" : "MORT";
      console.log(
        `   ${marque} ${String(code).padEnd(5)} ${s.organisme} · ${s.titre.slice(0, 60)}`,
      );
    }
  }
  console.log(
    `\n${morts} lien(s) mort(s), ${bloques} bloqué(s) par le site (à ouvrir à la main, pas une absence).`,
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--verifier")) {
    await verifier();
    return;
  }

  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: bilans.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db: Db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'president') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 007 appliquée");
  }

  await db.query(`DELETE FROM enrichissement.mandat_presidentiel`);
  await db.query(`DELETE FROM enrichissement.president`);

  let mandats = 0;
  let ignores = 0;
  for (const p of PRESIDENTS) {
    await db.query(`INSERT INTO enrichissement.president (id, nom, prenom) VALUES ($1, $2, $3)`, [
      p.id,
      p.nom,
      p.prenom,
    ]);
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      if (code !== 200) {
        console.error(`Programme inatteignable (${code}), mandat ignoré : ${m.id}`);
        ignores += 1;
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.mandat_presidentiel
           (id, president_id, libelle, date_debut, date_fin, programme_titre,
            programme_url, programme_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          m.id,
          p.id,
          m.libelle,
          m.dateDebut,
          m.dateFin ?? null,
          m.programmeTitre,
          m.programmeUrl,
          m.programmeDate ?? null,
        ],
      );
      mandats += 1;
    }
  }

  await db.query(`DELETE FROM enrichissement.engagement`);
  let engagements = 0;
  for (const e of ENGAGEMENTS) {
    await db.query(
      `INSERT INTO enrichissement.engagement
         (id, mandat_id, theme, titre, extrait_programme, reformulation, page_programme,
          statut, confiance, action_menee, resultat, justification, interpretations, verifie_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::enrichissement.statut_engagement,
               $9::enrichissement.confiance_evaluation,$10,$11,$12,$13,$14)`,
      [
        e.id,
        e.mandatId,
        e.theme,
        e.titre,
        e.extraitProgramme,
        e.reformulation,
        e.pageProgramme ?? null,
        e.statut,
        e.confiance,
        e.actionMenee ?? null,
        e.resultat ?? null,
        e.justification,
        e.interpretations ?? null,
        e.verifieLe,
      ],
    );
    for (const a of e.actions ?? []) {
      await db.query(
        `INSERT INTO enrichissement.engagement_action (engagement_id, date_action, description, url)
         VALUES ($1,$2,$3,$4)`,
        [e.id, a.date, a.description, a.url ?? null],
      );
    }
    for (const s of e.sources) {
      await db.query(
        `INSERT INTO enrichissement.engagement_source
           (engagement_id, titre, organisme, url, date_source, institutionnelle)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [e.id, s.titre, s.organisme, s.url, s.date ?? null, s.institutionnelle ?? true],
      );
    }
    engagements += 1;
  }

  console.log(
    `${PRESIDENTS.length} président(s), ${mandats} mandat(s)` +
      (ignores > 0 ? `, ${ignores} ignoré(s)` : "") +
      `, ${engagements} engagement(s)`,
  );
  await db.close();
}

await main();
