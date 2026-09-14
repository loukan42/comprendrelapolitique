/**
 * Positions tirées des programmes, pour le comparateur et le QCM.
 *
 * Usage :
 *   node scripts/import/positions_programme.ts --db data/pg16 --verifier
 *   node scripts/import/positions_programme.ts --db data/pg16
 *
 * Les deux usages lisent la même table : un comparateur montre deux
 * formations côte à côte sur un thème, un QCM montre plusieurs formations sur
 * un thème en masquant leur origine. Le corpus doit être identique, sinon les
 * deux écrans finissent par ne plus dire la même chose.
 *
 * LA GARANTIE DE CE FICHIER.
 *
 * Chaque position est une citation, et le script la vérifie : il télécharge
 * le document source et cherche la phrase dedans. Une citation introuvable
 * n'est pas écrite en base, et le script le dit. Ce contrôle existe parce que
 * l'erreur redoutée n'est pas une faute de frappe mais une reformulation qui
 * se glisserait à la place d'une citation : elle ferait dire à un parti ce
 * qu'il n'a pas écrit, et rien dans l'affichage ne permettrait de s'en
 * apercevoir.
 *
 * La comparaison est insensible à la casse, aux accents et aux espaces
 * multiples : les programmes en ligne appliquent souvent des majuscules par
 * CSS, et le texte extrait d'une page ne reproduit pas fidèlement ses espaces.
 * Elle reste sensible aux mots, qui sont ce qui compte.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface PositionSource {
  id: string;
  programmeId: string;
  theme: string;
  sousTheme?: string;
  /** Citation exacte, vérifiée contre le document source. */
  extrait: string;
  /** Formulation courte pour le QCM. La citation reste affichée à côté. */
  resumeAffichage?: string;
  pageOuSection?: string;
}

const POSITIONS: PositionSource[] = [
  {
    id: "pcf-retraites",
    programmeId: "pcf-programme",
    theme: "retraites",
    extrait: "la retraite à 60 ans à taux plein",
    resumeAffichage: "Retraite à 60 ans à taux plein",
    pageOuSection: "180 propositions, page programme",
  },
  {
    id: "pcf-smic",
    programmeId: "pcf-programme",
    theme: "travail",
    sousTheme: "salaires",
    extrait: "augmentation du smic à 1600€ net par mois",
    resumeAffichage: "SMIC porté à 1 600 € net par mois",
    pageOuSection: "180 propositions, page programme",
  },
  {
    id: "lr-seniors",
    programmeId: "lr-propositions",
    theme: "retraites",
    extrait: "Libérer le travail des seniors qui ont tous leurs trimestres",
    resumeAffichage: "Libérer le travail des seniors ayant tous leurs trimestres",
    pageOuSection: "Nos propositions",
  },
  {
    id: "lr-code-travail",
    programmeId: "lr-propositions",
    theme: "travail",
    extrait: "Refonder le code du travail sur 50 principes",
    resumeAffichage: "Code du travail réduit à 50 principes, le reste à la négociation collective",
    pageOuSection: "Nos propositions",
  },
  {
    id: "pcf-isf",
    programmeId: "pcf-programme",
    theme: "impots",
    extrait: "rétablissement et triplement de l'isf",
    resumeAffichage: "Rétablir l'ISF et en tripler le rendement",
    pageOuSection: "180 propositions, page programme",
  },
  {
    id: "pcf-energie",
    programmeId: "pcf-programme",
    theme: "energie",
    extrait: "un mix énergétique nucléaire et renouvelable",
    resumeAffichage: "Un mix énergétique associant nucléaire et renouvelables",
    pageOuSection: "180 propositions, page programme",
  },
  {
    id: "pcf-etudiants",
    programmeId: "pcf-programme",
    theme: "education",
    extrait: "850 € par mois pour tous les étudiants",
    resumeAffichage: "Allocation de 850 € par mois pour tous les étudiants",
    pageOuSection: "180 propositions, page programme",
  },
  {
    id: "lr-prelevements",
    programmeId: "lr-propositions",
    theme: "impots",
    extrait: "Réduire franchement les prélèvements obligatoires",
    resumeAffichage: "Réduire franchement les prélèvements obligatoires",
    pageOuSection: "Nos propositions",
  },
  {
    id: "lr-eolien",
    programmeId: "lr-propositions",
    theme: "energie",
    extrait: "Stopper le subventionnement de nouvelles capacités éoliennes",
    resumeAffichage: "Arrêter de subventionner de nouvelles capacités éoliennes",
    pageOuSection: "Nos propositions",
  },
  {
    id: "lr-chomage",
    programmeId: "lr-propositions",
    theme: "travail",
    sousTheme: "chômage",
    extrait: "Réformer l'assurance chômage pour accélérer le retour à l'emploi",
    resumeAffichage: "Réforme de l'assurance chômage pour accélérer le retour à l'emploi",
    pageOuSection: "Nos propositions",
  },
];

