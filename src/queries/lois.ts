/**
 * Fonctions serveur pour la page loi. S'appuient sur les vues de
 * `db/migrations/001_officiel.sql` qui portent déjà les règles non
 * négociables (AGENTS.md section 5) : `dossier_adopte_sans_vote` pour le
 * 49.3, jamais un vote individuel déduit de `position_majoritaire`.
 */

import { createServerFn } from "@tanstack/react-start";
import { requete, requeteUne } from "./db";

export interface ActeLoi {
  uid: string;
  codeActe: string | null;
  libelleCanonique: string | null;
  libelleCourt: string | null;
  dateActe: string | null;
  profondeur: number;
}

export interface RepartitionVote {
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
  effectif: number;
}

export interface SiegeVote {
  organeUid: string | null;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
}

export interface ScrutinLoi {
  uid: string;
  dateScrutin: string;
  titre: string;
  typeVoteCode: string;
  sortCode: string | null;
  sortLibelle: string | null;
  nombreVotants: number | null;
  suffragesRequis: number | null;
  repartition: RepartitionVote[];
  sieges: SiegeVote[];
}

export interface DossierEngagement {
  uid: string;
  titre: string | null;
  scrutin: ScrutinLoi | null;
}

export interface DetailLoi {
  dossier: {
    uid: string;
    titre: string | null;
    legislature: number | null;
    procedureLibelle: string | null;
  };
  actes: ActeLoi[];
  scrutinsEnsemble: ScrutinLoi[];
  adopteSansVote: boolean;
  dossiersEngagement: DossierEngagement[];
}

async function chargerRepartition(scrutinUid: string): Promise<RepartitionVote[]> {
  const lignes = await requete<{ position: RepartitionVote["position"]; effectif: string }>(
    `SELECT position, count(*) AS effectif
       FROM officiel.vote
      WHERE scrutin_uid = $1
      GROUP BY position
      ORDER BY position`,
    [scrutinUid],
  );
  return lignes.map((l) => ({ position: l.position, effectif: Number(l.effectif) }));
}

/** Un point par vote individuel réellement enregistré, pour l'hémicycle. */
async function chargerSieges(scrutinUid: string): Promise<SiegeVote[]> {
  const lignes = await requete<{ organe_uid: string | null; position: SiegeVote["position"] }>(
    `SELECT organe_uid, position FROM officiel.vote WHERE scrutin_uid = $1`,
    [scrutinUid],
  );
  return lignes.map((l) => ({ organeUid: l.organe_uid, position: l.position }));
}

async function chargerScrutin(row: {
  uid: string;
  date_scrutin: string;
  titre: string;
  type_vote_code: string;
  sort_code: string | null;
  sort_libelle: string | null;
  nombre_votants: number | null;
  suffrages_requis: number | null;
}): Promise<ScrutinLoi> {
  return {
    uid: row.uid,
    dateScrutin: row.date_scrutin,
    titre: row.titre,
    typeVoteCode: row.type_vote_code,
    sortCode: row.sort_code,
    sortLibelle: row.sort_libelle,
    nombreVotants: row.nombre_votants,
    suffragesRequis: row.suffrages_requis,
    repartition: await chargerRepartition(row.uid),
    sieges: await chargerSieges(row.uid),
  };
}

