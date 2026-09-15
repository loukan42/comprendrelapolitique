/**
 * Requêtes de la liste des lois (`/lois`). Code serveur uniquement : voir
 * src/lib/db.server.ts.
 *
 * Tri : du texte dont la dernière étape est la plus récente au plus ancien.
 * Le score d'importance n'est plus un filtre : la liste reposait sur une
 * jointure interne avec `enrichissement.score_importance`, et une base où ce
 * calcul n'avait pas été lancé affichait « 0 dossiers ». Le score reste
 * affiché quand il existe, en information secondaire.
 *
 * Les dossiers d'engagement de responsabilité par 49.3 (`officiel.dossier_49_3`)
 * sont exclus : ce sont des dossiers de procédure, pas des lois autonomes ;
 * la loi qu'ils concernent porte le badge « Adopté par 49.3 ».
 *
 * Par défaut, la liste ne montre que les textes de loi (projets et
 * propositions de loi, lois organiques, constitutionnelles, de finances).
 * Les résolutions, commissions d'enquête et autres procédures s'affichent sur
 * demande.
 *
 * Le badge de résultat reprend la même priorité que `chargerBlocVote` de
 * lois.server.ts (49.3 avant vote sur l'ensemble), sans appeler cette
 * fonction, trop lourde pour trente lignes. Un dossier en conflit de
 * rattachement n'affiche pas de résultat tranché, pour ne jamais contredire
 * sa page.
 */

import { baseDisponible, ligne, query } from "./db.server";

export const TAILLE_PAGE = 30;

export const LEGISLATURES_LISTE = [17, 16, 15] as const;

export interface StatutDossier {
  libelle: string;
  adopte: boolean;
}

export interface DossierListe {
  uid: string;
  titre: string | null;
  legislature: number | null;
  scoreInstitutionnel: number | null;
  /** Date de la dernière étape connue, en heure de Paris (AAAA-MM-JJ). */
  derniereDate: string | null;
  statut: StatutDossier | null;
}

export interface ListeDossiers {
  dossiers: DossierListe[];
  total: number;
  page: number;
  nombrePages: number;
}

function deriverStatut(
  adopte49Trois: boolean,
  sortCodeVoteEnsemble: string | null,
  sortLibelleVoteEnsemble: string | null,
): StatutDossier | null {
  if (adopte49Trois) {
    return { libelle: "Adopté par 49.3", adopte: true };
  }
  if (sortCodeVoteEnsemble && sortLibelleVoteEnsemble) {
    // Le code officiel ("adopté"/"rejeté") tranche l'affichage, jamais une
    // recherche de sous-chaîne dans le libellé complet : "L'Assemblée
    // nationale n'a pas adopté" contient elle-même la sous-chaîne "adopt".
    return {
      libelle: sortLibelleVoteEnsemble,
      adopte: sortCodeVoteEnsemble === "adopté",
    };
  }
  return null;
}

/** Filtres communs au compte et à la page : mêmes paramètres, mêmes positions. */
const FILTRE = `
       d.legislature BETWEEN 15 AND 17
   AND NOT EXISTS (SELECT 1 FROM officiel.dossier_49_3 e WHERE e.dossier_uid = d.uid)
   AND ($1::text IS NULL OR d.titre ILIKE $1)
   AND ($2::smallint IS NULL OR d.legislature = $2)
   AND ($3::boolean OR d.procedure_libelle ILIKE '%loi%')`;

export async function chargerListeDossiers(options: {
  page: number;
  recherche: string | null;
  legislature: number | null;
  tout: boolean;
}): Promise<ListeDossiers> {
  if (!(await baseDisponible()))
    return { dossiers: [], total: 0, page: options.page, nombrePages: 0 };
  const recherche = options.recherche?.trim() || null;
  const motif = recherche ? `%${recherche}%` : null;
  const legislature = LEGISLATURES_LISTE.some((l) => l === options.legislature)
    ? options.legislature
    : null;
  const parametres = [motif, legislature, options.tout];

  const compte = await ligne<{ total: string }>(
    `SELECT count(*)::text AS total FROM officiel.dossier d WHERE ${FILTRE}`,
    parametres,
  );
  const total = Number(compte?.total ?? 0);
  const nombrePages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const page = Math.min(Math.max(1, Math.floor(options.page) || 1), nombrePages);

  const rows = await query<{
    uid: string;
    titre: string | null;
    legislature: number | null;
    institutionnel: number | null;
    derniere_date: string | null;
    adopte_49_3: boolean;
    en_conflit: boolean;
    vote_ensemble_sort_code: string | null;
    vote_ensemble_sort_libelle: string | null;
  }>(
    `WITH derniers AS (
       SELECT dossier_uid, max(date_acte) AS derniere
         FROM officiel.acte_legislatif
        WHERE date_acte <= now()
        GROUP BY dossier_uid
     )
     SELECT d.uid, d.titre, d.legislature, si.institutionnel,
            (de.derniere AT TIME ZONE 'Europe/Paris')::date::text AS derniere_date,
            EXISTS(
              SELECT 1 FROM officiel.dossier_adopte_sans_vote sv WHERE sv.dossier_uid = d.uid
            ) AS adopte_49_3,
            EXISTS(
              SELECT 1 FROM officiel.scrutin_dossier c
               WHERE c.methode = 'CONFLIT'
                 AND (c.dossier_officiel_uid = d.uid OR c.dossier_reconstruit_uid = d.uid)
            ) AS en_conflit,
            ve.sort_code AS vote_ensemble_sort_code,
            ve.sort_libelle AS vote_ensemble_sort_libelle
       FROM officiel.dossier d
       LEFT JOIN derniers de ON de.dossier_uid = d.uid
       LEFT JOIN enrichissement.score_importance si ON si.dossier_uid = d.uid
       LEFT JOIN LATERAL (
         SELECT s.sort_code, s.sort_libelle
           FROM officiel.scrutin_dossier sd
           JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
          WHERE sd.dossier_uid = d.uid
            AND s.est_vote_sur_ensemble
            AND s.type_vote_code <> 'MOC'
          ORDER BY s.date_scrutin DESC
          LIMIT 1
       ) ve ON true
      WHERE ${FILTRE}
      ORDER BY de.derniere DESC NULLS LAST, d.uid
      LIMIT $4 OFFSET $5`,
    [...parametres, TAILLE_PAGE, (page - 1) * TAILLE_PAGE],
  );

  return {
    dossiers: rows.map((r) => ({
      uid: r.uid,
      titre: r.titre,
      legislature: r.legislature,
      scoreInstitutionnel: r.institutionnel,
      derniereDate: r.derniere_date,
      // Même ordre de priorité que chargerBlocVote : 49.3 d'abord, puis le
      // conflit de rattachement (qui supprime tout badge), puis le vote normal.
      statut:
        r.en_conflit && !r.adopte_49_3
          ? null
          : deriverStatut(r.adopte_49_3, r.vote_ensemble_sort_code, r.vote_ensemble_sort_libelle),
    })),
    total,
    page,
    nombrePages,
  };
}
