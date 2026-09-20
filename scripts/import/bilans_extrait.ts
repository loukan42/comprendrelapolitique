/**
 * Teste un extrait contre le texte d'un programme et dit où la correspondance
 * s'arrête.
 *
 * Usage : node scripts/import/bilans_extrait.ts <mandat> "<extrait>" ["<extrait>" ...]
 *
 * Utile quand `bilans_controle.ts` répond « extrait introuvable » : les PDF à
 * deux colonnes entrelacent les lignes voisines, si bien qu'une phrase qui
 * enjambe deux lignes n'est pas contiguë dans l'extraction. L'outil affiche le
 * dernier mot retrouvé, le passage voisin du document, et propose l'extrait
 * contigu le plus long.
 */

import { citationPresente, normaliser, texteDuDocument } from "./citations.ts";

const PROGRAMMES: Record<string, string> = {
  "hollande-2012-2017":
    "https://lesjours.fr/ressources/document/propositions-hollande/Soixante-engagements-Franc%CC%A7ois-Hollande-V2.pdf",
  "sarkozy-2007-2012":
    "https://www.latribune.fr/archives/2007/ID17D401AB925D71A2C12572AC004970F7/texte-integral-du-projet-de-nicolas-sarkozy-candidat-a-lelection-presidentielle---1ere-partie.html",
  "macron-2017-2022": "https://storage.googleapis.com/en-marche-fr/COMMUNICATION/Programme-Emmanuel-Macron.pdf",
  "macron-2022-2027": "https://www.cnccep.fr/pdfs/Candidat-07-Emmanuel-Macron-Declaration.pdf",
};

const [mandat, ...extraits] = process.argv.slice(2);
const url = mandat ? PROGRAMMES[mandat] : undefined;
if (!url || extraits.length === 0) {
  console.error(`usage: bilans_extrait.ts <${Object.keys(PROGRAMMES).join("|")}> "<extrait>" ...`);
  process.exit(1);
}

const document = await texteDuDocument(url);
for (const extrait of extraits) {
  if (await citationPresente(url, extrait)) {
    console.log(`OK  ${extrait}`);
    continue;
  }
  const mots = normaliser(extrait).split(" ");
  let ok = 0;
  for (let n = 1; n <= mots.length; n++) {
    if (document.includes(mots.slice(0, n).join(" "))) ok = n;
    else break;
  }
  console.log(`KO  ${extrait}`);
  console.log(`    ${ok}/${mots.length} mots retrouvés, la correspondance casse sur « ${mots[ok] ?? ""} »`);
  const i = document.indexOf(mots.slice(0, Math.min(Math.max(ok, 1), 4)).join(" "));
  if (i >= 0) console.log(`    document : ${document.slice(i, i + 200).replace(/\n/g, "⏎")}`);
  console.log(`    plus long début contigu : « ${extrait.split(/\s+/).slice(0, ok).join(" ")} »`);
}