const MIGRATION = resolve("db/migrations/006_programmes.sql");

/** Réduit un texte à ce qui compte pour la comparaison : les mots. */
function normaliser(texte: string): string {
  return (
    texte
      .normalize("NFD")
      // Marques diacritiques laissees par la decomposition NFD.
      .replace(/[\u0300-\u036f]/g, "")
      // Apostrophes et guillemets typographiques.
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      // Espaces insecables, fines ou non, frequentes dans les pages des partis.
      .replace(/[\u00a0\u202f\u2009]/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9\x27\u20ac%]+/g, " ")
      .trim()
  );
}

const cacheDocuments = new Map<string, string>();

async function texteDuDocument(url: string): Promise<string> {
  const enCache = cacheDocuments.get(url);
  if (enCache !== undefined) return enCache;
  const r = await fetch(url, {
    headers: { "user-agent": "comprendrelapolitique/0.1 (verification de citation)" },
    signal: AbortSignal.timeout(30000),
  });
  const brut = await r.text();
  const texte = normaliser(
    brut
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  cacheDocuments.set(url, texte);
  return texte;
}

async function controler(
  db: Db,
): Promise<{ p: PositionSource; url: string | null; trouvee: boolean }[]> {
  const resultats: { p: PositionSource; url: string | null; trouvee: boolean }[] = [];
  for (const p of POSITIONS) {
    const [prog] = await db.query<{ url: string | null; formation: string }>(
      `SELECT url, formation FROM enrichissement.programme WHERE id = $1`,
      [p.programmeId],
    );
    if (!prog?.url) {
      resultats.push({ p, url: null, trouvee: false });
      continue;
    }
    let trouvee = false;
    try {
      const doc = await texteDuDocument(prog.url);
      trouvee = doc.includes(normaliser(p.extrait));
    } catch {
      trouvee = false;
    }
    resultats.push({ p, url: prog.url, trouvee });
  }
  return resultats;
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: positions_programme.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement'
                       AND table_name = 'programme_position') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 006 appliquée");
  }

  const resultats = await controler(db);

  if (args.includes("--verifier")) {
    for (const r of resultats) {
      const etat = r.trouvee ? "CITATION TROUVEE  " : "INTROUVABLE       ";
      console.log(`${etat} ${r.p.id.padEnd(18)} ${r.p.theme.padEnd(12)} « ${r.p.extrait} »`);
      if (!r.trouvee) console.log(`                   source : ${r.url ?? "aucune URL"}`);
    }
    const ok = resultats.filter((r) => r.trouvee).length;
    console.log(`\n${ok} citations vérifiées sur ${resultats.length}`);
    await db.close();
    return;
  }

  await db.query(`DELETE FROM enrichissement.programme_position`);
  let ecrites = 0;
  for (const r of resultats) {
    if (!r.trouvee) {
      console.error(`Citation introuvable dans la source, position ignorée : ${r.p.id}`);
      continue;
    }
    await db.query(
      `INSERT INTO enrichissement.programme_position
         (id, programme_id, theme, sous_theme, extrait, resume_affichage, page_ou_section, url_ancre)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        r.p.id,
        r.p.programmeId,
        r.p.theme,
        r.p.sousTheme ?? null,
        r.p.extrait,
        r.p.resumeAffichage ?? null,
        r.p.pageOuSection ?? null,
        r.url,
      ],
    );
    ecrites += 1;
  }
  console.log(`${ecrites} positions écrites sur ${resultats.length}`);
  await db.close();
}

await main();
