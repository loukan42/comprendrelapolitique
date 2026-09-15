/**
 * Calcule le score institutionnel et l'intensité parlementaire (partielle)
 * de chaque dossier et peuple `enrichissement.score_importance`.
 *
 * Formules : docs/SCORING.md section 2 (institutionnel, 35 %) et section 4
 * (intensité parlementaire, 20 %). Les sous-scores médiatique et portée ne
 * sont pas calculés ici : ils restent NULL, comme l'exige docs/SCORING.md
 * section 3 et section 5 tant que leurs sources ne sont pas branchées.
 *
 * Idempotent : `INSERT ... ON CONFLICT (dossier_uid) DO UPDATE`. Rejouable
 * autant de fois que voulu, y compris après une mise à jour de la formule
 * (voir `VERSION_FORMULE` ci-dessous, qui doit changer si le barème change).
 *
 * Usage :
 *   node scripts/enrichissement/calculer_scores.ts --db data/pg16
 *   node scripts/enrichissement/calculer_scores.ts --db data/pg16 --dossier DLR5L16N47066
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirBase, type Db } from "../import/db.ts";

const MIGRATION = resolve("db/migrations/002_enrichissement.sql");

// À faire évoluer chaque fois que le barème de docs/SCORING.md change. Sert
// de traçabilité : un score en base porte la version de la formule qui l'a
// produit, sans avoir à rejouer le calcul pour le savoir.
const VERSION_FORMULE = "SCORING.md-2026-09-13";

// Un dossier d'engagement de responsabilité (49.3) n'est pas une loi
// autonome : il décrit un acte de procédure rattaché au texte qu'il vise
// (docs/DATA_MODEL.md section 4). Il ne reçoit pas de score d'importance
// propre.
const PROCEDURE_ENGAGEMENT = "Engagement de la responsabilité gouvernementale";

interface SignauxInstitutionnels {
  dossier_uid: string;
  vote_sur_ensemble: boolean;
  adopte_49_3: boolean;
  sps: boolean;
  loi_finances: boolean;
  promulgue: boolean;
  saisine_cc: boolean;
}

interface ActesAgreges {
  dossier_uid: string;
  nb_seances: number;
  premiere_date: string | null;
  date_prom: string | null;
  derniere_date: string | null;
}

interface ScrutinsAgreges {
  dossier_uid: string;
  nb_scrutins: number;
}

/** Barème par points, docs/SCORING.md section 2. Plafonné à 100 après somme. */
function calculerInstitutionnel(s: SignauxInstitutionnels): {
  institutionnel: number;
  detail: Record<string, unknown>;
} {
  // Un vote sur l'ensemble et une adoption par 49.3 sont mutuellement
  // exclusifs par construction du dossier (docs/SCORING.md section 2,
  // dernier paragraphe avant "Calculable dès maintenant") : un dossier ne
  // peut pas porter les deux à la fois. On ne les additionne donc jamais.
  let points = 0;
  if (s.vote_sur_ensemble || s.adopte_49_3) points += 30;
  if (s.sps) points += 20;
  if (s.loi_finances) points += 20;
  if (s.promulgue) points += 15;
  if (s.saisine_cc) points += 10;

  const institutionnel = Math.min(100, points);
  return {
    institutionnel,
    detail: {
      vote_sur_ensemble: s.vote_sur_ensemble,
      adopte_49_3: s.adopte_49_3,
      sps: s.sps,
      loi_finances_ou_financement_secu: s.loi_finances,
      promulgue: s.promulgue,
      saisine_cc: s.saisine_cc,
      points_avant_plafond: points,
    },
  };
}

/**
 * Rang percentile (0 à 100) de `valeur` dans `valeurs`, par la formule
 * usuelle (nombre de valeurs strictement inférieures, plus la moitié des
 * valeurs égales, rapporté à l'effectif). Sur un groupe d'un seul élément,
 * la formule renvoie 50 sans cas particulier à écrire : ni le haut ni le bas
 * de l'échelle, ce qui est le comportement voulu pour un dossier isolé dans
 * son année de dépôt (docs/SCORING.md section 3.3, même principe appliqué ici
 * à l'intensité parlementaire).
 */
function rangPercentile(valeur: number, valeurs: number[]): number {
  const n = valeurs.length;
  if (n === 0) return 50;
  let inferieures = 0;
  let egales = 0;
  for (const v of valeurs) {
    if (v < valeur) inferieures++;
    else if (v === valeur) egales++;
  }
  return ((inferieures + egales / 2) / n) * 100;
}

