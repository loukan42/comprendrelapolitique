/**
 * Accès base de données pour les scripts d'import.
 *
 * L'interface est volontairement minuscule : une requête paramétrée et une
 * transaction. Elle permet de développer et de tester contre PGlite, qui est
 * PostgreSQL compilé en WebAssembly, sans serveur ni installation, puis de
 * basculer sur un vrai PostgreSQL (Supabase ou autre) en changeant une
 * variable d'environnement, sans toucher au code d'import.
 *
 * PGlite exécute le vrai moteur PostgreSQL : les types, les contraintes et les
 * `ON CONFLICT` s'y comportent à l'identique. Ce n'est pas une émulation.
 */

import { readFile } from "node:fs/promises";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Ouvre une base locale PGlite. `chemin` vide donne une base en mémoire, ce
 * qui convient aux tests ; un chemin donne une base persistée sur disque.
 */
export async function ouvrirPGlite(chemin?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = chemin ? new PGlite(chemin) : new PGlite();
  await pg.waitReady;

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const r = await pg.query<T>(sql, params);
      return r.rows;
    },
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      await pg.exec("BEGIN");
      try {
        const r = await fn();
        await pg.exec("COMMIT");
        return r;
      } catch (e) {
        await pg.exec("ROLLBACK");
        throw e;
      }
    },
    async close() {
      await pg.close();
    },
  };
}

/**
 * Ouvre un vrai PostgreSQL distant, par exemple une base Supabase.
 *
 * Une seule connexion (Client, pas Pool) : les scripts d'import tournent en
 * série, jamais concurremment, et une transaction doit rester sur la même
 * connexion du début à la fin, ce qu'un pool ne garantit pas.
 */
export async function ouvrirPostgres(url: string): Promise<Db> {
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: url,
    // Voir la même remarque dans src/queries/db.ts : la connexion reste
    // chiffrée, seule la vérification stricte du certificat est désactivée.
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  return {
    async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const r = await client.query(sql, params);
      return r.rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      await client.query("BEGIN");
      try {
        const r = await fn();
        await client.query("COMMIT");
        return r;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    },
    async close() {
      await client.end();
    },
  };
}

/**
 * Ouvre la base désignée par cible : un vrai PostgreSQL si elle commence par
 * postgres:// ou postgresql:// (par exemple une base Supabase, pour peupler
 * un déploiement), un fichier PGlite local sinon — l'usage habituel en
 * développement (CLAUDE.md). Chaque script d'import appelle cette fonction
 * plutôt que ouvrirPGlite directement, pour accepter les deux sans
 * changement d'appel.
 */
export function ouvrirBase(cible: string): Promise<Db> {
  return cible.startsWith("postgres://") || cible.startsWith("postgresql://")
    ? ouvrirPostgres(cible)
    : ouvrirPGlite(cible);
}

/** Applique un fichier de migration SQL. */
export async function appliquerMigration(db: Db, chemin: string): Promise<void> {
  await db.exec(await readFile(chemin, "utf8"));
}

/**
 * Insère un lot d'import et renvoie son identifiant. Chaque ligne importée y
 * renvoie : c'est la traçabilité exigée par la spécification, portée par une
 * seule clé étrangère plutôt que par sept colonnes répétées partout.
 */
export async function ouvrirLot(
  db: Db,
  lot: {
    jeu: string;
    legislature?: number | null;
    url: string;
    lastModified?: string | null;
    tailleOctets?: number | null;
    sha256: string;
  },
): Promise<number> {
  const rows = await db.query<{ id: number }>(
    `INSERT INTO officiel.import_lot
       (jeu, legislature, url_source, last_modified_source, taille_octets, sha256)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      lot.jeu,
      lot.legislature ?? null,
      lot.url,
      lot.lastModified ?? null,
      lot.tailleOctets ?? null,
      lot.sha256,
    ],
  );
  return rows[0]!.id;
}

export async function fermerLot(
  db: Db,
  lotId: number,
  stats: { inserees: number; modifiees?: number; statut?: string },
): Promise<void> {
  await db.query(
    `UPDATE officiel.import_lot
        SET termine_le = now(), lignes_inserees = $2, lignes_modifiees = $3, statut = $4
      WHERE id = $1`,
    [lotId, stats.inserees, stats.modifiees ?? 0, stats.statut ?? "termine"],
  );
}
