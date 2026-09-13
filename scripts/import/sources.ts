/**
 * Table des jeux Open Data de l'Assemblée nationale.
 *
 * Ces URLs sont une table explicite, et non des chaînes construites par
 * interpolation de la législature. Le nommage de la source n'est pas uniforme :
 * la XVe suffixe ses fichiers en `_XV` et range les amendements dans
 * `amendements_legis` là où les XVIe et XVIIe utilisent
 * `amendements_div_legis`. Toute tentative de déduire l'URL échouerait sur la
 * XVe (voir docs/DATA_SOURCES.md section 1.1).
 *
 * Chaque URL de ce fichier a été appelée et vérifiée le 13 septembre 2026.
 */

export type Jeu = "scrutins" | "dossiers" | "acteurs" | "amendements" | "debats";

export interface Source {
  jeu: Jeu;
  legislature: 15 | 16 | 17;
  url: string;
  /** Format réel de l'archive. Les débats n'existent qu'en XML. */
  format: "json" | "xml";
  /** Taille compressée constatée, en méga-octets. Indicative. */
  tailleMo: number;
}

const BASE = "https://data.assemblee-nationale.fr/static/openData/repository";

export const SOURCES: Source[] = [
  // --- Scrutins : le cœur du produit, et le moins volumineux ------------------
  {
    jeu: "scrutins",
    legislature: 15,
    format: "json",
    tailleMo: 8.8,
    url: `${BASE}/15/loi/scrutins/Scrutins_XV.json.zip`,
  },
  {
    jeu: "scrutins",
    legislature: 16,
    format: "json",
    tailleMo: 9.7,
    url: `${BASE}/16/loi/scrutins/Scrutins.json.zip`,
  },
  {
    jeu: "scrutins",
    legislature: 17,
    format: "json",
    tailleMo: 26,
    url: `${BASE}/17/loi/scrutins/Scrutins.json.zip`,
  },

  // --- Dossiers législatifs : portent aussi les documents ---------------------
  {
    jeu: "dossiers",
    legislature: 15,
    format: "json",
    tailleMo: 15,
    url: `${BASE}/15/loi/dossiers_legislatifs/Dossiers_Legislatifs_XV.json.zip`,
  },
  {
    jeu: "dossiers",
    legislature: 16,
    format: "json",
    tailleMo: 8.7,
    url: `${BASE}/16/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`,
  },
  {
    jeu: "dossiers",
    legislature: 17,
    format: "json",
    tailleMo: 9.9,
    url: `${BASE}/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`,
  },

  // --- Acteurs, mandats et organes -------------------------------------------
  {
    jeu: "acteurs",
    legislature: 15,
    format: "json",
    tailleMo: 3.1,
    url: `${BASE}/15/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes_XV.json.zip`,
  },
  {
    jeu: "acteurs",
    legislature: 16,
    format: "json",
    tailleMo: 2.3,
    url: `${BASE}/16/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip`,
  },
  {
    jeu: "acteurs",
    legislature: 17,
    format: "json",
    tailleMo: 2.5,
    url: `${BASE}/17/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip`,
  },

  // --- Hors MVP : 95 % du volume pour une part marginale du produit -----------
  {
    jeu: "amendements",
    legislature: 15,
    format: "json",
    tailleMo: 619,
    url: `${BASE}/15/loi/amendements_legis/Amendements_XV.json.zip`,
  },
  {
    jeu: "amendements",
    legislature: 16,
    format: "json",
    tailleMo: 347,
    url: `${BASE}/16/loi/amendements_div_legis/Amendements.json.zip`,
  },
  {
    jeu: "amendements",
    legislature: 17,
    format: "json",
    tailleMo: 284,
    url: `${BASE}/17/loi/amendements_div_legis/Amendements.json.zip`,
  },

  {
    jeu: "debats",
    legislature: 15,
    format: "xml",
    tailleMo: 143,
    url: `${BASE}/15/vp/syceronbrut/syseron.xml.zip`,
  },
  {
    jeu: "debats",
    legislature: 16,
    format: "xml",
    tailleMo: 55,
    url: `${BASE}/16/vp/syceronbrut/syseron.xml.zip`,
  },
  {
    jeu: "debats",
    legislature: 17,
    format: "xml",
    tailleMo: 54,
    url: `${BASE}/17/vp/syceronbrut/syseron.xml.zip`,
  },
];

/**
 * Historique transversal des acteurs, couvrant toutes les législatures depuis
 * la XIe. Source à privilégier pour reconstituer les appartenances successives
 * de groupe avec leurs dates.
 */
export const ACTEURS_HISTORIQUE = `${BASE}/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`;

/** Les jeux nécessaires et suffisants au MVP : 86 Mo sur trois législatures. */
export const JEUX_MVP: Jeu[] = ["acteurs", "dossiers", "scrutins"];

export interface Legislature {
  id: 15 | 16 | 17;
  dateDebut: string;
  dateFin: string | null;
  /**
   * Une législature archivée s'importe une fois et n'est plus interrogée.
   * Dernière modification constatée : XVe le 09/06/2022, XVIe le 28/06/2024.
   */
  archivee: boolean;
}

export const LEGISLATURES: Legislature[] = [
  { id: 15, dateDebut: "2017-06-21", dateFin: "2022-06-21", archivee: true },
  { id: 16, dateDebut: "2022-06-22", dateFin: "2024-06-09", archivee: true },
  { id: 17, dateDebut: "2024-07-18", dateFin: null, archivee: false },
];

/**
 * La XVIIe se republie chaque nuit entre environ 22:00 et 06:30 UTC, jeu par
 * jeu. Une synchronisation lancée dans cette fenêtre lit un état incohérent
 * entre scrutins, dossiers et acteurs.
 */
export const HEURE_SYNCHRO_UTC = 7;

export function sourcesPour(legislature: number, jeux: Jeu[] = JEUX_MVP): Source[] {
  return SOURCES.filter((s) => s.legislature === legislature && jeux.includes(s.jeu));
}
