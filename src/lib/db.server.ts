/**
 * Accès base de données pour l'application (code serveur uniquement).
 *
 * Ce fichier ne doit jamais être importé depuis un composant client : il
 * ouvre `@electric-sql/pglite`, un moteur PostgreSQL compilé en WebAssembly
 * qui n'a rien à faire dans le bundle navigateur. Le suffixe `.server.ts` et
 * l'usage exclusif via `createServerFn` (voir src/lib/lois.server.ts) sont
 * les deux garde-fous : le premier documente l'intention, le second est celui
 * que TanStack Start applique réellement pour exclure ce code du bundle
 * client.
 *
 * Le chemin de la base est configurable par la variable d'environnement
 * `DATABASE_PATH`, par défaut `data/pg16`. Le jour où l'on bascule vers un
 * vrai PostgreSQL (Supabase ou autre), seule cette fonction change : le reste
 * du code interroge `query()`, pas PGlite directement.
 */

let connexion: Promise<{
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}> | null = null;

function cheminBase(): string {
  return process.env["DATABASE_PATH"]?.trim() || "data/pg16";
}

function ouvrirConnexion() {
  if (!connexion) {
    connexion = import("@electric-sql/pglite").then(async ({ PGlite }) => {
      const pg = new PGlite(cheminBase());
      await pg.waitReady;
      return pg;
    });
  }
  return connexion;
}

/** Requête paramétrée. Seule porte d'entrée vers la base pour le reste de l'application. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await ouvrirConnexion();
  const resultat = await db.query<T>(sql, params);
  return resultat.rows;
}

/** Une seule ligne, ou `undefined` si la requête n'en renvoie aucune. */
export async function ligne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const lignes = await query<T>(sql, params);
  return lignes[0];
}
