/**
 * Bilan des engagements présidentiels : présidents, mandats, engagements.
 *
 * Usage :
 *   node scripts/import/bilans.ts --verifier
 *   node scripts/import/bilans.ts --db data/pg16
 *
 * `--verifier` n'écrit rien. Il cherche chaque extrait dans le programme dont
 * il est censé venir, puis interroge chaque URL de programme et de source et
 * affiche son code de réponse.
 *
 * Le chargement applique les mêmes contrôles et refuse ce qui échoue : un
 * mandat dont le programme n'est pas atteignable n'est pas écrit, un
 * engagement dont l'extrait ne figure pas mot pour mot dans le programme non
 * plus, ni un engagement dont une source est morte.
 *
 * ÉTAT DU CORPUS.
 *
 * Le corpus se construit thème par thème. Chaque promesse demande l'extrait
 * exact du programme, les textes ou données publiques correspondants, et la
 * comparaison du résultat observable à ce qui avait été annoncé. Rien de cela
 * ne se déduit, et une fiche déduite de ce qu'une mesure au nom voisin existe
 * serait pire que pas de fiche.
 *
 * SUR LA VÉRIFICATION DES EXTRAITS.
 *
 * L'extrait est ce qui distingue un engagement d'une intention qu'on prête au
 * candidat. Il est vérifié par le même code que les citations du comparateur
 * de programmes (`citations.ts`) : un extrait reformulé, même fidèlement,
 * serait refusé.
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
 * comme source de programme tant qu'une vérification humaine ne les a pas
 * confirmées.
 */

import { resolve } from "node:path";

import { citationPresente } from "./citations.ts";
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
  /** Citation du programme, reprise mot pour mot et vérifiée contre lui. */
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
 * Les engagements, mandat par mandat.
 *
 * Les extraits sont tirés du PDF du programme, converti en texte, et repris
 * mot pour mot. Les articles de loi ne sont cités que lorsqu'ils ont été
 * confirmés ; ailleurs, la loi est citée sans numéro d'article plutôt qu'avec
 * un numéro approximatif.
 *
 * Un mot sur la distinction entre le moyen et le résultat, qui est le piège
 * de cet exercice. Quand la mesure promise est elle-même un texte, fiscal par
 * exemple, la voter c'est la réaliser. Un engagement du type « recruter
 * 8 500 personnes » n'est pas « réalisé » parce qu'une loi programme ces
 * recrutements : il l'est quand ils ont eu lieu.
 *
 * Quand un engagement se prête à deux lectures défendables, souvent une
 * lecture stricte du chiffre annoncé et une lecture par l'intention, elles
 * sont exposées dans `interpretations`, avec la raison du statut retenu. Un
 * engagement chiffré s'évalue sur son chiffre.
 */
