/**
 * Décodage minimal des entités HTML rencontrées dans certains champs texte de
 * la source (notamment `amendement.auteur_libelle`, qui arrive encodé :
 * `&#160;`, `&apos;`, `&#233;`…). L'import ne les normalise pas encore : ce
 * décodage se fait donc à l'affichage plutôt que d'inventer une valeur.
 */

const ENTITES_NOMMEES: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
};

export function decoderEntitesHtml<T extends string | null | undefined>(texte: T): T {
  if (texte == null) return texte;
  return texte.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (correspondance, entite: string) => {
    if (entite[0] === "#") {
      const estHexa = entite[1] === "x" || entite[1] === "X";
      const code = estHexa ? parseInt(entite.slice(2), 16) : parseInt(entite.slice(1), 10);
      return Number.isNaN(code) ? correspondance : String.fromCodePoint(code);
    }
    return ENTITES_NOMMEES[entite] ?? correspondance;
  }) as T;
}
