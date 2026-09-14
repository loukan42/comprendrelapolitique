/**
 * Vérification d'une citation contre son document source.
 *
 * Partagé par `positions_programme.ts` (citations des programmes des partis)
 * et `bilans.ts` (extraits des programmes présidentiels) : les deux affichent
 * une phrase comme étant celle d'un auteur, et la faute redoutée est la même,
 * une reformulation qui se glisserait à la place du texte. Un seul code de
 * vérification évite que l'un des deux corpus soit contrôlé moins
 * sévèrement que l'autre.
 *
 * La comparaison est insensible à la casse, aux accents et aux espaces
 * multiples : les programmes en ligne appliquent souvent des majuscules par
 * CSS, et le texte extrait d'une page ne reproduit pas fidèlement ses espaces.
 * Elle reste sensible aux mots, qui sont ce qui compte.
 */

import { decoderEntitesHtml } from "../../src/lib/entites-html.ts";

/**
 * Réduit un texte à ce qui compte pour la comparaison : les mots.
 *
 * Les ligatures sont traitées à part, par `plierLigatures`, et seulement en
 * repli : voir `citationPresente`.
 */
export function normaliser(texte: string): string {
  return (
    texte
      .normalize("NFD")
      // Marques diacritiques laissées par la décomposition NFD.
      .replace(/[\u0300-\u036f]/g, "")
      // Apostrophes et guillemets typographiques.
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      // Espaces insécables, fines ou non, fréquentes dans les pages des partis.
      .replace(/[\u00a0\u202f\u2009]/g, " ")
      // Césure de fin de ligne des PDF : « précoce-\nment » redevient un mot.
      .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2")
      .toLowerCase()
      .replace(/[^a-z0-9\x27€%]+/g, " ")
      .trim()
  );
}

/** Ramène les ligatures à un simple f, pour le seul repli de comparaison. */
function plierLigatures(texteNormalise: string): string {
  return texteNormalise.replace(/ff[il]?|f[il]/g, "f");
}

/**
 * Entités nommées rencontrées dans les pages des partis, en plus de celles
 * que `decoderEntitesHtml` connaît déjà. Sans elles, « l&rsquo;assurance »
 * resterait « l rsquo assurance » et la citation serait déclarée introuvable
 * alors qu'elle figure bien dans la page.
 */
const ENTITES_TYPO: Record<string, string> = {
  rsquo: "’",
  lsquo: "‘",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ocirc: "ô",
  icirc: "î",
  ucirc: "û",
  ugrave: "ù",
  Eacute: "É",
};

function texteDeHtml(brut: string): string {
  const sansBalises = brut
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&([a-zA-Z]+);/g, (m, nom: string) => ENTITES_TYPO[nom] ?? m);
  return decoderEntitesHtml(sansBalises);
}

const ENTETES = { "user-agent": "comprendrelapolitique/0.1 (verification de citation)" };

/**
 * Extrait le texte d'un PDF via `pdftotext`, présent sur la machine de
 * développement. Sans cela, les programmes publiés en PDF, dont ceux de La
 * France insoumise, du Rassemblement National et d'Emmanuel Macron,
 * resteraient hors de portée de la vérification.
 *
 * Deux extractions, et la citation doit figurer dans l'une d'elles. Le mode
 * `-layout` respecte la mise en page, mais sur un document à deux colonnes il
 * entrelace les lignes des deux colonnes, et une phrase qui passe à la ligne
 * y devient introuvable. Le mode par défaut suit l'ordre de lecture, mais
 * découpe parfois autrement les tableaux. Chercher dans les deux évite de
 * rejeter une citation exacte pour une raison de mise en page, sans rien
 * relâcher sur les mots.
 */
async function textePdf(url: string): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { writeFile, readFile, rm, mkdtemp } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const dossier = await mkdtemp(join(tmpdir(), "prog-"));
  const pdf = join(dossier, "doc.pdf");
  const mise = join(dossier, "mise.txt");
  const lecture = join(dossier, "lecture.txt");
  try {
    const r = await fetch(url, { headers: ENTETES, signal: AbortSignal.timeout(180000) });
    await writeFile(pdf, Buffer.from(await r.arrayBuffer()));
    const executer = promisify(execFile);
    await executer("pdftotext", ["-layout", "-enc", "UTF-8", pdf, mise]);
    await executer("pdftotext", ["-enc", "UTF-8", pdf, lecture]);
    const textes = await Promise.all([readFile(mise, "utf8"), readFile(lecture, "utf8")]);
    return textes.map(normaliser).join("\n");
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
}

const cache = new Map<string, Promise<string>>();

/** Texte normalisé du document, téléchargé une fois par exécution. */
export function texteDuDocument(url: string): Promise<string> {
  let texte = cache.get(url);
  if (!texte) {
    texte = url.toLowerCase().endsWith(".pdf")
      ? textePdf(url)
      : fetch(url, { headers: ENTETES, signal: AbortSignal.timeout(30000) })
          .then((r) => r.text())
          .then((brut) => normaliser(texteDeHtml(brut)));
    cache.set(url, texte);
  }
  return texte;
}

/**
 * La citation figure-t-elle mot pour mot dans le document ? Une erreur de
 * téléchargement répond non : une citation qu'on n'a pas pu vérifier n'est
 * pas vérifiée.
 */
export async function citationPresente(url: string, extrait: string): Promise<boolean> {
  try {
    const document = await texteDuDocument(url);
    const cherche = normaliser(extrait);
    if (document.includes(cherche)) return true;
    // Repli pour les PDF qui déclarent mal leurs ligatures : la déclaration
    // de candidature de 2022 sort « confance » pour « confiance », « efcace »
    // pour « efficace ». Les deux côtés sont pliés de la même façon. Le repli
    // ne sert que si la comparaison exacte échoue : quand le document est bien
    // encodé, deux formulations qui ne différeraient que par ces lettres ne
    // passent pas pour identiques.
    return plierLigatures(document).includes(plierLigatures(cherche));
  } catch {
    return false;
  }
}