const ENGAGEMENTS: EngagementSource[] = [
  // --- Mandat 2017-2022 -----------------------------------------------------
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
  {
    id: "2017-travail-heures-supplementaires",
    mandatId: "macron-2017-2022",
    theme: "Travail",
    titre: "Rétablir les exonérations de cotisations sur les heures supplémentaires",
    extraitProgramme:
      "Nous rétablirons les exonérations de cotisations sociales sur les heures supplémentaires.",
    reformulation:
      "Alléger à nouveau les cotisations sociales prélevées sur la rémunération des heures supplémentaires, comme entre 2007 et 2012.",
    pageProgramme: "Chapitre « Bien vivre de son travail »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de financement de la sécurité sociale pour 2019 a créé une réduction des cotisations salariales d'assurance vieillesse sur les heures supplémentaires, prévue pour septembre 2019. La loi du 24 décembre 2018 portant mesures d'urgence économiques et sociales l'a avancée au 1er janvier 2019 et y a ajouté une exonération d'impôt sur le revenu, dans la limite de 5 000 euros par an.",
    resultat:
      "Depuis le 1er janvier 2019, la rémunération des heures supplémentaires est allégée des cotisations salariales d'assurance vieillesse et exonérée d'impôt sur le revenu jusqu'à 5 000 euros par an.",
    justification:
      "Le programme annonçait le retour d'une exonération de cotisations sociales sur les heures supplémentaires. Une réduction de cotisations salariales s'applique depuis 2019, soit bien avant la fin du mandat.",
    interpretations:
      "Le programme ne précisait pas quelles cotisations seraient concernées. Le dispositif voté porte sur les cotisations salariales d'assurance vieillesse, et non sur l'ensemble des cotisations sociales. Le statut retenu considère l'engagement, formulé sans ce détail, comme tenu dans son principe.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2018-12-22",
        description:
          "Loi de financement de la sécurité sociale pour 2019 : réduction des cotisations salariales sur les heures supplémentaires, prévue au 1er septembre 2019 (article 7).",
      },
      {
        date: "2018-12-24",
        description:
          "Loi portant mesures d'urgence économiques et sociales : entrée en vigueur avancée au 1er janvier 2019 et exonération d'impôt sur le revenu dans la limite de 5 000 euros par an (article 2).",
      },
      {
        date: "2019-01-24",
        description:
          "Décret relatif à l'exonération de cotisations salariales des heures supplémentaires et complémentaires.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000038052425",
      },
    ],
    sources: [
      {
        titre:
          "Décret n° 2019-40 du 24 janvier 2019 relatif à l'exonération de cotisations salariales des heures supplémentaires et complémentaires",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000038052425",
        date: "2019-01-24",
      },
      {
        titre: "Défiscalisation et désocialisation des heures supplémentaires (question écrite)",
        organisme: "Sénat",
        url: "https://www.senat.fr/questions/base/2019/qSEQ190108628.html",
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
    id: "2017-entreprises-rsi",
    mandatId: "macron-2017-2022",
    theme: "Entreprises",
    titre: "Supprimer le régime social des indépendants",
    extraitProgramme: "supprimerons le Régime Social des Indépendants (RSI) qui ne fonctionne pas",
    reformulation:
      "Fermer la caisse de sécurité sociale propre aux travailleurs indépendants et confier leur protection sociale au régime général.",
    pageProgramme: "Chapitre « Libérer le travail et l'esprit d'entreprise »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de financement de la sécurité sociale pour 2018 a supprimé le régime social des indépendants et prévu le transfert de ses missions aux caisses du régime général, au terme d'une période de transition de deux ans.",
    resultat:
      "Depuis le 1er janvier 2020, la protection sociale des travailleurs indépendants est gérée par les caisses du régime général : Urssaf pour le recouvrement des cotisations, caisses d'assurance maladie et de retraite pour les prestations.",
    justification:
      "La suppression annoncée a été votée dans la première loi de financement du mandat et achevée à la date fixée par cette loi. La fiche porte sur la seule suppression du RSI : la baisse de charges annoncée dans la même phrase du programme n'y est pas évaluée.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2017-12-30",
        description:
          "Loi de financement de la sécurité sociale pour 2018 : suppression du régime social des indépendants et adossement au régime général (article 15).",
        url: "https://www.legifrance.gouv.fr/eli/loi/2017/12/30/2017-1836/jo/article_15",
      },
      {
        date: "2018-03-09",
        description:
          "Décret de mise en oeuvre de la réforme de la protection sociale des travailleurs indépendants.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036694251",
      },
      {
        date: "2020-01-01",
        description:
          "Fin de la période de transition : les missions de l'ancien régime sont exercées par les caisses du régime général.",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2017-1836 du 30 décembre 2017 de financement de la sécurité sociale pour 2018, article 15",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/eli/loi/2017/12/30/2017-1836/jo/article_15",
        date: "2017-12-30",
      },
      {
        titre:
          "Décret n° 2018-174 du 9 mars 2018 relatif à la mise en oeuvre de la réforme de la protection sociale des travailleurs indépendants",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036694251",
        date: "2018-03-09",
      },
      {
        titre: "Loi de financement de la sécurité sociale pour 2018, dossier législatif",
        organisme: "Assemblée nationale",
        url: "https://www.assemblee-nationale.fr/dyn/15/dossiers/plfss_2018",
      },
    ],
  },
  {
    id: "2017-solidarite-minimum-vieillesse",
    mandatId: "macron-2017-2022",
    theme: "Solidarité",
    titre: "Augmenter le minimum vieillesse de 100 euros par mois",
    extraitProgramme: "Nous augmenterons le minimum vieillesse de 100 euros par mois.",
    reformulation:
      "Relever de 100 euros par mois l'allocation versée aux personnes âgées dont les ressources sont les plus faibles.",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "Le montant de l'allocation de solidarité aux personnes âgées, nom actuel du minimum vieillesse, a été relevé en trois étapes : en 2018, en 2019 et en 2020.",
    resultat:
      "Pour une personne seule, le montant maximal est passé de 803,20 euros par mois en 2017 à 903,20 euros au 1er janvier 2020, soit 100 euros de plus.",
    justification:
      "Le montant et le calendrier correspondent à l'engagement : 100 euros par mois, atteints avant la fin du mandat.",
    verifieLe: "2026-09-14",
    actions: [
      { date: "2018-04-01", description: "Première hausse exceptionnelle du minimum vieillesse." },
      {
        date: "2019-01-01",
        description: "Deuxième hausse : 868,20 euros par mois pour une personne seule.",
      },
      {
        date: "2020-01-01",
        description: "Troisième hausse : 903,20 euros par mois pour une personne seule.",
      },
    ],
    sources: [
      {
        titre: "Allocation de solidarité aux personnes âgées (ASPA)",
        organisme: "Ministère du Travail et des Solidarités",
        url: "https://solidarites.gouv.fr/allocation-de-solidarite-aux-personnes-agees",
      },
      {
        titre:
          "Projet de loi de finances pour 2020 : solidarité, insertion et égalité des chances, avis",
        organisme: "Sénat",
        url: "https://www.senat.fr/rap/a19-143-7/a19-143-74.html",
      },
      {
        titre: "Allocation de solidarité aux personnes âgées : montant et conditions",
        organisme: "Service-public.fr",
        url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F16871",
      },
    ],
  },
  {
    id: "2017-solidarite-aah",
    mandatId: "macron-2017-2022",
    theme: "Solidarité",
    titre: "Augmenter l'allocation aux adultes handicapés de 100 euros par mois",
    extraitProgramme:
      "Nous augmenterons de 100 euros par mois l’Allocation Adulte Handicapé (AAH).",
    reformulation:
      "Relever de 100 euros par mois le montant maximal de l'allocation versée aux adultes handicapés.",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "Le montant maximal de l'allocation a fait l'objet de deux revalorisations exceptionnelles : de 819 à 860 euros au 1er novembre 2018, puis à 900 euros au 1er novembre 2019.",
    resultat:
      "Les deux hausses exceptionnelles totalisent 81 euros par mois. Le montant maximal atteint 900 euros en novembre 2019.",
    justification:
      "Le programme donnait un chiffre, 100 euros par mois. Les hausses exceptionnelles s'en approchent sans l'atteindre.",
    interpretations:
      "Compter à partir du montant de début de mandat, avant la revalorisation annuelle d'avril 2018, porte la hausse à un peu moins de 90 euros, toujours en deçà des 100 euros annoncés. Les revalorisations annuelles, liées à l'inflation, ne sont pas comptées : elles ont lieu chaque année indépendamment de l'engagement. Le statut suit le chiffre, comme pour les autres engagements chiffrés de ce bilan.",
    verifieLe: "2026-09-14",
    actions: [
      { date: "2018-11-01", description: "Première revalorisation exceptionnelle : 860 euros." },
      { date: "2019-11-01", description: "Seconde revalorisation exceptionnelle : 900 euros." },
    ],
    sources: [
      {
        titre: "Revalorisation exceptionnelle de l'AAH",
        organisme: "Ministère chargé des personnes handicapées",
        url: "https://handicap.gouv.fr/revalorisation-exceptionnelle-de-laah",
      },
      {
        titre: "Allocation aux adultes handicapés : montant et conditions",
        organisme: "Service-public.fr",
        url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F12242",
      },
    ],
  },
  {
    id: "2017-sante-100-sante",
    mandatId: "macron-2017-2022",
    theme: "Santé",
    titre: "Rembourser intégralement lunettes, prothèses dentaires et aides auditives",
    extraitProgramme:
      "Nous mettrons en place la prise en charge à 100% des lunettes et des prothèses auditives et dentaires d’ici 2022, en lien avec les mutuelles et l’ensemble des professionnels de santé.",
    reformulation:
      "Supprimer le reste à payer sur les lunettes, les prothèses dentaires et les aides auditives d'ici 2022, avec les complémentaires santé.",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "La loi de financement de la sécurité sociale pour 2019 a créé le dispositif « 100 % santé », précisé par un décret du 11 janvier 2019 : une sélection d'équipements est prise en charge sans reste à payer par l'assurance maladie et les complémentaires santé dites responsables.",
    resultat:
      "La prise en charge intégrale s'applique depuis le 1er janvier 2020 à une sélection de lunettes et de prothèses dentaires, et depuis le 1er janvier 2021 à une sélection d'aides auditives, soit avant l'échéance de 2022.",
    justification:
      "Le dispositif existe, dans les délais, et associe les complémentaires santé comme le programme l'annonçait. Mais la prise en charge intégrale ne vaut que pour une sélection d'équipements, pas pour toutes les lunettes et prothèses.",
    interpretations:
      "Lecture stricte : le programme parlait de la prise en charge à 100 % des lunettes et des prothèses, sans restriction ; seule une sélection est concernée, l'engagement est partiel. Lecture par l'intention : chacun peut désormais s'équiper sans reste à payer, ce qui était l'objectif affiché. La prise en charge suppose aussi une complémentaire santé responsable. Le statut retenu est intermédiaire.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2018-12-22",
        description:
          "Loi de financement de la sécurité sociale pour 2019 : création du dispositif « 100 % santé » (article 51).",
      },
      {
        date: "2019-01-11",
        description:
          "Décret visant à garantir un accès sans reste à charge à certains équipements d'optique, aides auditives et soins prothétiques dentaires.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037995163",
      },
      {
        date: "2020-01-01",
        description: "Application aux lunettes et à une partie des prothèses dentaires.",
      },
      { date: "2021-01-01", description: "Application aux aides auditives." },
    ],
    sources: [
      {
        titre:
          "Décret n° 2019-21 du 11 janvier 2019 visant à garantir un accès sans reste à charge à certains équipements d'optique, aides auditives et soins prothétiques dentaires",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037995163",
        date: "2019-01-11",
      },
      {
        titre: "Le 100 % santé",
        organisme: "Ministère de la Santé",
        url: "https://sante.gouv.fr/systeme-de-sante/100-sante/",
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
    id: "2017-education-telephones",
    mandatId: "macron-2017-2022",
    theme: "Éducation",
    titre: "Interdire le téléphone portable à l'école et au collège",
    extraitProgramme:
      "Nous interdirons l’usage des téléphones portables dans l’enceinte des écoles primaires et des collèges.",
    reformulation:
      "Interdire aux élèves d'utiliser leur téléphone dans les écoles primaires et les collèges.",
    pageProgramme: "Chapitre « Les mêmes chances pour tous »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi du 3 août 2018 a inscrit dans le code de l'éducation l'interdiction de l'usage du téléphone portable par les élèves dans les écoles et les collèges, applicable depuis la rentrée 2018.",
    resultat:
      "L'interdiction s'applique aux écoles maternelles et élémentaires et aux collèges, sauf pour les usages pédagogiques et les exceptions prévues par le règlement intérieur.",
    justification:
      "La mesure annoncée figure dans la loi, sur le périmètre annoncé. La fiche porte sur l'existence de l'interdiction, pas sur son respect dans chaque établissement.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2018-08-03",
        description:
          "Loi relative à l'encadrement de l'utilisation du téléphone portable dans les établissements d'enseignement scolaire.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037284333",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2018-698 du 3 août 2018 relative à l'encadrement de l'utilisation du téléphone portable dans les établissements d'enseignement scolaire",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037284333",
        date: "2018-08-03",
      },
      {
        titre:
          "Interdiction de l'utilisation du téléphone portable à l'école et au collège, circulaire",
        organisme: "Bulletin officiel de l'Éducation nationale",
        url: "https://www.education.gouv.fr/bo/18/Hebdo35/MENE1826081C.htm",
      },
    ],
  },
  {
    id: "2017-culture-pass",
    mandatId: "macron-2017-2022",
    theme: "Culture",
    titre: "Créer un pass Culture de 500 euros à 18 ans",
    extraitProgramme:
      "Nous créerons un « Pass Culture ». Il permettra à chaque Français de 18 ans d’effectuer 500 euros de dépenses culturelles",
    reformulation:
      "Donner à chaque jeune de 18 ans 500 euros à dépenser en livres, spectacles, films et autres biens et sorties culturels.",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "Après une expérimentation de deux ans dans 14 départements, le pass Culture a été généralisé à tous les jeunes de 18 ans par un décret du 20 mai 2021.",
    resultat:
      "À la généralisation, le montant ouvert à 18 ans est de 300 euros. Le Gouvernement annonçait en même temps des montants versés à partir de 13 ans, pour un total de 500 euros sur l'ensemble de la scolarité.",
    justification:
      "Le programme annonçait 500 euros de dépenses culturelles à 18 ans. Le montant ouvert à cet âge est de 300 euros ; les 500 euros ne sont atteints qu'en additionnant des montants versés entre 13 et 17 ans.",
    interpretations:
      "Lecture stricte : l'engagement portait sur 500 euros à 18 ans, il est partiel. Lecture par le montant total reçu par un jeune au fil de sa scolarité, telle que la présentait le Gouvernement : il est atteint. Le statut suit le texte du programme.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2021-05-20",
        description: "Décret relatif au pass Culture : généralisation aux jeunes de 18 ans.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043518870",
      },
    ],
    sources: [
      {
        titre: "Décret n° 2021-628 du 20 mai 2021 relatif au « pass Culture »",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043518870",
        date: "2021-05-20",
      },
      {
        titre: "Généralisation du Pass culture pour tous les jeunes de 18 ans",
        organisme: "Service d'information du Gouvernement",
        url: "https://www.info.gouv.fr/actualite/generalisation-du-pass-culture-pour-tous-les-jeunes-de-18-ans",
        date: "2021-05-21",
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

  // --- Mandat 2022-2027 -----------------------------------------------------
  //
  // Le programme est la déclaration de candidature déposée auprès de la
  // commission de contrôle : deux pages, plus courtes que le programme de
  // 2017, mais c'est le document officiel de la campagne. Le mandat court :
  // un engagement non réalisé à la date de vérification ne l'est qu'à ce
  // jour, et la page le rappelle.
  {
    id: "2022-retraites-age-legal",
    mandatId: "macron-2022-2027",
    theme: "Retraites",
    titre: "Reporter l'âge légal de départ à la retraite à 65 ans",
    extraitProgramme:
      "Le financement de nos retraites par répartition sera pérennisé grâce au recul progressif à 65 ans de l’âge légal de départ à la retraite",
    reformulation: "Relever progressivement l'âge minimum de départ à la retraite de 62 à 65 ans.",
    pageProgramme: "Déclaration de candidature, texte principal",
    statut: "partiellement",
    confiance: "haute",
    actionMenee:
      "La loi de financement rectificative de la sécurité sociale pour 2023 a relevé l'âge légal de 62 à 64 ans, à raison de trois mois par génération à partir du 1er septembre 2023. La loi de financement de la sécurité sociale pour 2026 a suspendu ce relèvement jusqu'en janvier 2028.",
    resultat:
      "L'âge légal a commencé d'augmenter en septembre 2023, puis son relèvement a été suspendu. La cible fixée par la loi est 64 ans, et non les 65 ans annoncés.",
    justification:
      "Le programme annonçait un report à 65 ans. La loi votée fixe la cible à 64 ans, et la suspension, votée fin 2025, s'applique aux retraites prenant effet à partir du 1er septembre 2026 : les assurés nés de 1964 à 1968 atteignent l'âge légal un trimestre plus tôt que prévu, et l'âge légal reste de 64 ans à partir de la génération 1969. Une partie du relèvement est entrée en vigueur, pas l'âge annoncé.",
    interpretations:
      "Le mandat n'est pas terminé. En l'état du droit, le relèvement reprendrait en janvier 2028, après son terme. Le texte de 2023 a été adopté sans vote sur l'ensemble à l'Assemblée nationale, par l'article 49 alinéa 3 de la Constitution ; cela ne change pas le statut, qui porte sur la mise en oeuvre.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2023-04-14",
        description:
          "Loi de financement rectificative de la sécurité sociale pour 2023 : relèvement de l'âge légal de 62 à 64 ans (article 10).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000047445097",
      },
      {
        date: "2023-09-01",
        description:
          "Début du relèvement, de trois mois par génération, à partir des assurés nés le 1er septembre 1961.",
      },
      {
        date: "2025-12-30",
        description:
          "Loi de financement de la sécurité sociale pour 2026 : suspension jusqu'en janvier 2028 du calendrier de relèvement de l'âge légal et de la durée d'assurance.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053226384",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2023-270 du 14 avril 2023 de financement rectificative de la sécurité sociale pour 2023",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047445077",
        date: "2023-04-14",
      },
      {
        titre:
          "LOI n° 2025-1403 du 30 décembre 2025 de financement de la sécurité sociale pour 2026",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053226384",
        date: "2025-12-30",
      },
      {
        titre: "Loi de financement de la sécurité sociale 2026 : les mesures phares",
        organisme: "Ministère du Travail et des Solidarités",
        url: "https://solidarites.gouv.fr/loi-de-financement-de-la-securite-sociale-2026-les-mesures-phares",
        date: "2025-12-17",
      },
    ],
  },
  {
    id: "2022-retraites-minimum",
    mandatId: "macron-2022-2027",
    theme: "Retraites",
    titre: "Porter la retraite minimale à 1 100 euros pour une carrière complète",
    extraitProgramme: "La retraite minimale sera portée à 1 100 euros pour une carrière complète",
    reformulation:
      "Garantir une pension d'au moins 1 100 euros par mois aux personnes ayant accompli une carrière complète.",
    pageProgramme: "Déclaration de candidature, texte principal",
    statut: "partiellement",
    confiance: "moyenne",
    actionMenee:
      "La loi du 14 avril 2023 a relevé de 100 euros le montant majoré du minimum contributif, la pension minimale de base des salariés du privé et des indépendants, à compter du 1er septembre 2023, y compris pour des personnes déjà retraitées. Ce minimum est désormais revalorisé comme le SMIC.",
    resultat:
      "Selon la DREES, la réforme vise à ce qu'un salarié ayant fait toute sa carrière à temps plein au SMIC perçoive une pension brute tous régimes d'au moins 85 % du SMIC net, niveau vérifié en 2024. Cette année-là, le relèvement a augmenté la pension de 185 000 nouveaux retraités, de 30 euros par mois en moyenne.",
    justification:
      "Le minimum a été relevé, et une carrière complète au SMIC ouvre désormais droit au niveau visé par la réforme. Mais la garantie ne vaut pas pour toute carrière complète : la majoration est réservée aux assurés réunissant au moins 120 trimestres cotisés, et le minimum est réduit pour ceux qui ont cotisé moins longtemps.",
    interpretations:
      "Le programme ne précisait ni s'il s'agissait d'un montant brut ou net, ni ce qu'il entendait par carrière complète. Lecture large : une carrière complète au SMIC est désormais couverte. Lecture stricte : une carrière complète comportant moins de 120 trimestres cotisés n'est pas assurée d'atteindre ce montant. Le statut retenu est intermédiaire.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2023-09-01",
        description:
          "Relèvement de 100 euros du minimum contributif majoré, y compris pour des pensions déjà liquidées.",
      },
    ],
    sources: [
      {
        titre:
          "En 2024, la réforme du minimum contributif augmente la pension de 185 000 nouveaux retraités (Études et résultats n° 1297, février 2024)",
        organisme: "DREES",
        url: "https://drees.solidarites-sante.gouv.fr/sites/default/files/2024-02/ER1297.pdf",
      },
      {
        titre:
          "LOI n° 2023-270 du 14 avril 2023 de financement rectificative de la sécurité sociale pour 2023",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047445077",
        date: "2023-04-14",
      },
    ],
  },
  {
    id: "2022-travail-prime-partage-valeur",
    mandatId: "macron-2022-2027",
    theme: "Travail",
    titre: "Tripler la prime dite « Macron »",
    extraitProgramme: "Triplement de la prime dite « Macron »",
    reformulation:
      "Tripler le plafond de la prime que les employeurs peuvent verser à leurs salariés sans impôt ni cotisations.",
    pageProgramme: "Déclaration de candidature, « Un pacte pour la production »",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi du 16 août 2022 portant mesures d'urgence pour la protection du pouvoir d'achat a remplacé la prime exceptionnelle de pouvoir d'achat par la prime de partage de la valeur, exonérée dans la limite de 3 000 euros par salarié et par an, et de 6 000 euros dans les entreprises dotées d'un accord d'intéressement ou de participation.",
    resultat:
      "Le plafond d'exonération passe de 1 000 à 3 000 euros, et de 2 000 à 6 000 euros avec un accord d'intéressement : il est triplé. La prime reste facultative, et son versement dépend de chaque employeur.",
    justification:
      "Le programme annonçait un triplement : les deux plafonds sont multipliés par trois, trois mois après le début du mandat. La fiche porte sur le dispositif, pas sur les montants effectivement versés, que l'engagement ne chiffrait pas.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2022-08-16",
        description:
          "Loi portant mesures d'urgence pour la protection du pouvoir d'achat : création de la prime de partage de la valeur (article 1).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000046186741",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2022-1158 du 16 août 2022 portant mesures d'urgence pour la protection du pouvoir d'achat",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046186723",
        date: "2022-08-16",
      },
      {
        titre:
          "Loi du 16 août 2022 portant mesures d'urgence pour la protection du pouvoir d'achat",
        organisme: "Vie publique",
        url: "https://www.vie-publique.fr/loi/285608-loi-pouvoir-dachat-16-aout-2022",
      },
    ],
  },
  {
    id: "2022-fiscalite-redevance",
    mandatId: "macron-2022-2027",
    theme: "Fiscalité",
    titre: "Supprimer la redevance télé",
    extraitProgramme:
      "Les impôts continueront de baisser, avec la suppression de la redevance télé.",
    reformulation:
      "Supprimer la contribution à l'audiovisuel public, payée jusque-là avec la taxe d'habitation.",
    pageProgramme: "Déclaration de candidature, texte principal",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi de finances rectificative pour 2022, du 16 août 2022, a supprimé la contribution à l'audiovisuel public dès 2022.",
    resultat: "La contribution n'est plus due depuis l'année 2022.",
    justification:
      "La suppression annoncée a été votée trois mois après le début du mandat, et s'applique depuis l'année même de son vote.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2022-08-16",
        description:
          "Loi de finances rectificative pour 2022 : suppression de la contribution à l'audiovisuel public.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046186661",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2022-1157 du 16 août 2022 de finances rectificative pour 2022",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000046186661",
        date: "2022-08-16",
      },
      {
        titre: "La contribution à l'audiovisuel public est supprimée pour tous dès 2022",
        organisme: "Direction générale des finances publiques",
        url: "https://www.impots.gouv.fr/actualite/la-contribution-laudiovisuel-public-est-supprimee-pour-tous-des-2022",
      },
    ],
  },
  {
    id: "2022-fiscalite-successions",
    mandatId: "macron-2022-2027",
    theme: "Fiscalité",
    titre: "Exonérer les successions jusqu'à 150 000 euros par enfant",
    extraitProgramme:
      "Aucun impôt sur les successions jusqu’à 150 000 € par enfant, aucun impôt jusqu’à 100 000 € transmis à d’autres membres de la famille.",
    reformulation:
      "Relever de 100 000 à 150 000 euros la part d'héritage que chaque enfant reçoit sans impôt, et exonérer jusqu'à 100 000 euros ce qui est transmis aux autres membres de la famille.",
    pageProgramme: "Déclaration de candidature, « Un pacte pour la production »",
    statut: "non_realise",
    confiance: "haute",
    resultat:
      "L'abattement applicable à chaque enfant reste de 100 000 euros. Il est de 15 932 euros pour un frère ou une soeur, et de 7 967 euros pour un neveu ou une nièce.",
    justification:
      "Les abattements en vigueur, publiés par l'administration en février 2026, sont ceux d'avant l'engagement. Le mandat n'est pas terminé : l'engagement n'est pas réalisé à ce jour, ce qui ne préjuge pas de la suite.",
    verifieLe: "2026-09-14",
    sources: [
      {
        titre: "Droits de succession : évaluation de la succession et calcul des droits",
        organisme: "Service-public.fr",
        url: "https://www.service-public.gouv.fr/particuliers/vosdroits/F14198",
        date: "2026-02-09",
      },
    ],
  },
  {
    id: "2022-justice-recrutements",
    mandatId: "macron-2022-2027",
    theme: "Justice",
    titre: "Recruter 8 500 magistrats et personnels de justice d'ici 2027",
    extraitProgramme: "recruter 8 500 magistrats et personnels de justice en plus d’ici 2027",
    reformulation:
      "Augmenter de 8 500 les effectifs de magistrats et de personnels de la justice avant 2027.",
    pageProgramme: "Déclaration de candidature, « Un pacte pour la République »",
    statut: "en_cours",
    confiance: "moyenne",
    actionMenee:
      "La loi d'orientation et de programmation du ministère de la justice du 20 novembre 2023 fixe un objectif de 10 000 créations d'emplois d'ici 2027, dont 1 500 magistrats et 1 800 greffiers.",
    resultat:
      "Selon le rapport annuel d'exécution de la loi, 4 826 emplois en équivalent temps plein avaient été créés au 31 décembre 2024 sur son périmètre, pour une cible intermédiaire de 4 829.",
    justification:
      "La loi programme davantage d'emplois que le programme n'en annonçait, et la trajectoire était tenue fin 2024. Un emploi programmé n'est pas un emploi pourvu : le statut reste « en cours » jusqu'à l'échéance de 2027.",
    interpretations:
      "Le périmètre de la loi couvre l'ensemble du ministère, administration pénitentiaire comprise, ce qui correspond à la formule « personnels de justice » du programme. Selon le même rapport, les recrutements de greffiers étaient en retard sur la trajectoire fin 2024.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2023-11-20",
        description: "Loi d'orientation et de programmation du ministère de la justice 2023-2027.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048430512",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2023-1059 du 20 novembre 2023 d'orientation et de programmation du ministère de la justice 2023-2027",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048430512",
        date: "2023-11-20",
      },
      {
        titre:
          "Rapport annuel 2024 sur la mise en oeuvre de la loi d'orientation et de programmation du ministère de la justice",
        organisme: "Ministère de la Justice",
        url: "https://www.justice.gouv.fr/sites/default/files/2025-09/rapport_annuel_2024_lopj.pdf",
      },
    ],
  },
  {
    id: "2022-immigration-langue",
    mandatId: "macron-2022-2027",
    theme: "Immigration",
    titre: "Conditionner les titres de séjour longs à la maîtrise du français",
    extraitProgramme:
      "conditionnerons l'obtention des titres de séjour long à la maîtrise de notre langue et la connaissance de notre culture",
    reformulation:
      "Exiger un niveau de français et une connaissance de la culture française pour obtenir un titre de séjour de plusieurs années.",
    pageProgramme: "Déclaration de candidature, texte principal",
    statut: "realise",
    confiance: "haute",
    actionMenee:
      "La loi du 26 janvier 2024 pour contrôler l'immigration, améliorer l'intégration subordonne la première carte de séjour pluriannuelle et la carte de résident à un niveau minimal de français et à la réussite d'un examen civique. Un décret du 15 juillet 2025 en a fixé les modalités.",
    resultat:
      "Depuis le 1er janvier 2026, une première carte de séjour pluriannuelle ou une première carte de résident suppose un niveau de français attesté et la réussite d'un examen civique.",
    justification:
      "Le programme annonçait un conditionnement des titres de séjour longs à la langue et à la culture. La loi l'a instauré, et il s'applique depuis 2026.",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2024-01-26",
        description: "Loi pour contrôler l'immigration, améliorer l'intégration.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049040245",
      },
      {
        date: "2025-07-15",
        description:
          "Décret d'application relatif au contrat d'intégration républicaine et aux conditions de délivrance des titres de séjour.",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051900489",
      },
      {
        date: "2026-01-01",
        description: "Entrée en vigueur des conditions de langue et d'examen civique.",
      },
    ],
    sources: [
      {
        titre:
          "LOI n° 2024-42 du 26 janvier 2024 pour contrôler l'immigration, améliorer l'intégration",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049040245",
        date: "2024-01-26",
      },
      {
        titre:
          "Décret n° 2025-647 du 15 juillet 2025 relatif aux dispositions de l'article 20 de la loi n° 2024-42 du 26 janvier 2024",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051900489",
        date: "2025-07-15",
      },
    ],
  },
  {
    id: "2022-famille-garde-enfants",
    mandatId: "macron-2022-2027",
    theme: "Famille",
    titre: "Créer un droit opposable à la garde d'enfants",
    extraitProgramme: "un droit opposable à la garde d’enfants sera créé",
    reformulation:
      "Donner aux parents un droit à une solution de garde pour leur jeune enfant, qu'ils puissent faire valoir faute de place.",
    pageProgramme: "Déclaration de candidature, texte principal",
    statut: "en_cours",
    confiance: "moyenne",
    actionMenee:
      "La loi pour le plein emploi du 18 décembre 2023 a créé un service public de la petite enfance : depuis le 1er janvier 2025, les communes sont autorités organisatrices de l'accueil du jeune enfant, chargées notamment de recenser les besoins et l'offre et d'informer les familles.",
    resultat:
      "Le service public de la petite enfance organise l'offre d'accueil. Il ne crée pas de droit opposable, c'est-à-dire de droit qu'une famille pourrait faire valoir devant un juge faute de place.",
    justification:
      "Une étape a été franchie avec l'organisation d'un service public, mais le droit opposable annoncé n'existe pas à la date de vérification. Le mandat n'est pas terminé : le statut retenu est « en cours ».",
    verifieLe: "2026-09-14",
    actions: [
      {
        date: "2023-12-18",
        description:
          "Loi pour le plein emploi : création du service public de la petite enfance (article 17).",
        url: "https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000048581957",
      },
      {
        date: "2025-01-01",
        description:
          "Les communes deviennent autorités organisatrices de l'accueil du jeune enfant.",
      },
    ],
    sources: [
      {
        titre: "LOI n° 2023-1196 du 18 décembre 2023 pour le plein emploi",
        organisme: "Légifrance",
        url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000048581935",
        date: "2023-12-18",
      },
      {
        titre: "Loi du 18 décembre 2023 pour le plein emploi",
        organisme: "Vie publique",
        url: "https://www.vie-publique.fr/loi/289715-loi-plein-emploi-france-travail-rsa-handicap-du-18-decembre-2023",
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

/** Domaines dont on sait qu'ils refusent les requêtes automatisées. */
const DOMAINES_PROTEGES = ["legifrance.gouv.fr", "urssaf.fr", "economie.gouv.fr"];

/**
 * Un 403 n'est pas un lien mort.
 *
 * Légifrance refuse les requêtes automatisées : l'URL est valide, elle
 * s'ouvre dans un navigateur. Traiter ce refus comme une absence
 * supprimerait précisément les sources les plus solides du bilan, celles du
 * droit publié. Le script le signale donc au lieu de les écarter, et c'est à
 * la relecture humaine de les ouvrir.
 */
function etatLien(code: number | string, url: string): "ok" | "bloque" | "mort" {
  if (code === 200) return "ok";
  if (code === 403 || code === 401 || code === 429) return "bloque";
  // Une coupure de connexion sur un domaine connu pour filtrer n'est pas une
  // preuve d'absence : ces sites rejettent le client avant de répondre.
  if (DOMAINES_PROTEGES.some((d) => url.includes(d))) return "bloque";
  return "mort";
}

function programmeDuMandat(mandatId: string): string | undefined {
  for (const p of PRESIDENTS) {
    const m = p.mandats.find((x) => x.id === mandatId);
    if (m) return m.programmeUrl;
  }
  return undefined;
}

interface ControleEngagement {
  e: EngagementSource;
  extraitTrouve: boolean;
  sourcesMortes: string[];
  sourcesBloquees: number;
}

/** Contrôles de réseau d'un engagement : extrait dans le programme, sources vivantes. */
async function controlerEngagement(e: EngagementSource): Promise<ControleEngagement> {
  const programme = programmeDuMandat(e.mandatId);
  const extraitTrouve = programme ? await citationPresente(programme, e.extraitProgramme) : false;
  const sourcesMortes: string[] = [];
  let sourcesBloquees = 0;
  for (const s of e.sources) {
    const etat = etatLien(await tester(s.url), s.url);
    if (etat === "mort") sourcesMortes.push(s.url);
    if (etat === "bloque") sourcesBloquees += 1;
  }
  return { e, extraitTrouve, sourcesMortes, sourcesBloquees };
}

async function verifier(): Promise<void> {
  for (const p of PRESIDENTS) {
    console.log(`\n## ${p.prenom} ${p.nom}`);
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      const etat = etatLien(code, m.programmeUrl);
      console.log(`   ${etat === "ok" ? "OK " : "!! "}${String(code).padEnd(6)} ${m.libelle}`);
      console.log(`          ${m.programmeUrl}`);
    }
  }

  console.log(`\n## ${ENGAGEMENTS.length} engagements`);
  let introuvables = 0;
  let morts = 0;
  let bloques = 0;
  for (const e of ENGAGEMENTS) {
    const c = await controlerEngagement(e);
    if (!c.extraitTrouve) introuvables += 1;
    morts += c.sourcesMortes.length;
    bloques += c.sourcesBloquees;
    const extrait = c.extraitTrouve ? "extrait trouvé    " : "EXTRAIT INTROUVABLE";
    const sources =
      c.sourcesMortes.length > 0
        ? `${c.sourcesMortes.length} SOURCE(S) MORTE(S)`
        : `${e.sources.length} source(s), ${c.sourcesBloquees} bloquée(s)`;
    console.log(`   ${extrait}  ${e.id.padEnd(38)} ${sources}`);
    for (const u of c.sourcesMortes) console.log(`        morte : ${u}`);
  }
  console.log(
    `\n${introuvables} extrait(s) introuvable(s), ${morts} lien(s) mort(s), ` +
      `${bloques} bloqué(s) par le site (à ouvrir à la main, pas une absence).`,
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

  // Les contrôles de réseau d'abord, l'écriture ensuite, en une transaction :
  // une coupure réseau à mi-parcours ne doit pas laisser un bilan à moitié
  // rechargé.
  const mandatsRetenus = new Set<string>();
  for (const p of PRESIDENTS) {
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      if (code !== 200) {
        console.error(`Programme inatteignable (${code}), mandat ignoré : ${m.id}`);
        continue;
      }
      mandatsRetenus.add(m.id);
    }
  }

  const retenus: EngagementSource[] = [];
  for (const e of ENGAGEMENTS) {
    if (!mandatsRetenus.has(e.mandatId)) continue;
    const c = await controlerEngagement(e);
    if (!c.extraitTrouve) {
      console.error(`Extrait introuvable dans le programme, engagement ignoré : ${e.id}`);
      continue;
    }
    if (c.sourcesMortes.length > 0) {
      console.error(`Source morte, engagement ignoré : ${e.id} (${c.sourcesMortes.join(", ")})`);
      continue;
    }
    retenus.push(e);
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

  await db.transaction(async () => {
    // La suppression des mandats emporte, par cascade, engagements, actions
    // et sources.
    await db.query(`DELETE FROM enrichissement.mandat_presidentiel`);
    await db.query(`DELETE FROM enrichissement.president`);

    for (const p of PRESIDENTS) {
      await db.query(`INSERT INTO enrichissement.president (id, nom, prenom) VALUES ($1, $2, $3)`, [
        p.id,
        p.nom,
        p.prenom,
      ]);
      for (const m of p.mandats) {
        if (!mandatsRetenus.has(m.id)) continue;
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
      }
    }

    for (const e of retenus) {
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
    }
  });

  const ignores = ENGAGEMENTS.length - retenus.length;
  console.log(
    `${PRESIDENTS.length} président(s), ${mandatsRetenus.size} mandat(s), ` +
      `${retenus.length} engagement(s) écrit(s)` +
      (ignores > 0 ? `, ${ignores} ignoré(s)` : ""),
  );
  await db.close();
}

await main();
