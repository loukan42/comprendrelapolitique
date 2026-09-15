/**
 * Accès base de données des pages de loi (code serveur uniquement).
 *
 * Ce module délègue à `src/queries/db.ts`, qui tient la seule connexion
 * PGlite du serveur. Il ouvrait auparavant sa propre instance, sur un chemin
 * réglé par une autre variable (`DATABASE_PATH`, par défaut `data/pg16`) que
 * celle du reste du site (`CP_DB_PATH`) : la liste et les fiches de loi
 * lisaient alors une autre base que l'accueil, les quiz et l'actualité, et
 * une seconde instance PGlite pouvait ouvrir une base déjà tenue par un
 * autre processus, ce qui la corrompt. Une seule connexion, un seul chemin.
 *
 * Ce fichier ne doit jamais être importé depuis un composant client : le
 * suffixe `.server.ts` et l'usage exclusif via `createServerFn` (voir
 * src/lib/lois.server.ts) le tiennent hors du bundle navigateur.
 */

import { baseDisponible as baseChargee, requete, requeteUne } from "../queries/db";

/** Requête paramétrée. Seule porte d'entrée vers la base pour les pages de loi. */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return requete<T>(sql, params);
}

/**
 * La base est-elle chargée dans cet environnement ? Sans base, les pages
 * affichent leur état vide plutôt qu'une erreur (voir src/queries/db.ts).
 */
export function baseDisponible(): Promise<boolean> {
  return baseChargee();
}

/** Une seule ligne, ou `undefined` si la requête n'en renvoie aucune. */
export async function ligne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return (await requeteUne<T>(sql, params)) ?? undefined;
}
