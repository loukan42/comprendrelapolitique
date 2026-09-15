/**
 * Connexion en lecture à la base du site, côté serveur uniquement.
 *
 * Deux modes, choisis par la présence de `DATABASE_URL` :
 *
 * - Absente (développement local) : PGlite persisté par `npm run
 *   data:charger` (CLAUDE.md), un fichier sous `data/pg16` à la racine du
 *   repo, surchageable par `CP_DB_PATH`. Aucun serveur à démarrer.
 * - Présente (déploiement) : un vrai PostgreSQL distant, par exemple
 *   Supabase, ouvert avec `pg`. C'est le mode attendu en production, où
 *   PGlite — un fichier sur disque — ne survivrait de toute façon pas entre
 *   deux invocations d'un environnement sans disque persistant.
 *
 * Les deux modes exposent la même fonction `(sql, params) => lignes`, ce qui
 * laisse le reste de ce fichier, et tout le reste du site, inchangé entre
 * les deux : aucune requête ci-dessous ne sait laquelle des deux bases elle
 * interroge.
 *
 * Ce module ne connaît qu'une interface de lecture : les scripts d'import
 * (`scripts/import/db.ts`) restent seuls responsables des migrations et des
 * écritures, sur les deux mêmes bases.
 */

type Executeur = (sql: string, params: unknown[]) => Promise<unknown[]>;

let executeurPromise: Promise<Executeur> | null = null;

function obtenirExecuteur(): Promise<Executeur> {
  if (!executeurPromise) {
    const urlPostgres = process.env["DATABASE_URL"];
    executeurPromise = urlPostgres
      ? (async (): Promise<Executeur> => {
          const { Pool } = await import("pg");
          const pool = new Pool({
            connectionString: urlPostgres,
            // Un pool restreint : le site sert des pages, pas un traitement
            // massivement concurrent, et Supabase limite les connexions
            // simultanées selon le plan.
            max: 5,
            // Supabase présente un certificat que la chaîne de confiance par
            // défaut de Node ne valide pas toujours selon l'environnement de
            // déploiement ; la connexion reste chiffrée, seule la
            // vérification stricte du certificat est désactivée.
            ssl: { rejectUnauthorized: false },
          });
          return async (sql, params) => (await pool.query(sql, params)).rows;
        })()
      : (async (): Promise<Executeur> => {
          const { PGlite } = await import("@electric-sql/pglite");
          const chemin = process.env["CP_DB_PATH"] ?? "data/pg16";
          const pg = new PGlite(chemin);
          await pg.waitReady;
          return async (sql, params) => (await pg.query(sql, params)).rows;
        })();
  }
  return executeurPromise;
}

export async function requete<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const executer = await obtenirExecuteur();
  return (await executer(sql, params)) as T[];
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
 * En développement local sans base chargée, ou sur un déploiement dont la
 * base Postgres distante est vide, la requête ci-dessous répond simplement
 * « non ». Sans ce contrôle, chaque page interrogeant la base répondrait 500
 * avec « relation officiel.scrutin does not exist », y compris l'accueil :
 * le site entier paraîtrait cassé alors qu'il lui manque seulement ses
 * données. Les fonctions serveur renvoient donc un résultat vide, et les
 * pages affichent qu'elles attendent un chargement plutôt qu'une erreur.
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

const tables = new Map<string, Promise<boolean>>();

/**
 * Une table précise est-elle chargée ?
 *
 * Le schéma `enrichissement` se remplit par couches indépendantes :
 * formations, ordre des groupes, programmes, bilans, chacune par son propre
 * script. Que le schéma existe ne dit donc pas qu'une couche donnée a été
 * chargée : une base peut porter les programmes sans les formations. Se fier
 * au seul schéma faisait répondre 500 au quiz des votes sur une telle base.
 * Chaque requête vérifie la table qu'elle lit, et retombe sur sa version sans
 * enrichissement quand la table manque.
 *
 * Seule une réponse positive est gardée en cache. Une réponse négative peut
 * venir d'une requête échouée pendant le démarrage à froid du serveur : la
 * garder ferait passer une table présente pour absente jusqu'au redémarrage,
 * ce qui a vidé le QCM des programmes. Elle est donc revérifiée à la requête
 * suivante, pour le prix d'une requête minuscule.
 */
export async function tableDisponible(nomQualifie: `${string}.${string}`): Promise<boolean> {
  const connue = tables.get(nomQualifie);
  if (connue) return connue;
  const [schema, table] = nomQualifie.split(".");
  const existe = await requeteUne<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = $1 AND table_name = $2) AS existe`,
    [schema, table],
  )
    .then((r) => r?.existe ?? false)
    .catch(() => false);
  if (existe) tables.set(nomQualifie, Promise.resolve(true));
  return existe;
}
