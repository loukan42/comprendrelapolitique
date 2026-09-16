/**
 * Références vers les programmes politiques publiés.
 *
 * Usage :
 *   node scripts/import/programmes.ts --db data/pg16 --verifier
 *   node scripts/import/programmes.ts --db data/pg16
 *
 * `--verifier` interroge chaque URL et affiche son code de réponse. Seules
 * les références dont l'URL répond sont écrites en base : un lien mort sur
 * une page qui prétend documenter est pire que pas de lien du tout.
 *
 * Ce fichier ne contient que des liens vers des documents publiés par les
 * partis eux-mêmes. Aucun contenu n'est recopié : un programme est une oeuvre
 * protégée, et surtout, résumer la position d'un parti à partir du résumé
 * d'un tiers revient à lui faire dire ce qu'il n'a pas écrit.
 *
 * Les sites agrégateurs qui comparent les programmes (ÉlyséeScope, Poligraph,
 * Présidoscope, le comparateur de l'iFRAP) ont servi à repérer le paysage,
 * jamais de source : chaque URL ci-dessous est sur le domaine du parti ou de
 * la campagne concernée.
 *
 * La `nature` est le champ qui évite le contresens. Plusieurs candidats ont
 * publié leur programme de campagne pour 2027 ; pour les autres, le document
 * cité est le plus récent de leur formation : programme présidentiel de
 * 2022, programme des législatives de 2024, propositions du parti, tribune
 * du candidat. Le lecteur doit savoir lequel il lit.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirBase, type Db } from "./db.ts";

type Nature =
  | "presidentiel_2017"
  | "presidentiel_2027"
  | "presidentiel_2022"
  | "legislatif_2024"
  | "europeen_2024"
  | "programme_parti"
  | "prise_de_position"
  | "projet_en_cours"
  | "aucun";

interface Reference {
  id: string;
  formation: string;
  candidat?: string;
  titre?: string;
  nature: Nature;
  datePublication?: string;
  url?: string;
  note?: string;
}

const REFERENCES: Reference[] = [
  {
    id: "lfi-avenir-en-commun",
    formation: "La France insoumise",
    candidat: "Jean-Luc Mélenchon",
    titre: "L'Avenir en commun",
    nature: "presidentiel_2027",
    datePublication: "2025-01-01",
    url: "https://programme.lafranceinsoumise.fr/",
    note: "Quatrième version du programme, publiée en janvier 2025. Le site de campagne melenchon2027.fr la présente comme le programme de la candidature et annonce une version réactualisée.",
  },
  {
    id: "lfi-avenir-en-commun-pdf",
    formation: "La France insoumise",
    candidat: "Jean-Luc Mélenchon",
    titre: "L'Avenir en commun, texte intégral (PDF)",
    nature: "presidentiel_2027",
    datePublication: "2025-01-01",
    url: "https://melenchon2027.fr/wp-content/uploads/2025/avenir_en_commun_2025.pdf",
  },
  {
    id: "rn-legislatives-2024",
    formation: "Rassemblement National",
    candidat: "Marine Le Pen",
    titre: "Programme des élections législatives de 2024",
    nature: "legislatif_2024",
    datePublication: "2024-06-01",
    url: "https://www.rassemblementnational.fr/documents/202406-programme.pdf",
    note: "Programme de législatives, pas de présidentielle.",
  },
  {
    id: "rn-europeennes-2024",
    formation: "Rassemblement National",
    titre: "Programme des élections européennes de 2024",
    nature: "europeen_2024",
    datePublication: "2024-11-01",
    url: "https://www.rassemblementnational.fr/documents/202411-programme-europeennes.pdf",
  },
  {
    id: "ps-projet",
    formation: "Parti socialiste",
    titre: "Le projet socialiste",
    nature: "projet_en_cours",
    url: "https://projet-socialiste.fr/",
    note: "Refondation du projet du parti, en cours. La primaire des 10 et 11 octobre 2026 désignera le candidat ; aucun programme présidentiel n'est publié à ce jour.",
  },
  // Les mesures du projet socialiste ne figurent pas sur la page d'accueil
  // du site, qui les présente sous forme de cartes à retourner : elles sont
  // dans les pages de chapitre. Les citations du comparateur en sont tirées.
  {
    id: "ps-vivre-libres",
    formation: "Parti socialiste",
    titre: "Le projet socialiste : Vivre libres",
    nature: "projet_en_cours",
    url: "https://projet-socialiste.fr/projet/vivre-libres/",
    note: "Chapitre du projet du parti consacré au travail, aux salaires et aux retraites.",
  },
  {
    id: "ps-refaire-societe",
    formation: "Parti socialiste",
    titre: "Le projet socialiste : Refaire société",
    nature: "projet_en_cours",
    url: "https://projet-socialiste.fr/projet/refaire-societe/",
    note: "Chapitre consacré à la fiscalité, aux services publics et à l'immigration.",
  },
  {
    id: "ps-etre-en-securites",
    formation: "Parti socialiste",
    titre: "Le projet socialiste : Être en sécurité(s)",
    nature: "projet_en_cours",
    url: "https://projet-socialiste.fr/projet/etre-en-securites/",
    note: "Chapitre consacré à la santé, à la sécurité publique et à l'environnement.",
  },
  {
    id: "pcf-programme",
    formation: "Parti communiste français",
    candidat: "Fabien Roussel",
    titre: "180 propositions pour un nouveau pacte social, écologique et républicain",
    nature: "projet_en_cours",
    url: "https://www.pcf.fr/le_programme",
    note: "Programme du parti, accompagné des « Cahiers des jours heureux » par thème.",
  },
  {
    id: "lr-propositions",
    formation: "Les Républicains",
    titre: "Nos propositions",
    nature: "programme_parti",
    url: "https://republicains.fr/nos-propositions/",
  },
  {
    id: "renaissance-conventions",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Conventions thématiques : nouvelle donne économique et climatique",
    nature: "projet_en_cours",
    url: "https://doc.parti.re/Conventions-thematiques_Nouvelle-donne.pdf",
    note: "Restitution des conventions thématiques du parti. Le programme présidentiel de Gabriel Attal se complète par étapes.",
  },
  {
    id: "renaissance-regalien",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Conventions thématiques : une République ferme, une France apaisée",
    nature: "projet_en_cours",
    url: "https://doc.parti.re/conventions/Restitution-Regalien-Une-Republique-ferme-une-France-apaisee.pdf",
  },

  // Programmes de campagne pour 2027, publiés par les candidats sur leur
  // site, une page par chapitre : c'est la page du chapitre, et non
  // l'accueil du site, qui porte le texte cité.
  {
    id: "attal-ecole",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : École",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/education",
  },
  {
    id: "attal-travail",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : Travail et salaires",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/travail-salaires",
  },
  {
    id: "attal-frontieres",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : Frontières",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/frontieres",
  },
  {
    id: "attal-dette-etat",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : Dette de l'État",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/dette-de-letat",
  },
  {
    id: "attal-dette-ecologique",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : Dette écologique",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/dette-ecologique",
  },
  {
    id: "attal-ia",
    formation: "Renaissance",
    candidat: "Gabriel Attal",
    titre: "Chantiers capitaux : Intelligence artificielle",
    nature: "presidentiel_2027",
    url: "https://attalpresident.fr/programme/intelligence-artificielle",
  },
  {
    id: "philippe-sure",
    formation: "Horizons",
    candidat: "Édouard Philippe",
    titre: "Les priorités : Pour une France plus sûre",
    nature: "presidentiel_2027",
    url: "https://www.edouardphilippe.fr/priorites/pour-une-france-plus-sure",
  },
  {
    id: "philippe-prospere",
    formation: "Horizons",
    candidat: "Édouard Philippe",
    titre: "Les priorités : Pour une France plus prospère",
    nature: "presidentiel_2027",
    url: "https://www.edouardphilippe.fr/priorites/pour-une-france-plus-prospere",
  },
  {
    id: "philippe-enfants",
    formation: "Horizons",
    candidat: "Édouard Philippe",
    titre: "Les priorités : Pour une France plus attentive à ses enfants",
    nature: "presidentiel_2027",
    url: "https://www.edouardphilippe.fr/priorites/pour-une-france-plus-attentive-a-ses-enfants",
  },
  {
    id: "philippe-conquerante",
    formation: "Horizons",
    candidat: "Édouard Philippe",
    titre: "Les priorités : Pour une France plus conquérante",
    nature: "presidentiel_2027",
    url: "https://www.edouardphilippe.fr/priorites/pour-une-france-plus-conquerante",
  },

  // Candidats sans programme de campagne 2027 publié à ce jour : le document
  // cité est le plus récent de leur formation, et sa nature le dit.
  {
    id: "rn-presidentiel-2022",
    formation: "Rassemblement National",
    candidat: "Marine Le Pen",
    titre: "M la France, programme présidentiel de 2022",
    nature: "presidentiel_2022",
    url: "https://mlafrance.fr/programme",
    note: "Programme de la présidentielle de 2022, toujours en ligne sur le site de la candidate. Cité faute de programme pour 2027 publié sur ce site.",
  },
  // Archives 2017. Renaissance Numérique publie ici des synthèses des mesures
  // numériques présentes dans les programmes, pas les programmes complets.
  // La limite est conservée dans la note affichée au lecteur.
  {
    id: "renaissance-numerique-2017-fillon",
    formation: "Les Républicains",
    candidat: "François Fillon",
    titre: "Programme numérique de la campagne 2017",
    nature: "presidentiel_2017",
    datePublication: "2017-02-21",
    url: "https://www.renaissancenumerique.org/wp-content/uploads/2022/08/renaissancenumerique_fiche_id_numerique_-franccca7ois_fillon.pdf",
    note: "Synthèse thématique de Renaissance Numérique : elle couvre les mesures numériques recensées, pas l'intégralité du programme présidentiel.",
  },
  {
    id: "renaissance-numerique-2017-hamon",
    formation: "Parti socialiste",
    candidat: "Benoît Hamon",
    titre: "Programme numérique de la campagne 2017",
    nature: "presidentiel_2017",
    datePublication: "2017-02-21",
    url: "https://www.renaissancenumerique.org/wp-content/uploads/2022/08/renaissancenumerique_fiche_id_numerique_-benoit_hamon.pdf",
    note: "Synthèse thématique de Renaissance Numérique : elle couvre les mesures numériques recensées, pas l'intégralité du programme présidentiel.",
  },
  {
    id: "renaissance-numerique-2017-macron",
    formation: "En Marche !",
    candidat: "Emmanuel Macron",
    titre: "Programme numérique de la campagne 2017",
    nature: "presidentiel_2017",
    datePublication: "2017-02-21",
    url: "https://www.renaissancenumerique.org/wp-content/uploads/2022/08/renaissancenumerique_fiche_id_numerique_macron.pdf",
    note: "Synthèse thématique de Renaissance Numérique : elle couvre les mesures numériques recensées, pas l'intégralité du programme présidentiel.",
  },
  {
    id: "renaissance-numerique-2017-le-pen",
    formation: "Front national",
    candidat: "Marine Le Pen",
    titre: "Programme numérique de la campagne 2017",
    nature: "presidentiel_2017",
    datePublication: "2017-02-21",
    url: "https://www.renaissancenumerique.org/wp-content/uploads/2022/08/renaissancenumerique_fiche_id_numerique_mlp.pdf",
    note: "Synthèse thématique de Renaissance Numérique : elle couvre les mesures numériques recensées, pas l'intégralité du programme présidentiel.",
  },
  {
    id: "renaissance-numerique-2017-melenchon",
    formation: "La France insoumise",
    candidat: "Jean-Luc Mélenchon",
    titre: "Programme numérique de la campagne 2017",
    nature: "presidentiel_2017",
    datePublication: "2017-02-21",
    url: "https://www.renaissancenumerique.org/wp-content/uploads/2022/08/renaissancenumerique_fiche_id_numerique-_jlm.pdf",
    note: "Synthèse thématique de Renaissance Numérique : elle couvre les mesures numériques recensées, pas l'intégralité du programme présidentiel.",
  },
  // Déclarations officielles du premier tour de 2022. La CNCCEP publie la
  // profession de foi de chaque candidat ; ces PDF sont les documents de
  // référence historiques, distincts des programmes 2027.
  {
    id: "cnccep-2022-arthaud",
    formation: "Lutte ouvrière",
    candidat: "Nathalie Arthaud",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-01-Nathalie-Arthaud-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-dupont-aignan",
    formation: "Debout la France",
    candidat: "Nicolas Dupont-Aignan",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-02-Nicolas-Dupont-Aignan-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-hidalgo",
    formation: "Parti socialiste",
    candidat: "Anne Hidalgo",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-03-Anne-Hidalgo-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-jadot",
    formation: "Europe Écologie Les Verts",
    candidat: "Yannick Jadot",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-04-Yannick-Jadot-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-lassalle",
    formation: "Résistons !",
    candidat: "Jean Lassalle",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-05-Jean-Lassalle-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-le-pen",
    formation: "Rassemblement National",
    candidat: "Marine Le Pen",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-06-Marine-Le-Pen-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-macron",
    formation: "La République en marche",
    candidat: "Emmanuel Macron",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-07-Emmanuel-Macron-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-melenchon",
    formation: "La France insoumise",
    candidat: "Jean-Luc Mélenchon",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-08-Jean-Luc-Melenchon-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-pecresse",
    formation: "Les Républicains",
    candidat: "Valérie Pécresse",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-09-Valerie-Pecresse-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-poutou",
    formation: "Nouveau Parti anticapitaliste",
    candidat: "Philippe Poutou",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-10-Philippe-Poutou-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-roussel",
    formation: "Parti communiste français",
    candidat: "Fabien Roussel",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-11-Fabien-Roussel-Declaration-accessible.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "cnccep-2022-zemmour",
    formation: "Reconquête",
    candidat: "Éric Zemmour",
    titre: "Déclaration officielle, présidentielle 2022",
    nature: "presidentiel_2022",
    url: "https://www.cnccep.fr/pdfs/Candidat-12-Eric-Zemmour-Declaration.pdf",
    note: "Profession de foi officielle du premier tour, publiée par la Commission nationale de contrôle de la campagne électorale.",
  },
  {
    id: "lr-priorite-travail",
    formation: "Les Républicains",
    candidat: "Bruno Retailleau",
    titre: "« Priorité travail », tribune de Bruno Retailleau",
    nature: "prise_de_position",
    datePublication: "2026-05-02",
    url: "https://republicains.fr/actualites/2026/05/02/priorite-travail-france-35h-salaires-retraites/",
    note: "Tribune parue dans La Tribune Dimanche et reprise sur le site du parti.",
  },
  {
    id: "lr-energie",
    formation: "Les Républicains",
    candidat: "Bruno Retailleau",
    titre:
      "Rebâtir un parc nucléaire et stopper le financement des renouvelables, notre plan pour l'énergie",
    nature: "prise_de_position",
    datePublication: "2025-07-02",
    url: "https://republicains.fr/actualites/2025/07/02/rebatir-un-parc-nucleaire-et-stopper-le-financement-des-renouvelables-notre-plan-pour-lenergie/",
    note: "Tribune de Bruno Retailleau, François-Xavier Bellamy et Julien Aubert, reprise sur le site du parti.",
  },
  {
    id: "lr-travail-gagnant",
    formation: "Les Républicains",
    candidat: "Bruno Retailleau",
    titre: "Nos propositions pour la France : travail gagnant",
    nature: "programme_parti",
    url: "https://republicains.fr/wp-content/uploads/2026/01/LesRepublicains_NosPropositionsPourLaFrance_TravailGagnant.pdf",
  },
  {
    id: "lr-produire-plus",
    formation: "Les Républicains",
    candidat: "Bruno Retailleau",
    titre: "Nos propositions pour la France : produire plus",
    nature: "programme_parti",
    url: "https://republicains.fr/wp-content/uploads/2026/02/LR_Produire_Plus_LIVRET.pdf",
  },
  {
    id: "ne-ambition",
    formation: "Nouvelle Énergie",
    candidat: "David Lisnard",
    titre: "Notre programme : Réussir une nouvelle ambition française",
    nature: "programme_parti",
    url: "https://www.unenouvelleenergie.fr/notre-programme/reussir-une-nouvelle-ambition-francaise/",
  },
  {
    id: "ne-destin",
    formation: "Nouvelle Énergie",
    candidat: "David Lisnard",
    titre: "Notre programme : Être maître de notre destin",
    nature: "programme_parti",
    url: "https://www.unenouvelleenergie.fr/notre-programme/etre-maitre-de-notre-destin/",
  },
  {
    id: "ne-civique",
    formation: "Nouvelle Énergie",
    candidat: "David Lisnard",
    titre: "Notre programme : Générer un renouveau civique",
    nature: "programme_parti",
    url: "https://www.unenouvelleenergie.fr/notre-programme/generer-un-renouveau-civique/",
  },
  {
    id: "pcf-10-propositions",
    formation: "Parti communiste français",
    candidat: "Fabien Roussel",
    titre: "Les 10 propositions du PCF pour la France",
    nature: "programme_parti",
    url: "https://www.pcf.fr/actualite_les_10_propositions_du_pcf_pour_la_france",
  },

  // Formations et personnalités suivies, sans programme publié à ce jour.
  // L'absence est affichée : elle informe le lecteur autant qu'un lien, et
  // évite qu'il conclue à un oubli du site.
  {
    id: "ecologistes-aucun",
    formation: "Les Écologistes",
    candidat: "Marine Tondelier",
    nature: "aucun",
    note: "Site du parti inaccessible à la vérification automatique ; aucune référence retenue tant qu'une URL n'a pas été contrôlée.",
  },
  {
    id: "pp-acte-1",
    formation: "Place publique",
    candidat: "Raphaël Glucksmann",
    titre: "L'Acte I, notre vision pour la France",
    nature: "programme_parti",
    url: "https://place-publique.eu/document/3Ari5O0s5O1L4iK1uyUhI0/pp-acte-un.pdf",
    note: "Premier texte du projet du parti, en 42 chantiers. Raphaël Glucksmann est candidat à la primaire de la gauche d'octobre 2026.",
  },
  {
    id: "ps-primaire-guedj",
    formation: "Parti socialiste",
    candidat: "Jérôme Guedj",
    nature: "aucun",
    note: "Candidat à la primaire des 10 et 11 octobre 2026. Aucun programme présidentiel publié à ce jour.",
  },
  {
    id: "ps-primaire-brun",
    formation: "Parti socialiste",
    candidat: "Philippe Brun",
    nature: "aucun",
    note: "Candidat à la primaire des 10 et 11 octobre 2026. Aucun programme présidentiel publié à ce jour.",
  },
  {
    id: "ps-primaire-verdier",
    formation: "Parti socialiste",
    candidat: "Fabien Verdier",
    nature: "aucun",
    note: "Candidat à la primaire des 10 et 11 octobre 2026, déclaré le 3 septembre 2026. Aucun programme présidentiel publié à ce jour.",
  },
  {
    id: "grs-maurel",
    formation: "Gauche républicaine et socialiste",
    candidat: "Emmanuel Maurel",
    nature: "aucun",
    note: "Candidat à la primaire des 10 et 11 octobre 2026. Aucun programme présidentiel publié à ce jour.",
  },
  {
    id: "ruffin-aucun",
    formation: "Debout ! (François Ruffin)",
    candidat: "François Ruffin",
    nature: "aucun",
    note: "Aucun document de programme publié à ce jour.",
  },
  {
    id: "batho-aucun",
    formation: "Génération Écologie",
    candidat: "Delphine Batho",
    nature: "aucun",
    note: "Aucun document de programme publié à ce jour.",
  },
];

const MIGRATION = resolve("db/migrations/006_programmes.sql");
const MIGRATION_NATURES = resolve("db/migrations/009_natures_programme.sql");
const MIGRATION_2017 = resolve("db/migrations/011_nature_programme_2017.sql");

/** Contrôle d'accessibilité. Une URL qui ne répond pas n'est pas publiée. */
async function tester(url: string): Promise<number | string> {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "comprendrelapolitique/0.1 (verification de lien)" },
      signal: AbortSignal.timeout(20000),
    });
    return r.status;
  } catch (e) {
    return e instanceof Error ? e.name : "échec";
  }
}

