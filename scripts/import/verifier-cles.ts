/**
 * Vérifie que la normalisation TypeScript produit exactement les mêmes clés de
 * rapprochement que l'implémentation Python de référence.
 *
 * Pourquoi ce script existe : la méthode de rattachement scrutin / dossier a
 * été mesurée avec la version Python (précision 100 %, couverture 95,5 %, voir
 * docs/DATA_SOURCES.md section 4). Si le port TypeScript diverge ne serait-ce
 * que d'un espace, cette mesure ne vaut plus pour le code de production.
 *
 * Usage :
 *   node scripts/import/verifier-cles.ts <dir_scrutins> <dir_documents> <sortie.json>
 *
 * Écrit les clés calculées côté TypeScript, que le script Python de
 * comparaison relit. Ne compare rien lui-même : il produit la moitié TS du
 * couple.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cleTitreDocument, cleTitreScrutin, estVoteSurEnsemble, texte } from "./normaliser.ts";

async function lireJson(chemin: string): Promise<Record<string, unknown>> {
  // Le JSON de l'Assemblée est en ASCII avec échappements \uXXXX.
  return JSON.parse(await readFile(chemin, "utf8"));
}

async function main() {
  const [dirScrutins, dirDocuments, sortie] = process.argv.slice(2);
  if (!dirScrutins || !dirDocuments || !sortie) {
    console.error("usage: verifier-cles.ts <dir_scrutins> <dir_documents> <sortie.json>");
    process.exit(1);
  }

  const scrutins: Record<string, string> = {};
  for (const f of await readdir(dirScrutins)) {
    if (!f.endsWith(".json")) continue;
    const s = (await lireJson(join(dirScrutins, f))).scrutin as Record<string, unknown>;
    const libelle = texte((s.objet as Record<string, unknown>).libelle);
    if (!libelle || !estVoteSurEnsemble(libelle)) continue;
    scrutins[texte(s.uid)!] = cleTitreScrutin(libelle);
  }

  const documents: Record<string, string> = {};
  for (const f of await readdir(dirDocuments)) {
    if (!f.endsWith(".json")) continue;
    const d = (await lireJson(join(dirDocuments, f))).document as Record<string, unknown>;
    const titre = texte((d.titres as Record<string, unknown>)?.titrePrincipal);
    if (!titre) continue;
    documents[texte(d.uid)!] = cleTitreDocument(titre);
  }

  await writeFile(sortie, JSON.stringify({ scrutins, documents }, null, 0), "utf8");
  console.log(
    `TypeScript : ${Object.keys(scrutins).length} scrutins sur l'ensemble, ` +
      `${Object.keys(documents).length} documents -> ${sortie}`,
  );
}

await main();
