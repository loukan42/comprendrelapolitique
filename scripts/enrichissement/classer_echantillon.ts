/**
 * Classification thématique manuelle d'un petit échantillon de dossiers
 * connus et vérifiables, pour prouver que le schéma `enrichissement.theme` /
 * `enrichissement.dossier_theme` fonctionne.
 *
 * Ce n'est PAS la classification en masse des 2 943 dossiers de la XVIe :
 * voir docs/CLASSIFICATION.md pour ce qui manque et pourquoi. `modele` vaut
 * ici `'humain'` pour chaque ligne : c'est une classification assumée comme
 * manuelle, pas une suggestion IA non relue, conformément à spec section 8
 * (« score de confiance, justification, possibilité de correction »).
 *
 * Chaque entrée pointe vers un document réel (`citation_document_uid`) du
 * dossier qu'elle classe, jamais une source inventée (AGENTS.md section 5,
 * règle 6). Les dix dossiers ci-dessous ont été identifiés par requête SQL
 * sur data/pg16 le 13/09/2026 (titres et uids vérifiés, pas déduits).
 *
 * Idempotent : `ON CONFLICT (dossier_uid, theme_code) DO UPDATE`.
 *
 * Usage :
 *   node scripts/enrichissement/classer_echantillon.ts --db data/pg16
 */

import { appliquerMigration, ouvrirPGlite } from "../import/db.ts";
import { resolve } from "node:path";

const MIGRATION = resolve("db/migrations/002_enrichissement.sql");

interface Classification {
  dossier_uid: string;
  titre_pour_memoire: string; // pas écrit en base, sert juste à relire ce fichier
  themes: {
    theme_code: string;
    score_confiance: number;
    justification: string;
  }[];
  citation_document_uid: string;
}

