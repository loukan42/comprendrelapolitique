/**
 * Normalisation des données Open Data de l'Assemblée nationale.
 *
 * Ce module concentre les pièges de format relevés dans docs/DATA_SOURCES.md.
 * Chaque fonction y correspond à une anomalie constatée dans la source, pas à
 * une précaution théorique.
 */

/**
 * La source encode ses valeurs nulles en objet `{"@xsi:nil": "true"}` plutôt
 * qu'en `null`, séquelle de la conversion mécanique depuis XML. Mesuré sur la
 * XVIe : 1 075 trigrammes, 420 professions, 405 villes de naissance.
 *
 * Sans cette normalisation, 420 députés auraient un objet JSON pour profession.
 */
export function estNil(valeur: unknown): boolean {
  return (
    typeof valeur === "object" &&
    valeur !== null &&
    !Array.isArray(valeur) &&
    (valeur as Record<string, unknown>)["@xsi:nil"] === "true"
  );
}

/** Remplace récursivement toutes les sentinelles xsi:nil par `null`. */
export function nettoyerNil<T>(valeur: T): T {
  if (estNil(valeur)) return null as T;
  if (Array.isArray(valeur)) return valeur.map(nettoyerNil) as T;
  if (typeof valeur === "object" && valeur !== null) {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur)) sortie[cle] = nettoyerNil(v);
    return sortie as T;
  }
  return valeur;
}

/**
 * Dans le jeu Acteurs, `uid` est un objet dont la valeur est sous `#text`.
 * Constaté sur 1 075 acteurs sur 1 075. Ailleurs (scrutins, dossiers) c'est
 * une chaîne. Cette fonction absorbe les deux.
 */
export function texte(valeur: unknown): string | null {
  if (valeur === null || valeur === undefined) return null;
  if (estNil(valeur)) return null;
  if (typeof valeur === "string") return valeur.length > 0 ? valeur : null;
  if (typeof valeur === "number") return String(valeur);
  if (typeof valeur === "object") {
    const t = (valeur as Record<string, unknown>)["#text"];
    return typeof t === "string" && t.length > 0 ? t : null;
  }
  return null;
}

export function entier(valeur: unknown): number | null {
  const t = texte(valeur);
  if (t === null) return null;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

/** La source écrit ses booléens en chaînes « true » / « false ». */
export function booleen(valeur: unknown): boolean | null {
  const t = texte(valeur);
  if (t === null) return null;
  if (t === "true" || t === "1") return true;
  if (t === "false" || t === "0") return false;
  return null;
}

/**
 * `dateActe` est un horodatage complet avec fuseau
 * (« 2023-03-17T00:00:00.000+01:00 »), là où d'autres champs sont des dates
 * simples. On garde l'horodatage quand il existe.
 */
export function horodatage(valeur: unknown): string | null {
  const t = texte(valeur);
  if (t === null) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Date simple, tronquée à `YYYY-MM-DD`. */
export function date(valeur: unknown): string | null {
  const t = texte(valeur);
  if (t === null || t.length < 10) return null;
  const j = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : null;
}

/**
 * La source alterne entre un objet seul et un tableau selon le nombre
 * d'éléments : un groupe unique n'est pas enveloppé dans un tableau. Toute
 * lecture d'une collection doit passer par ici.
 */
export function liste<T>(valeur: T | T[] | null | undefined): T[] {
  if (valeur === null || valeur === undefined) return [];
  if (estNil(valeur)) return [];
  return Array.isArray(valeur) ? valeur : [valeur];
}

// ---------------------------------------------------------------------------
// Clés de rapprochement scrutin <-> dossier
//
// Port de scripts/exploration/reconcilier_scrutins_dossiers.py. Les clés
// produites ici DOIVENT être identiques à celles de la version Python : la
// méthode a été mesurée avec elle (précision 100 %, couverture 95,5 %), et une
// divergence invaliderait cette mesure. Une comparaison automatique des deux
// implémentations est faite par scripts/import/verifier-cles.ts.
// ---------------------------------------------------------------------------

/** Minuscules, sans accents ni ponctuation, espaces normalisés. */
export function normaliser(texteBrut: string | null | undefined): string {
  if (!texteBrut) return "";
  return texteBrut
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Toutes ces expressions s'appliquent APRÈS normalisation, donc sur un texte
// sans parenthèses ni virgules. Piège rencontré et coûteux : écrire QUEUE avec
// des parenthèses la rend totalement inopérante et le rapprochement tombe à
// zéro correspondance.
const QUEUE =
  /\s+(?:(?:premiere|deuxieme|seconde|troisieme|nouvelle)\s+lecture|lecture\s+definitive|texte\s+de\s+la\s+commission(?:\s+mixte\s+paritaire)?|n\s+\d+)\b.*$/;

// Le « la|le » final couvre un libellé malformé rencontré en XVIe :
// « l'ensemble la proposition de loi », sans le « de ».
const PREFIX =
  /^(?:(?:premiere|deuxieme|seconde|troisieme)\s+partie\s+(?:du|de\s+la)\s+)?l\s+ensemble\s+(?:du|de\s+la|de\s+l|des|la|le)\s+/;

// Les lois de finances et de financement sont votées par parties.
const PARTIE = /^(?:premiere|deuxieme|seconde|troisieme)\s+partie\s+(?:du|de\s+la)\s+/;

// Clauses de procédure insérées au milieu du titre, présentes des deux côtés
// mais pas toujours simultanément.
const INSERT =
  /\s+(?:adoptee?\s+par\s+le\s+senat|adoptee?\s+par\s+l\s+assemblee\s+nationale|modifiee?\s+par\s+le\s+senat|apres\s+engagement\s+de\s+la\s+procedure\s+acceleree|avec\s+modifications)\b/g;

const EST_AMENDEMENT = /\bsous\s+amendements?\b|\bamendements?\b/;

function decrasser(t: string): string {
  return t.replace(PARTIE, "").replace(INSERT, " ").replace(/\s+/g, " ").trim();
}

/** Clé de rapprochement extraite du libellé d'objet d'un scrutin. */
export function cleTitreScrutin(libelle: string): string {
  return decrasser(normaliser(libelle).replace(PREFIX, "").replace(QUEUE, ""));
}

/** Clé de rapprochement extraite du titre principal d'un document. */
export function cleTitreDocument(titre: string): string {
  return decrasser(normaliser(titre).replace(QUEUE, ""));
}

/**
 * Un vote sur l'ensemble d'un texte : 801 scrutins sur 16 957, et le noyau de
 * tout le produit. Écarte les libellés contenant « l'ensemble » qui portent en
 * réalité sur un amendement.
 */
export function estVoteSurEnsemble(libelle: string): boolean {
  if (!libelle.toLowerCase().includes("l'ensemble")) return false;
  const avant = normaliser(libelle).split("l ensemble")[0] ?? "";
  return !EST_AMENDEMENT.test(avant);
}