function joursEntre(a: string, b: string): number {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(diff / 86_400_000));
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const cheminDb = iDb >= 0 ? args[iDb + 1] : undefined;
  const iDossier = args.indexOf("--dossier");
  const dossierUnique = iDossier >= 0 ? args[iDossier + 1] : undefined;

  if (!cheminDb) {
    console.error("usage: calculer_scores.ts --db <chemin> [--dossier <uid>]");
    process.exit(1);
  }

  const db = await ouvrirBase(cheminDb);
  await appliquerMigration(db, MIGRATION);

  console.log("Chargement des dossiers à scorer...");
  const dossiers = await db.query<{ uid: string }>(
    `SELECT uid FROM officiel.dossier
      WHERE procedure_libelle IS DISTINCT FROM $1
        AND ($2::text IS NULL OR uid = $2)
      ORDER BY uid`,
    [PROCEDURE_ENGAGEMENT, dossierUnique ?? null],
  );
  console.log(`  ${dossiers.length} dossiers (hors dossiers d'engagement du 49.3).`);

  console.log("Calcul des signaux institutionnels...");
  const signaux = await db.query<SignauxInstitutionnels>(
    `SELECT
        d.uid AS dossier_uid,
        EXISTS (
          SELECT 1 FROM officiel.scrutin_dossier sd
          JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
          WHERE sd.dossier_uid = d.uid AND s.est_vote_sur_ensemble
        ) AS vote_sur_ensemble,
        EXISTS (
          SELECT 1 FROM officiel.dossier_adopte_sans_vote v
          WHERE v.dossier_uid = d.uid
        ) AS adopte_49_3,
        EXISTS (
          SELECT 1 FROM officiel.scrutin_dossier sd
          JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
          WHERE sd.dossier_uid = d.uid AND s.type_vote_code = 'SPS'
        ) AS sps,
        (d.procedure_libelle ILIKE '%finances%'
          OR d.procedure_libelle ILIKE '%financement de la sécurité sociale%'
        ) AS loi_finances,
        EXISTS (
          SELECT 1 FROM officiel.acte_legislatif a
          WHERE a.dossier_uid = d.uid AND a.code_acte IN ('PROM', 'PROM-PUB')
        ) AS promulgue,
        EXISTS (
          SELECT 1 FROM officiel.acte_legislatif a
          WHERE a.dossier_uid = d.uid AND a.code_acte LIKE 'CC-SAISIE-%'
        ) AS saisine_cc
      FROM officiel.dossier d
      WHERE d.procedure_libelle IS DISTINCT FROM $1
        AND ($2::text IS NULL OR d.uid = $2)`,
    [PROCEDURE_ENGAGEMENT, dossierUnique ?? null],
  );

  console.log("Agrégation des actes (séances, dates) et des scrutins rattachés...");
  const actes = await db.query<ActesAgreges>(
    `SELECT
        dossier_uid,
        count(*) FILTER (WHERE code_acte LIKE '%-DEBATS-SEANCE')::int AS nb_seances,
        min(date_acte)::text AS premiere_date,
        max(date_acte) FILTER (WHERE code_acte IN ('PROM', 'PROM-PUB'))::text AS date_prom,
        max(date_acte)::text AS derniere_date
      FROM officiel.acte_legislatif
      GROUP BY dossier_uid`,
  );
  const scrutins = await db.query<ScrutinsAgreges>(
    `SELECT dossier_uid, count(*)::int AS nb_scrutins
       FROM officiel.scrutin_dossier
      WHERE dossier_uid IS NOT NULL
      GROUP BY dossier_uid`,
  );

  const actesParDossier = new Map(actes.map((a) => [a.dossier_uid, a]));
  const scrutinsParDossier = new Map(scrutins.map((s) => [s.dossier_uid, s.nb_scrutins]));

  // Métriques brutes par dossier, avant normalisation. `annee_depot` regroupe
  // les dossiers pour le calcul du percentile (docs/SCORING.md section 3.3,
  // appliqué à l'intensité parlementaire par la section 4).
  interface Brut {
    dossier_uid: string;
    annee_depot: number | null;
    nb_scrutins: number;
    nb_seances: number;
    duree_jours: number | null;
  }

  const bruts: Brut[] = dossiers.map(({ uid }) => {
    const a = actesParDossier.get(uid);
    const nb_scrutins = scrutinsParDossier.get(uid) ?? 0;
    const nb_seances = a?.nb_seances ?? 0;
    let annee_depot: number | null = null;
    let duree_jours: number | null = null;
    if (a?.premiere_date) {
      annee_depot = new Date(a.premiere_date).getUTCFullYear();
      const fin = a.date_prom ?? a.derniere_date ?? a.premiere_date;
      duree_jours = joursEntre(a.premiere_date, fin);
    }
    return { dossier_uid: uid, annee_depot, nb_scrutins, nb_seances, duree_jours };
  });

  // Regroupement par année de dépôt pour le calcul du percentile.
  const parAnnee = new Map<number | null, Brut[]>();
  for (const b of bruts) {
    const groupe = parAnnee.get(b.annee_depot) ?? [];
    groupe.push(b);
    parAnnee.set(b.annee_depot, groupe);
  }

  const nbDossiersParAnnee = new Map<number | null, number>();
  for (const [annee, groupe] of parAnnee) nbDossiersParAnnee.set(annee, groupe.length);

  interface IntensiteCalculee {
    dossier_uid: string;
    intensite_parlementaire: number;
    composantes: number;
    detail: Record<string, unknown>;
  }

  const intensites: IntensiteCalculee[] = [];
  for (const [annee, groupe] of parAnnee) {
    const scrutinsAnnee = groupe.map((b) => b.nb_scrutins);
    const seancesAnnee = groupe.map((b) => b.nb_seances);
    const dureesAnnee = groupe.map((b) => b.duree_jours).filter((v): v is number => v !== null);

    for (const b of groupe) {
      const pctScrutins = rangPercentile(b.nb_scrutins, scrutinsAnnee);
      const pctSeances = rangPercentile(b.nb_seances, seancesAnnee);
      const composantesDisponibles: number[] = [pctScrutins, pctSeances];
      const detail: Record<string, unknown> = {
        annee_depot: annee,
        nb_dossiers_annee: nbDossiersParAnnee.get(annee) ?? 0,
        nb_scrutins: { brut: b.nb_scrutins, percentile: round2(pctScrutins) },
        nb_seances: { brut: b.nb_seances, percentile: round2(pctSeances) },
      };
      if (b.duree_jours !== null) {
        const pctDuree = rangPercentile(b.duree_jours, dureesAnnee);
        composantesDisponibles.push(pctDuree);
        detail.duree_jours = { brut: b.duree_jours, percentile: round2(pctDuree) };
      } else {
        detail.duree_jours = null;
      }
      const moyenne =
        composantesDisponibles.reduce((s, v) => s + v, 0) / composantesDisponibles.length;
      intensites.push({
        dossier_uid: b.dossier_uid,
        intensite_parlementaire: moyenne,
        composantes: composantesDisponibles.length,
        detail,
      });
    }
  }
  const intensiteParDossier = new Map(intensites.map((i) => [i.dossier_uid, i]));

  console.log("Écriture de enrichissement.score_importance...");
  let ecrits = 0;
  await db.transaction(async () => {
    for (const s of signaux) {
      const { institutionnel, detail } = calculerInstitutionnel(s);
      const intensite = intensiteParDossier.get(s.dossier_uid);

      await db.query(
        `INSERT INTO enrichissement.score_importance
           (dossier_uid, institutionnel, institutionnel_detail,
            intensite_parlementaire, intensite_parlementaire_partiel,
            intensite_parlementaire_composantes, intensite_parlementaire_detail,
            version_formule, calcule_le)
         VALUES ($1, $2, $3, $4, true, $5, $6, $7, now())
         ON CONFLICT (dossier_uid) DO UPDATE SET
           institutionnel = EXCLUDED.institutionnel,
           institutionnel_detail = EXCLUDED.institutionnel_detail,
           intensite_parlementaire = EXCLUDED.intensite_parlementaire,
           intensite_parlementaire_partiel = true,
           intensite_parlementaire_composantes = EXCLUDED.intensite_parlementaire_composantes,
           intensite_parlementaire_detail = EXCLUDED.intensite_parlementaire_detail,
           version_formule = EXCLUDED.version_formule,
           calcule_le = now()`,
        [
          s.dossier_uid,
          institutionnel,
          JSON.stringify(detail),
          intensite ? round2(intensite.intensite_parlementaire) : null,
          intensite ? intensite.composantes : 0,
          intensite ? JSON.stringify(intensite.detail) : null,
          VERSION_FORMULE,
        ],
      );
      ecrits++;
    }
  });

  console.log(`  ${ecrits} scores écrits ou mis à jour.`);
  await db.close();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
