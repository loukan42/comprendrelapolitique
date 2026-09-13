/**
 * Connexion en lecture à la base du site, côté serveur uniquement.
 *
 * En développement, c'est le PGlite persisté par `npm run data:charger`
 * (CLAUDE.md) : un fichier sous `data/pg16` à la racine du repo, aucun
 * serveur à démarrer. Le chemin est surchageable par `CP_DB_PATH` pour
 * pointer vers une autre base (ex. `data/pg16test`). Ce module ne connaît
 * qu'une interface de lecture : les scripts d'import (`scripts/import/db.ts`)
 * restent seuls responsables des migrations et des écritures.
 */

import { PGlite } from "@electric-sql/pglite";

let dbPromise: Promise<PGlite> | null = null;

function obtenirDb(): Promise<PGlite> {
  if (!dbPromise) {
    const chemin = process.env["CP_DB_PATH"] ?? "data/pg16";
    dbPromise = (async () => {
      const pg = new PGlite(chemin);
      await pg.waitReady;
      return pg;
    })();
  }
  return dbPromise;
}

export async function requete<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await obtenirDb();
  const r = await db.query<T>(sql, params);
  return r.rows;
}

export async function requeteUne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const lignes = await requete<T>(sql, params);
  return lignes[0] ?? null;
}
