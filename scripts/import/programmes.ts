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
 * La `nature` est le champ qui évite le contresens : à ce jour, la plupart
 * des partis n'ont pas de programme présidentiel 2027, et ce qu'ils publient
 * est un programme de 2024 ou un projet en cours. L'écrire est le minimum.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

type Nature =
  "presidentiel_2027" | "legislatif_2024" | "europeen_2024" | "projet_en_cours" | "aucun";

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
    nature: "projet_en_cours",
    datePublication: "2025-01-01",
    url: "https://programme.lafranceinsoumise.fr/",
    note: "Quatrième version du programme, publiée en janvier 2025. Le PDF complet et les livrets thématiques sont accessibles depuis cette page.",
  },
  {
    id: "lfi-avenir-en-commun-pdf",
    formation: "La France insoumise",
    candidat: "Jean-Luc Mélenchon",
    titre: "L'Avenir en commun, texte intégral (PDF)",
    nature: "projet_en_cours",
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
    note: "Programme de législatives, pas de présidentielle. Le parti n'a pas publié de programme présidentiel 2027 à ce jour.",
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
    nature: "projet_en_cours",
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

  // Formations et personnalités suivies, sans programme publié à ce jour.
  // L'absence est affichée : elle informe le lecteur autant qu'un lien, et
  // évite qu'il conclue à un oubli du site.
  {
    id: "horizons-aucun",
    formation: "Horizons",
    candidat: "Édouard Philippe",
    nature: "aucun",
    note: "Des propositions ont été rendues publiques par voie de presse, notamment une règle d'or budgétaire, mais aucun document de programme n'est publié par le parti à ce jour.",
  },
  {
    id: "ecologistes-aucun",
    formation: "Les Écologistes",
    candidat: "Marine Tondelier",
    nature: "aucun",
    note: "Site du parti inaccessible à la vérification automatique ; aucune référence retenue tant qu'une URL n'a pas été contrôlée.",
  },
  {
    id: "place-publique-aucun",
    formation: "Place publique",
    candidat: "Raphaël Glucksmann",
    nature: "aucun",
    note: "Participe à la primaire organisée avec le Parti socialiste. Aucun programme présidentiel publié à ce jour.",
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

  const db: Db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'programme') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 006 appliquée");
  }

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
