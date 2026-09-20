/**
 * Contrôle d'un lot de fiches d'engagements avant leur intégration à bilans.ts.
 *
 * Usage : node scripts/import/bilans_controle.ts lot.json
 *
 * N'écrit rien. Pour chaque fiche : champs obligatoires, extrait retrouvé mot
 * pour mot dans le programme (même code que le chargement), état de chaque
 * lien. Un code 403 sur Légifrance n'est pas une absence, comme dans
 * `bilans.ts`.
 */

import { readFileSync } from "node:fs";

import { citationPresente } from "./citations.ts";

const PROGRAMMES: Record<string, string> = {
  "hollande-2012-2017":
    "https://lesjours.fr/ressources/document/propositions-hollande/Soixante-engagements-Franc%CC%A7ois-Hollande-V2.pdf",
  "sarkozy-2007-2012":
    "https://www.latribune.fr/archives/2007/ID17D401AB925D71A2C12572AC004970F7/texte-integral-du-projet-de-nicolas-sarkozy-candidat-a-lelection-presidentielle---1ere-partie.html",
  "macron-2017-2022": "https://storage.googleapis.com/en-marche-fr/COMMUNICATION/Programme-Emmanuel-Macron.pdf",
  "macron-2022-2027": "https://www.cnccep.fr/pdfs/Candidat-07-Emmanuel-Macron-Declaration.pdf",
};

const STATUTS = ["realise", "partiellement", "en_cours", "non_realise", "abandonne", "inevaluable"];
const CONFIANCES = ["haute", "moyenne", "basse"];
const DOMAINES_PROTEGES = ["legifrance.gouv.fr", "urssaf.fr", "economie.gouv.fr"];

interface Fiche {
  id?: string;
  mandatId?: string;
  theme?: string;
  titre?: string;
  extraitProgramme?: string;
  reformulation?: string;
  statut?: string;
  confiance?: string;
  justification?: string;
  verifieLe?: string;
  sources?: { titre?: string; organisme?: string; url?: string }[];
  actions?: { date?: string; description?: string; url?: string }[];
}

async function code(url: string): Promise<number | string> {
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

function etat(c: number | string, url: string): "ok" | "bloque" | "mort" {
  if (c === 200) return "ok";
  if (c === 403 || c === 401 || c === 429) return "bloque";
  if (DOMAINES_PROTEGES.some((d) => url.includes(d))) return "bloque";
  return "mort";
}

const chemin = process.argv[2];
if (!chemin) {
  console.error("usage: bilans_controle.ts lot.json");
  process.exit(1);
}
const fiches = JSON.parse(readFileSync(chemin, "utf8")) as Fiche[];
let problemes = 0;
const ids = new Set<string>();

for (const f of fiches) {
  const msgs: string[] = [];
  for (const champ of [
    "id",
    "mandatId",
    "theme",
    "titre",
    "extraitProgramme",
    "reformulation",
    "statut",
    "confiance",
    "justification",
    "verifieLe",
  ] as const) {
    if (!f[champ]) msgs.push(`champ manquant : ${champ}`);
  }
  if (f.id && ids.has(f.id)) msgs.push("identifiant en double");
  if (f.id) ids.add(f.id);
  if (f.statut && !STATUTS.includes(f.statut)) msgs.push(`statut inconnu : ${f.statut}`);
  if (f.confiance && !CONFIANCES.includes(f.confiance)) msgs.push(`confiance inconnue : ${f.confiance}`);
  if (f.statut && f.statut !== "inevaluable" && (f.sources?.length ?? 0) === 0) {
    msgs.push("aucune source alors que le statut n'est pas inevaluable");
  }
  if (/[–—]/.test(JSON.stringify(f))) msgs.push("tiret cadratin ou demi-cadratin");

  const programme = f.mandatId ? PROGRAMMES[f.mandatId] : undefined;
  if (!programme) msgs.push(`mandat inconnu : ${f.mandatId}`);
  else if (f.extraitProgramme && !(await citationPresente(programme, f.extraitProgramme))) {
    msgs.push("EXTRAIT INTROUVABLE dans le programme");
  }

  const urls = [...(f.sources ?? []).map((s) => s.url), ...(f.actions ?? []).map((a) => a.url)];
  for (const u of urls) {
    if (!u) continue;
    const c = await code(u);
    const e = etat(c, u);
    if (e === "mort") msgs.push(`LIEN MORT (${c}) : ${u}`);
  }

  if (msgs.length > 0) {
    problemes += 1;
    console.log(`KO  ${f.id ?? "(sans id)"}`);
    for (const m of msgs) console.log(`      ${m}`);
  } else {
    console.log(`OK  ${f.id}`);
  }
}
console.log(`\n${fiches.length} fiche(s), ${problemes} avec problème(s).`);
process.exit(problemes > 0 ? 1 : 0);
