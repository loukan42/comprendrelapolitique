/**
 * Données du nuage des scrutins de la page d'accueil.
 *
 * Le nuage part en une chaîne compacte (voir `src/lib/nuageScrutins.ts`),
 * chargée après l'affichage de la page : elle ne pèse pas sur le premier
 * rendu, et la page reste complète sans elle.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  categorieDeScrutin,
  coder,
  TEINTES,
  teinteDe,
  type LegislatureNuage,
  type Teinte,
} from "../lib/nuageScrutins";
import { baseDisponible, requete } from "./db";

export interface DonneesNuage {
  /** Date du premier scrutin, origine des jours du codage (AAAA-MM-JJ). */
  origine: string;
  /** Date du dernier scrutin (AAAA-MM-JJ). */
  dernier: string;
  codes: string;
  total: number;
  /** Nombre de scrutins par teinte du nuage. */
  comptes: Record<Teinte, number>;
}

/**
 * Le nuage ne change qu'au rechargement des données, qui redémarre le
 * serveur : le calcul est gardé en mémoire après le premier appel réussi.
 */
let enMemoire: DonneesNuage | null = null;

const JOUR_MS = 86_400_000;

function jourUtc(date: string): number {
  return Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
}

export const chargerNuageScrutins = createServerFn({ method: "GET" }).handler(
  async (): Promise<DonneesNuage | null> => {
    if (enMemoire) return enMemoire;
    if (!(await baseDisponible())) return null;

    const lignes = await requete<{
      legislature: number;
      numero: number;
      date: string;
      type_vote_code: string;
      est_vote_sur_ensemble: boolean;
      objet_libelle: string;
      sort_code: string | null;
    }>(
      `SELECT legislature, numero, date_scrutin::text AS date, type_vote_code,
              est_vote_sur_ensemble, objet_libelle, sort_code
         FROM officiel.scrutin
        WHERE legislature IN (15, 16, 17)
        ORDER BY date_scrutin, numero`,
    );
    const premiere = lignes[0];
    const derniere = lignes[lignes.length - 1];
    if (!premiere || !derniere) return null;

    const base = jourUtc(premiere.date);
    const comptes = Object.fromEntries(TEINTES.map((t) => [t, 0])) as Record<Teinte, number>;
    const morceaux: string[] = [];
    for (const l of lignes) {
      const categorie = categorieDeScrutin({
        typeVoteCode: l.type_vote_code,
        estVoteSurEnsemble: l.est_vote_sur_ensemble,
        objet: l.objet_libelle,
      });
      const adopte = l.sort_code === "adopté";
      comptes[teinteDe({ categorie, adopte })] += 1;
      morceaux.push(
        coder({
          legislature: l.legislature as LegislatureNuage,
          numero: l.numero,
          jour: Math.round((jourUtc(l.date) - base) / JOUR_MS),
          categorie,
          adopte,
        }),
      );
    }

    enMemoire = {
      origine: premiere.date,
      dernier: derniere.date,
      codes: morceaux.join(""),
      total: lignes.length,
      comptes,
    };
    return enMemoire;
  },
);