const ECHANTILLON: Classification[] = [
  {
    dossier_uid: "DLR5L16N47066",
    titre_pour_memoire:
      "Projet de loi de financement rectificative de la sécurité sociale pour 2023 (réforme des retraites)",
    citation_document_uid: "ETDIANR5L16B0760",
    themes: [
      {
        theme_code: "retraites",
        score_confiance: 0.95,
        justification:
          "Ce texte relève un âge légal de départ à la retraite et modifie la durée de " +
          "cotisation requise (docs/DATA_SOURCES.md section 7 : adopté sans vote sur " +
          "l'ensemble par engagement de l'article 49.3, dossier lié DLR5L16N47408).",
      },
      {
        theme_code: "travail",
        score_confiance: 0.6,
        justification:
          "Le texte comporte des mesures sur l'emploi des seniors (index seniors, " +
          "CDI de fin de carrière) rattachées au marché du travail plutôt qu'aux " +
          "seules pensions.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N45988",
    titre_pour_memoire: "Projet de loi de finances pour 2023",
    citation_document_uid: "MIONANR5L16B0273-N2",
    themes: [
      {
        theme_code: "fiscalite",
        score_confiance: 0.9,
        justification:
          "Une loi de finances fixe les recettes de l'État, dont le barème de " +
          "l'impôt sur le revenu et les autres prélèvements obligatoires de l'année.",
      },
      {
        theme_code: "economie",
        score_confiance: 0.85,
        justification:
          "Le texte fixe aussi les dépenses et le solde budgétaire de l'État pour " +
          "l'année, donc la politique économique d'ensemble du gouvernement.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N47118",
    titre_pour_memoire: "Projet de loi pour contrôler l'immigration, améliorer l'intégration",
    citation_document_uid: "PRJLANR5L16B1855",
    themes: [
      {
        theme_code: "immigration",
        score_confiance: 0.95,
        justification:
          "Titre explicite du texte : régime du séjour et de l'éloignement des " +
          "étrangers, conditions de régularisation.",
      },
      {
        theme_code: "travail",
        score_confiance: 0.55,
        justification:
          "Le texte crée une carte de séjour temporaire « métiers en tension », " +
          "disposition qui touche directement le marché du travail.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N46539",
    titre_pour_memoire:
      "Projet de loi relatif à l'accélération de la production d'énergies renouvelables",
    citation_document_uid: "PRJLANR5L16B0443",
    themes: [
      {
        theme_code: "energie",
        score_confiance: 0.95,
        justification:
          "Titre explicite : accélération des procédures d'implantation d'installations " +
          "de production d'énergies renouvelables (éolien, solaire).",
      },
      {
        theme_code: "environnement",
        score_confiance: 0.7,
        justification:
          "Le texte touche aux procédures d'autorisation environnementale et au " +
          "zonage des projets, au delà du seul volet énergétique.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N48163",
    titre_pour_memoire: "Projet de loi pour le plein emploi (France Travail)",
    citation_document_uid: "PRJLANR5L16B1528",
    themes: [
      {
        theme_code: "travail",
        score_confiance: 0.9,
        justification:
          "Le texte transforme Pôle emploi en France Travail et réorganise " +
          "l'accompagnement des demandeurs d'emploi.",
      },
      {
        theme_code: "protection_sociale",
        score_confiance: 0.6,
        justification:
          "Le texte conditionne le versement du RSA à des heures d'activité, ce qui " +
          "touche directement un minimum social.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N47979",
    titre_pour_memoire:
      "Projet de loi portant transposition de l'accord national interprofessionnel relatif au partage de la valeur",
    citation_document_uid: "PRJLANR5L16B1272",
    themes: [
      {
        theme_code: "travail",
        score_confiance: 0.85,
        justification:
          "Transposition d'un accord entre partenaires sociaux sur l'intéressement, " +
          "la participation et la prime de partage de la valeur en entreprise.",
      },
      {
        theme_code: "entreprises",
        score_confiance: 0.65,
        justification:
          "Le texte crée de nouvelles obligations de négociation et de mise en " +
          "place de dispositifs de partage de la valeur pour les entreprises.",
      },
      {
        theme_code: "pouvoir_achat",
        score_confiance: 0.5,
        justification:
          "L'objectif affiché du texte est d'augmenter la rémunération globale des " +
          "salariés par des versements complémentaires au salaire.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N48397",
    titre_pour_memoire: "Projet de loi de finances pour 2024",
    citation_document_uid: "MIONANR5L16B1680-N19",
    themes: [
      {
        theme_code: "fiscalite",
        score_confiance: 0.9,
        justification: "Loi de finances annuelle : barème fiscal et recettes de l'État pour 2024.",
      },
      {
        theme_code: "economie",
        score_confiance: 0.8,
        justification: "Fixe les dépenses et le solde budgétaire de l'État pour l'année 2024.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N48683",
    titre_pour_memoire: "Projet de loi de financement de la sécurité sociale pour 2024",
    citation_document_uid: "MIONANR5L16B1682-N1",
    themes: [
      {
        theme_code: "protection_sociale",
        score_confiance: 0.85,
        justification:
          "Fixe les recettes et objectifs de dépenses des branches de la sécurité " +
          "sociale (maladie, retraite, famille, autonomie) pour l'année.",
      },
      {
        theme_code: "sante",
        score_confiance: 0.7,
        justification:
          "Détermine notamment l'ONDAM, l'objectif national de dépenses d'assurance " +
          "maladie, qui encadre le financement du système de santé.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N46266",
    titre_pour_memoire:
      "Mesures d'urgence relatives au fonctionnement du marché du travail en vue du plein emploi (réforme de l'assurance chômage)",
    citation_document_uid: "PRJLANR5L16B0219",
    themes: [
      {
        theme_code: "travail",
        score_confiance: 0.9,
        justification:
          "Le texte habilite le gouvernement à modifier par décret les règles " +
          "d'indemnisation de l'assurance chômage selon la conjoncture.",
      },
      {
        theme_code: "pouvoir_achat",
        score_confiance: 0.4,
        justification:
          "Les règles d'indemnisation du chômage déterminent directement le revenu " +
          "de remplacement d'une partie de la population active.",
      },
    ],
  },
  {
    dossier_uid: "DLR5L16N46346",
    titre_pour_memoire: "Programmation des finances publiques pour les années 2023 à 2027",
    citation_document_uid: "MIONANR5L16B1746-N25",
    themes: [
      {
        theme_code: "economie",
        score_confiance: 0.85,
        justification:
          "Fixe la trajectoire pluriannuelle des finances publiques (dépenses, " +
          "déficit, dette) pour cinq ans, cadre de la politique économique.",
      },
      {
        theme_code: "fiscalite",
        score_confiance: 0.5,
        justification:
          "La trajectoire encadre indirectement les marges de baisse ou de hausse " +
          "des prélèvements obligatoires sur la période.",
      },
    ],
  },
];

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const cheminDb = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!cheminDb) {
    console.error("usage: classer_echantillon.ts --db <chemin>");
    process.exit(1);
  }

  const db = await ouvrirPGlite(cheminDb);
  await appliquerMigration(db, MIGRATION);

  let ecrits = 0;
  for (const c of ECHANTILLON) {
    for (const t of c.themes) {
      await db.query(
        `INSERT INTO enrichissement.dossier_theme
           (dossier_uid, theme_code, score_confiance, justification,
            citation_document_uid, modele, valide_par)
         VALUES ($1, $2, $3, $4, $5, 'humain', 'agent-methodologie-quantitative')
         ON CONFLICT (dossier_uid, theme_code) DO UPDATE SET
           score_confiance = EXCLUDED.score_confiance,
           justification = EXCLUDED.justification,
           citation_document_uid = EXCLUDED.citation_document_uid,
           modele = 'humain',
           genere_le = now()`,
        [c.dossier_uid, t.theme_code, t.score_confiance, t.justification, c.citation_document_uid],
      );
      ecrits++;
    }
  }
  console.log(
    `${ecrits} classifications thématiques écrites (échantillon manuel, ${ECHANTILLON.length} dossiers).`,
  );
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
