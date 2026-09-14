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

let basePromise: Promise<boolean> | null = null;

/**
 * La base de données est-elle chargée dans cet environnement ?
 *
 * `data/` n'est pas versionné (voir .gitignore) : les données sont
 * retéléchargeables, c'est le code d'import qui est le livrable. Un
 * déploiement fait depuis le dépôt seul, comme la prévisualisation Lovable,
 * démarre donc sans aucune base, et PGlite en crée une vide à la première
 * requête.
 *
 * Sans ce contrôle, chaque page interrogeant la base répond 500 avec
 * « relation officiel.scrutin does not exist », y compris l'accueil : le site
 * entier paraît cassé alors qu'il lui manque seulement ses données. Les
 * fonctions serveur renvoient donc un résultat vide, et les pages affichent
 * qu'elles attendent un chargement plutôt qu'une erreur.
 *
 * Le résultat est mis en cache pour la durée du processus : une base ne se
 * charge pas pendant que le serveur tourne.
 */
export function baseDisponible(): Promise<boolean> {
  if (!basePromise) {
    basePromise = requeteUne<{ existe: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata
                       WHERE schema_name = 'officiel') AS existe`,
    )
      .then((r) => r?.existe ?? false)
      .catch(() => false);
  }
  return basePromise;
}

let enrichissementPromise: Promise<boolean> | null = null;

/**
 * Le schéma `enrichissement` est optionnel : `npm run data:charger` produit
 * une base complète sans lui, et c'est `data:formations` qui le crée. Une
 * base chargée sans cette étape doit servir le site, avec les groupes
 * parlementaires seuls et sans regroupement par formation, plutôt que de
 * renvoyer une erreur sur chaque page.
 *
 * Le résultat est mis en cache pour la durée du processus : le schéma
 * n'apparaît pas en cours d'exécution du serveur.
 */
export function enrichissementDisponible(): Promise<boolean> {
  if (!enrichissementPromise) {
    enrichissementPromise = requeteUne<{ existe: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata
                       WHERE schema_name = 'enrichissement') AS existe`,
    ).then((r) => r?.existe ?? false);
  }
  return enrichissementPromise;
}
