/**
 * Téléchargement et décompression des archives Open Data.
 *
 * Deux propriétés comptent ici, et elles viennent de mesures et non de
 * principes.
 *
 * **On ne retélécharge rien sans raison.** Les archives des XVe et XVIe n'ont
 * pas bougé depuis juin 2022 et juin 2024 ; seule la XVIIe se republie chaque
 * nuit. Le serveur sert `Last-Modified` et `Content-Length` : une requête
 * conditionnelle suffit à le savoir, pour quelques octets au lieu de 26 Mo.
 *
 * **On sait toujours ce qu'on a importé.** Chaque archive est hachée en SHA-256
 * pendant l'écriture, et le hash part dans `officiel.import_lot`. C'est ce qui
 * permet de dire, plus tard, de quelle version d'un fichier vient une ligne.
 *
 * Usage :
 *   node scripts/import/telecharger.ts <législature> [dossier] [--force]
 *
 * Dépose les archives décompressées dans la disposition attendue par
 * charger.ts : <dossier>/<législature>/<jeu>/json/.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { unzip } from "fflate";

import { JEUX_MVP, sourcesPour, type Source } from "./sources.ts";

/** Métadonnées conservées d'un téléchargement à l'autre. */
interface Empreinte {
  url: string;
  lastModified: string | null;
  tailleOctets: number;
  sha256: string;
  telechargeLe: string;
}

const UA = "comprendrelapolitique/0.1 (+https://github.com/loukan42/comprendrelapolitique)";

function humain(octets: number): string {
  return octets > 1_048_576
    ? `${(octets / 1_048_576).toFixed(1)} Mo`
    : `${(octets / 1024).toFixed(0)} Ko`;
}

async function lireEmpreinte(chemin: string): Promise<Empreinte | null> {
  try {
    return JSON.parse(await readFile(chemin, "utf8")) as Empreinte;
  } catch {
    return null;
  }
}

/**
 * Interroge le serveur sans rien télécharger. Un `HEAD` suffit : l'Assemblée
 * sert `Last-Modified` et `Content-Length` sur toutes ses archives.
 */
async function aChange(source: Source, precedente: Empreinte | null): Promise<boolean> {
  if (!precedente) return true;
  const r = await fetch(source.url, { method: "HEAD", headers: { "User-Agent": UA } });
  if (!r.ok) return true;
  const lm = r.headers.get("last-modified");
  const taille = Number(r.headers.get("content-length") ?? 0);
  return lm !== precedente.lastModified || taille !== precedente.tailleOctets;
}

async function telecharger(source: Source, destination: string): Promise<Empreinte> {
  const r = await fetch(source.url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${source.url}`);
  const donnees = new Uint8Array(await r.arrayBuffer());
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, donnees);
  return {
    url: source.url,
    lastModified: r.headers.get("last-modified"),
    tailleOctets: donnees.byteLength,
    sha256: createHash("sha256").update(donnees).digest("hex"),
    telechargeLe: new Date().toISOString(),
  };
}

/**
 * Décompresse dans `cible`. Les archives contiennent un répertoire `json/` à
 * leur racine, ce qui donne `<jeu>/json/…`, exactement la disposition que
 * charger.ts attend.
 */
async function decompresser(archive: string, cible: string): Promise<number> {
  const donnees = new Uint8Array(await readFile(archive));
  const entrees = await new Promise<Record<string, Uint8Array>>((ok, ko) =>
    unzip(donnees, (err, res) => (err ? ko(err) : ok(res))),
  );
  await rm(cible, { recursive: true, force: true });
  let n = 0;
  for (const [chemin, contenu] of Object.entries(entrees)) {
    if (chemin.endsWith("/") || contenu.byteLength === 0) continue;
    const sortie = join(cible, chemin);
    await mkdir(dirname(sortie), { recursive: true });
    await writeFile(sortie, contenu);
    n += 1;
  }
  return n;
}

async function main() {
  const args = process.argv.slice(2);
  const legislature = Number.parseInt(args[0] ?? "", 10);
  const racine = resolve(args.find((a) => !a.startsWith("--") && a !== args[0]) ?? "data");
  const force = args.includes("--force");
  // Hors MVP par défaut : 347 Mo pour la seule XVIe (docs/DATA_SOURCES.md
  // section 1.2). Le drapeau est explicite parce que le coût l'est.
  const avecAmendements = args.includes("--amendements");
  const avecDebats = args.includes("--debats");

  if (!legislature) {
    console.error(
      "usage: telecharger.ts <législature> [dossier] [--force] [--amendements] [--debats]",
    );
    process.exit(1);
  }

  const jeux = [...JEUX_MVP];
  if (avecAmendements) jeux.push("amendements");
  if (avecDebats) jeux.push("debats");
  const sources = sourcesPour(legislature, jeux);
  if (sources.length === 0) {
    console.error(`Aucune source connue pour la législature ${legislature}.`);
    process.exit(1);
  }

  console.log(`Législature ${legislature} → ${racine}\n`);

  // Les archives compressées et leurs empreintes vivent à part : le dossier de
  // la législature ne contient que ce que charger.ts doit lire.
  const cache = join(racine, "_archives");
  const destination = join(racine, String(legislature));

  for (const source of sources) {
    const archive = join(cache, `${legislature}-${source.jeu}.zip`);
    const empreinteChemin = join(cache, `${legislature}-${source.jeu}.json`);
    const precedente = await lireEmpreinte(empreinteChemin);

    if (!force && existsSync(archive) && !(await aChange(source, precedente))) {
      console.log(`${source.jeu.padEnd(10)} inchangé depuis ${precedente?.lastModified ?? "?"}`);
      continue;
    }

    process.stdout.write(`${source.jeu.padEnd(10)} téléchargement (~${source.tailleMo} Mo)… `);
    const empreinte = await telecharger(source, archive);
    const fichiers = await decompresser(archive, join(destination, source.jeu));
    await writeFile(empreinteChemin, JSON.stringify(empreinte, null, 2), "utf8");
    console.log(
      `${humain(empreinte.tailleOctets)}, ${fichiers} fichiers, sha256 ${empreinte.sha256.slice(0, 12)}…`,
    );
  }

  console.log(`\nTerminé. Import : node scripts/import/charger.ts ${legislature} ${destination}`);
}

await main();