export const chargerDossier = createServerFn({ method: "GET" })
  .validator((uid: unknown): string => {
    if (typeof uid !== "string" || uid.length === 0) throw new Error("uid de dossier requis");
    return uid;
  })
  .handler(async ({ data: uid }): Promise<DetailLoi | null> => {
    const dossier = await requeteUne<{
      uid: string;
      titre: string | null;
      legislature: number | null;
      procedure_libelle: string | null;
    }>(`SELECT uid, titre, legislature, procedure_libelle FROM officiel.dossier WHERE uid = $1`, [
      uid,
    ]);
    if (!dossier) return null;

    const actesRows = await requete<{
      uid: string;
      code_acte: string | null;
      libelle_canonique: string | null;
      libelle_court: string | null;
      date_acte: string | null;
      profondeur: number;
    }>(
      `SELECT uid, code_acte, libelle_canonique, libelle_court, date_acte, profondeur
         FROM officiel.acte_legislatif
        WHERE dossier_uid = $1
        ORDER BY date_acte NULLS LAST, profondeur`,
      [uid],
    );

    const scrutinsRows = await requete<{
      uid: string;
      date_scrutin: string;
      titre: string;
      type_vote_code: string;
      sort_code: string | null;
      sort_libelle: string | null;
      nombre_votants: number | null;
      suffrages_requis: number | null;
    }>(
      `SELECT s.uid, s.date_scrutin, s.titre, s.type_vote_code, s.sort_code, s.sort_libelle,
              s.nombre_votants, s.suffrages_requis
         FROM officiel.scrutin_dossier sd
         JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
        WHERE sd.dossier_uid = $1 AND s.est_vote_sur_ensemble
        ORDER BY s.date_scrutin`,
      [uid],
    );

    const adopteSansVoteRow = await requeteUne(
      `SELECT 1 FROM officiel.dossier_adopte_sans_vote WHERE dossier_uid = $1`,
      [uid],
    );
    const adopteSansVote = adopteSansVoteRow !== null;

    let dossiersEngagement: DossierEngagement[] = [];
    if (adopteSansVote) {
      const engagementRows = await requete<{
        uid: string;
        titre: string | null;
      }>(
        `SELECT DISTINCT d.uid, d.titre
           FROM officiel.dossier_lie_par_acte l
           JOIN officiel.dossier d ON d.uid = l.dossier_lie_uid
          WHERE l.dossier_uid = $1`,
        [uid],
      );
      dossiersEngagement = await Promise.all(
        engagementRows.map(async (e) => {
          const motionRow = await requeteUne<{
            uid: string;
            date_scrutin: string;
            titre: string;
            type_vote_code: string;
            sort_code: string | null;
            sort_libelle: string | null;
            nombre_votants: number | null;
            suffrages_requis: number | null;
          }>(
            `SELECT s.uid, s.date_scrutin, s.titre, s.type_vote_code, s.sort_code, s.sort_libelle,
                    s.nombre_votants, s.suffrages_requis
               FROM officiel.scrutin_dossier sd
               JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
              WHERE sd.dossier_uid = $1 AND s.type_vote_code = 'MOC'
              ORDER BY s.date_scrutin
              LIMIT 1`,
            [e.uid],
          );
          return {
            uid: e.uid,
            titre: e.titre,
            scrutin: motionRow ? await chargerScrutin(motionRow) : null,
          };
        }),
      );
    }

    return {
      dossier: {
        uid: dossier.uid,
        titre: dossier.titre,
        legislature: dossier.legislature,
        procedureLibelle: dossier.procedure_libelle,
      },
      actes: actesRows.map((a) => ({
        uid: a.uid,
        codeActe: a.code_acte,
        libelleCanonique: a.libelle_canonique,
        libelleCourt: a.libelle_court,
        dateActe: a.date_acte,
        profondeur: a.profondeur,
      })),
      scrutinsEnsemble: await Promise.all(scrutinsRows.map(chargerScrutin)),
      adopteSansVote,
      dossiersEngagement,
    };
  });

export interface DossierListe {
  uid: string;
  titre: string | null;
  procedureLibelle: string | null;
  legislature: number | null;
}

/**
 * Recherche par titre, sur les dossiers uniquement pour l'instant (section 7
 * de la spécification vise aussi les scrutins, députés, lois : hors de ce
 * premier lot). `ILIKE` plutôt qu'un index de recherche plein texte : le
 * corpus tient en 3 000 dossiers, la latence n'est pas un problème avant de
 * justifier l'infrastructure supplémentaire.
 */
export const chercherDossiers = createServerFn({ method: "GET" })
  .validator((q: unknown): string => (typeof q === "string" ? q : ""))
  .handler(async ({ data: q }): Promise<DossierListe[]> => {
    const terme = q.trim();
    if (terme.length < 2) return [];
    const rows = await requete<{
      uid: string;
      titre: string | null;
      procedure_libelle: string | null;
      legislature: number | null;
    }>(
      `SELECT uid, titre, procedure_libelle, legislature
         FROM officiel.dossier
        WHERE titre ILIKE $1
        ORDER BY legislature DESC NULLS LAST, titre
        LIMIT 25`,
      [`%${terme}%`],
    );
    return rows.map((r) => ({
      uid: r.uid,
      titre: r.titre,
      procedureLibelle: r.procedure_libelle,
      legislature: r.legislature,
    }));
  });

export interface DossierRecent {
  dossierUid: string;
  titre: string | null;
  dateScrutin: string;
  sortCode: string | null;
  sortLibelle: string | null;
}

/**
 * Les votes sur l'ensemble d'un texte les plus récents, toutes législatures
 * confondues : contrairement au quiz (chargerQuestionsExpress dans
 * queries/quiz.ts), qui choisit par affluence pour le tirage des questions,
 * cette liste sert un usage différent (« qu'est-ce qui vient de se passer »)
 * et doit donc trier par date, pas par popularité.
 */
export const chargerScrutinsRecents = createServerFn({ method: "GET" }).handler(
  async (): Promise<DossierRecent[]> => {
    const rows = await requete<{
      dossier_uid: string;
      titre: string | null;
      date_scrutin: string;
      sort_code: string | null;
      sort_libelle: string | null;
    }>(
      `SELECT DISTINCT ON (sd.dossier_uid)
              sd.dossier_uid, d.titre, s.date_scrutin, s.sort_code, s.sort_libelle
         FROM officiel.scrutin s
         JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
         LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
        WHERE s.est_vote_sur_ensemble AND sd.dossier_uid IS NOT NULL
        ORDER BY sd.dossier_uid, s.date_scrutin DESC`,
    );
    return rows
      .map((r) => ({
        dossierUid: r.dossier_uid,
        titre: r.titre,
        dateScrutin: r.date_scrutin,
        sortCode: r.sort_code,
        sortLibelle: r.sort_libelle,
      }))
      .sort((a, b) => (a.dateScrutin < b.dateScrutin ? 1 : -1))
      .slice(0, 6);
  },
);