async function verifier(): Promise<void> {
  for (const r of REFERENCES) {
    if (!r.url) {
      console.log(
        `     --- ${r.formation}${r.candidat ? ` / ${r.candidat}` : ""} : aucun document`,
      );
      continue;
    }
    const code = await tester(r.url);
    const ok = code === 200;
    console.log(`     ${ok ? "OK " : "!! "}${String(code).padEnd(6)} ${r.formation} | ${r.url}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;

  if (args.includes("--verifier")) {
    await verifier();
    return;
  }

  if (!chemin) {
    console.error("usage: programmes.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db: Db = await ouvrirBase(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'programme') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 006 appliquée");
  }
  // Idempotente : ajoute les natures de document aux bases créées avant elle.
  await appliquerMigration(db, MIGRATION_NATURES);
  await appliquerMigration(db, MIGRATION_2017);

  await db.query(`DELETE FROM enrichissement.programme`);
  let ecrites = 0;
  let ignorees = 0;
  for (const r of REFERENCES) {
    let verifieLe: string | null = null;
    if (r.url) {
      const code = await tester(r.url);
      if (code !== 200) {
        console.error(`Lien inaccessible (${code}), référence ignorée : ${r.id} ${r.url}`);
        ignorees += 1;
        continue;
      }
      verifieLe = new Date().toISOString();
    }
    await db.query(
      `INSERT INTO enrichissement.programme
         (id, formation, candidat, titre, nature, date_publication, url, verifie_le, note)
       VALUES ($1,$2,$3,$4,$5::enrichissement.nature_programme,$6,$7,$8,$9)`,
      [
        r.id,
        r.formation,
        r.candidat ?? null,
        r.titre ?? null,
        r.nature,
        r.datePublication ?? null,
        r.url ?? null,
        verifieLe,
        r.note ?? null,
      ],
    );
    ecrites += 1;
  }

  console.log(
    `${ecrites} références écrites` + (ignorees > 0 ? `, ${ignorees} ignorées (lien mort)` : ""),
  );
  await db.close();
}

await main();
