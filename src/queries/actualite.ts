/**
 * « En ce moment » : ce qui vient de se passer à l'Assemblée nationale, lu
 * dans l'Open Data, sans autre source.
 *
 * Trois listes, chacune fondée sur un fait daté de la source :
 *
 * - les textes déposés, par l'acte `AN1-DEPOT` ou `ANLUNI-DEPOT` (« 1er dépôt
 *   d'une initiative ») ; un dépôt au Sénat pendant la navette (`SN1-DEPOT`)
 *   n'en fait pas partie, la liste ne parle que de l'Assemblée. Une initiative
 *   n'est pas toujours une loi : `ANLUNI-DEPOT` couvre aussi les propositions
 *   de résolution, d'où la nature de chaque texte, affichée à côté ;
 * - les votes sur l'ensemble d'un texte, avec leur résultat ;
 * - les lois promulguées, par l'acte `PROM-PUB` (« Promulgation d'une loi »).
 *
 * Les dates d'acte sont des horodatages avec fuseau (« 2021-08-02T00:00+02:00 »).
 * Converties en date sans préciser le fuseau, elles reculeraient d'un jour :
 * elles sont donc lues à l'heure de Paris.
 *
 * Aucune mesure de couverture médiatique : le site n'a pas de source pour
 * cela, et la page le dit plutôt que de classer les textes à l'impression.
 */

import { createServerFn } from "@tanstack/react-start";
import { baseDisponible, requete } from "./db";

export interface EvenementDossier {
  dossierUid: string;
  titre: string | null;
  /** Date au format AAAA-MM-JJ, à l'heure de Paris. */
  date: string;
}

export interface DepotRecent extends EvenementDossier {
  /** Nature de l'initiative selon la source : projet de loi, proposition de résolution… */
  procedure: string | null;
}

export interface VoteRecent extends EvenementDossier {
  sortCode: string | null;
  sortLibelle: string | null;
}

export interface Actualite {
  depots: DepotRecent[];
  votes: VoteRecent[];
  promulgations: EvenementDossier[];
  /** Date de publication de l'archive la plus récente chargée, s'il y en a une. */
  miseAJour: string | null;
}

/** Nombre d'éléments par liste. */
const NOMBRE = 8;

export const chargerActualite = createServerFn({ method: "GET" }).handler(
  async (): Promise<Actualite> => {
    if (!(await baseDisponible())) {
      return { depots: [], votes: [], promulgations: [], miseAJour: null };
    }

    // Premier dépôt de chaque dossier, puis les plus récents.
    const depots = await requete<{
      dossier_uid: string;
      titre: string | null;
      date: string;
      procedure_libelle: string | null;
    }>(
      `SELECT dossier_uid, titre, date::text AS date, procedure_libelle FROM (
         SELECT DISTINCT ON (a.dossier_uid) a.dossier_uid, d.titre, d.procedure_libelle,
                (a.date_acte AT TIME ZONE 'Europe/Paris')::date AS date
           FROM officiel.acte_legislatif a
           JOIN officiel.dossier d ON d.uid = a.dossier_uid
          WHERE a.code_acte IN ('AN1-DEPOT', 'ANLUNI-DEPOT') AND a.date_acte IS NOT NULL
          ORDER BY a.dossier_uid, a.date_acte
       ) premiers
       ORDER BY date DESC, dossier_uid
       LIMIT $1`,
      [NOMBRE],
    );

    // Dernier vote sur l'ensemble de chaque dossier, puis les plus récents.
    const votes = await requete<{
      dossier_uid: string;
      titre: string | null;
      date: string;
      sort_code: string | null;
      sort_libelle: string | null;
    }>(
      `SELECT dossier_uid, titre, date::text AS date, sort_code, sort_libelle FROM (
         SELECT DISTINCT ON (sd.dossier_uid) sd.dossier_uid, d.titre,
                s.date_scrutin AS date, s.sort_code, s.sort_libelle
           FROM officiel.scrutin s
           JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
           LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
          WHERE s.est_vote_sur_ensemble AND sd.dossier_uid IS NOT NULL
          ORDER BY sd.dossier_uid, s.date_scrutin DESC
       ) derniers
       ORDER BY date DESC, dossier_uid
       LIMIT $1`,
      [NOMBRE],
    );

    const promulgations = await requete<{
      dossier_uid: string;
      titre: string | null;
      date: string;
    }>(
      `SELECT dossier_uid, titre, date::text AS date FROM (
         SELECT DISTINCT ON (a.dossier_uid) a.dossier_uid, d.titre,
                (a.date_acte AT TIME ZONE 'Europe/Paris')::date AS date
           FROM officiel.acte_legislatif a
           JOIN officiel.dossier d ON d.uid = a.dossier_uid
          WHERE a.code_acte = 'PROM-PUB' AND a.date_acte IS NOT NULL
          ORDER BY a.dossier_uid, a.date_acte DESC
       ) promulguees
       ORDER BY date DESC, dossier_uid
       LIMIT $1`,
      [NOMBRE],
    );

    const [lot] = await requete<{ date: string | null }>(
      `SELECT (max(last_modified_source) AT TIME ZONE 'Europe/Paris')::date::text AS date
         FROM officiel.import_lot`,
    );

    const evenement = (r: { dossier_uid: string; titre: string | null; date: string }) => ({
      dossierUid: r.dossier_uid,
      titre: r.titre,
      date: r.date,
    });

    return {
      depots: depots.map((r) => ({ ...evenement(r), procedure: r.procedure_libelle })),
      votes: votes.map((r) => ({
        ...evenement(r),
        sortCode: r.sort_code,
        sortLibelle: r.sort_libelle,
      })),
      promulgations: promulgations.map(evenement),
      miseAJour: lot?.date ?? null,
    };
  },
);
