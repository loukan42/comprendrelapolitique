/**
 * Requêtes de la liste des dossiers législatifs (`/lois`). Code serveur
 * uniquement : voir src/lib/db.server.ts.
 *
 * Tri par défaut : `enrichissement.score_importance.institutionnel`
 * décroissant. C'est le seul des quatre sous-scores calculé aujourd'hui
 * (docs/CLASSIFICATION.md) : médiatique et portée restent NULL partout, donc
 * `score_total` l'est aussi pour chaque dossier (docs/SCORING.md section 7).
 * Ne jamais trier sur `score_total`. La jointure avec
 * `enrichissement.score_importance` est volontairement une jointure interne :
 * les 29 dossiers d'engagement de responsabilité par 49.3 n'ont pas de score
 * (docs/CLASSIFICATION.md section 1) et ne doivent pas apparaître comme des
 * lois autonomes dans cette liste.
 *
 * Le badge de résultat reprend la même priorité que `chargerBlocVote` de
 * lois.server.ts (49.3 avant vote sur l'ensemble), sans appeler cette
 * fonction : elle charge le détail complet d'un scrutin (groupes, votes
 * individuels un par un) pour une seule page loi, ce qui serait
 * disproportionné répété pour les trente lignes d'une page de liste. Le
 * gabarit « conflit » et le gabarit « aucun scrutin » n'ont pas de badge ici :
 * la liste n'affiche un résultat que quand il est connu et non ambigu.
 */

import { baseDisponible, ligne, query } from "./db.server";

export const TAILLE_PAGE = 30;

export interface StatutDossier {
  libelle: string;
  adopte: boolean;
}

export interface DossierListe {
  uid: string;
  titre: string | null;
  scoreInstitutionnel: number;
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

export async function chargerListeDossiers(options: {
  page: number;
  recherche: string | null;
}): Promise<ListeDossiers> {
  if (!(await baseDisponible()))
    return { dossiers: [], total: 0, page: options.page, nombrePages: 0 };
  const recherche = options.recherche?.trim() || null;
  const motif = recherche ? `%${recherche}%` : null;

  const compte = await ligne<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM officiel.dossier d
       JOIN enrichissement.score_importance si ON si.dossier_uid = d.uid
      WHERE $1::text IS NULL OR d.titre ILIKE $1`,
    [motif],
  );
  const total = Number(compte?.total ?? 0);
  const nombrePages = Math.max(1, Math.ceil(total / TAILLE_PAGE));
  const page = Math.min(Math.max(1, Math.floor(options.page) || 1), nombrePages);

  const rows = await query<{
    uid: string;
    titre: string | null;
    institutionnel: number;
    derniere_date: string | null;
    adopte_49_3: boolean;
    en_conflit: boolean;
    vote_ensemble_sort_code: string | null;
    vote_ensemble_sort_libelle: string | null;
  }>(
    `SELECT d.uid, d.titre, si.institutionnel,
            (SELECT max(a.date_acte)::text
               FROM officiel.acte_legislatif a
              WHERE a.dossier_uid = d.uid) AS derniere_date,
            EXISTS(
              SELECT 1 FROM officiel.dossier_adopte_sans_vote sv WHERE sv.dossier_uid = d.uid
            ) AS adopte_49_3,
            -- Même règle que le gabarit conflit de chargerBlocVote (lois.server.ts) :
            -- un dossier partie prenante d'un rattachement CONFLIT n'affiche pas
            -- de résultat tranché ici, pour ne jamais contredire la page dossier.
            EXISTS(
              SELECT 1 FROM officiel.scrutin_dossier c
               WHERE c.methode = 'CONFLIT'
                 AND (c.dossier_officiel_uid = d.uid OR c.dossier_reconstruit_uid = d.uid)
            ) AS en_conflit,
            ve.sort_code AS vote_ensemble_sort_code,
            ve.sort_libelle AS vote_ensemble_sort_libelle
       FROM officiel.dossier d
       JOIN enrichissement.score_importance si ON si.dossier_uid = d.uid
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
      WHERE $1::text IS NULL OR d.titre ILIKE $1
      ORDER BY si.institutionnel DESC, d.uid
      LIMIT $2 OFFSET $3`,
    [motif, TAILLE_PAGE, (page - 1) * TAILLE_PAGE],
  );

  return {
    dossiers: rows.map((r) => ({
      uid: r.uid,
      titre: r.titre,
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
