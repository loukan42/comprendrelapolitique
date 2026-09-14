/**
 * Bilan des engagements présidentiels : présidents, mandats, engagements.
 *
 * Usage :
 *   node scripts/import/bilans.ts --db data/pg16 --verifier
 *   node scripts/import/bilans.ts --db data/pg16
 *
 * `--verifier` n'écrit rien : il interroge chaque URL de programme et de
 * source et affiche son code de réponse. Un mandat dont le programme n'est
 * pas atteignable n'est pas écrit, et un engagement dont une source est morte
 * non plus.
 *
 * ÉTAT DU CORPUS.
 *
 * Aucun engagement n'est renseigné à ce jour, et c'est délibéré. Remplir
 * cette table demande, pour chaque promesse, l'extrait exact du programme,
 * les textes de loi ou données publiques correspondants, et la comparaison du
 * résultat observable à ce qui avait été annoncé. Rien de tout cela ne se
 * déduit : une fiche inventée, ou déduite de ce qu'une mesure au nom voisin
 * existe, serait pire que pas de fiche. La structure et l'interface sont
 * prêtes, la recherche documentaire reste à faire.
 *
 * SUR LES SOURCES DE PROGRAMME.
 *
 * Les sites de campagne ne survivent pas aux campagnes : en-marche.fr répond
 * 404 aujourd'hui. Les documents officiels déposés auprès de la commission de
 * contrôle de la campagne électorale, eux, restent en ligne, et c'est la
 * source retenue quand elle existe.
 *
 * Les pages d'archive de vie-publique.fr répondent bien, mais leur contenu
 * n'est pas récupérable automatiquement : un code 200 ne prouve pas qu'une
 * page contient le document annoncé. Elles ne sont donc pas enregistrées
 * comme source tant qu'une vérification humaine ne les a pas confirmées.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface MandatSource {
  id: string;
  libelle: string;
  dateDebut: string;
  /** Absent tant que le mandat court. */
  dateFin?: string;
  programmeTitre: string;
  programmeUrl: string;
  programmeDate?: string;
}

interface PresidentSource {
  id: string;
  prenom: string;
  nom: string;
  mandats: MandatSource[];
}

const PRESIDENTS: PresidentSource[] = [
  {
    id: "emmanuel-macron",
    prenom: "Emmanuel",
    nom: "Macron",
    mandats: [
      {
        id: "macron-2022-2027",
        libelle: "2022-2027",
        dateDebut: "2022-05-13",
        programmeTitre:
          "Déclaration de candidature déposée auprès de la commission de contrôle de la campagne électorale, élection présidentielle de 2022",
        programmeUrl: "https://www.cnccep.fr/pdfs/Candidat-07-Emmanuel-Macron-Declaration.pdf",
        programmeDate: "2022-04-01",
      },
      {
        id: "macron-2017-2022",
        libelle: "2017-2022",
        dateDebut: "2017-05-14",
        dateFin: "2022-05-13",
        programmeTitre: "Programme d'Emmanuel Macron, élection présidentielle de 2017",
        // Le site de campagne en-marche.fr répond 404 depuis, mais le PDF du
        // programme reste servi par le stockage de la campagne. Les
        // professions de foi 2017 déposées auprès de la commission de
        // contrôle ne sont, elles, pas archivées : l'index de la Wayback
        // Machine ne contient pour cnccep.fr en 2017 que des communiqués.
        programmeUrl:
          "https://storage.googleapis.com/en-marche-fr/COMMUNICATION/Programme-Emmanuel-Macron.pdf",
        programmeDate: "2017-03-02",
      },
    ],
  },
];

const MIGRATION = resolve("db/migrations/007_bilans.sql");

async function tester(url: string): Promise<number | string> {
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

async function verifier(): Promise<void> {
  for (const p of PRESIDENTS) {
    console.log(`\n## ${p.prenom} ${p.nom}`);
    if (p.mandats.length === 0) {
      console.log("   aucun mandat renseigné");
      continue;
    }
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      console.log(`   ${code === 200 ? "OK " : "!! "}${String(code).padEnd(6)} ${m.libelle}`);
      console.log(`          ${m.programmeTitre}`);
      console.log(`          ${m.programmeUrl}`);
    }
  }
  console.log("\nAucun engagement n'est renseigné : voir l'en-tête de ce fichier.");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--verifier")) {
    await verifier();
    return;
  }

  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: bilans.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db: Db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'president') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 007 appliquée");
  }

  await db.query(`DELETE FROM enrichissement.mandat_presidentiel`);
  await db.query(`DELETE FROM enrichissement.president`);

  let mandats = 0;
  let ignores = 0;
  for (const p of PRESIDENTS) {
    await db.query(`INSERT INTO enrichissement.president (id, nom, prenom) VALUES ($1, $2, $3)`, [
      p.id,
      p.nom,
      p.prenom,
    ]);
    for (const m of p.mandats) {
      const code = await tester(m.programmeUrl);
      if (code !== 200) {
        console.error(`Programme inatteignable (${code}), mandat ignoré : ${m.id}`);
        ignores += 1;
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.mandat_presidentiel
           (id, president_id, libelle, date_debut, date_fin, programme_titre,
            programme_url, programme_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          m.id,
          p.id,
          m.libelle,
          m.dateDebut,
          m.dateFin ?? null,
          m.programmeTitre,
          m.programmeUrl,
          m.programmeDate ?? null,
        ],
      );
      mandats += 1;
    }
  }

  console.log(
    `${PRESIDENTS.length} président(s), ${mandats} mandat(s)` +
      (ignores > 0 ? `, ${ignores} ignoré(s)` : "") +
      ", 0 engagement (corpus à constituer)",
  );
  await db.close();
}

await main();
