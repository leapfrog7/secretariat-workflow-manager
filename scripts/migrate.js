import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Pull it with `vercel env pull .env.local`.');
}

const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
const useLocalPostgres = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
const localClient = useLocalPostgres ? new pg.Client({ connectionString: databaseUrl }) : null;
const sql = useLocalPostgres ? null : neon(databaseUrl);
const root = fileURLToPath(new URL('..', import.meta.url));
const migrationDirectory = join(root, 'db', 'migrations');

const setupStatements = [
  `
    CREATE TABLE IF NOT EXISTS public.swm_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `,
  `
    CREATE OR REPLACE FUNCTION public.apply_swm_migration(
      migration_name text,
      migration_statements text[]
    )
    RETURNS boolean
    LANGUAGE plpgsql
    SET search_path = ''
    AS $$
    DECLARE migration_statement text;
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('secretariat-workflow-manager:migrations'));
      IF EXISTS (SELECT 1 FROM public.swm_migrations WHERE name = migration_name) THEN
        RETURN false;
      END IF;
      FOREACH migration_statement IN ARRAY migration_statements LOOP
        EXECUTE migration_statement;
      END LOOP;
      INSERT INTO public.swm_migrations (name) VALUES (migration_name);
      RETURN true;
    END;
    $$
  `,
  'REVOKE ALL ON FUNCTION public.apply_swm_migration(text, text[]) FROM PUBLIC, authenticated',
];

async function prepareMigrationRunner() {
  if (localClient) {
    await localClient.connect();
    await localClient.query('BEGIN');
    try {
      for (const statement of setupStatements) await localClient.query(statement);
      await localClient.query('COMMIT');
    } catch (error) {
      await localClient.query('ROLLBACK');
      throw error;
    }
    return;
  }
  await sql.transaction((transaction) => setupStatements.map((statement) => transaction.query(statement)));
}

async function applyMigration(name, statements) {
  const query = 'SELECT public.apply_swm_migration($1, $2::text[]) AS applied';
  if (localClient) return (await localClient.query(query, [name, statements])).rows;
  return sql.query(query, [name, statements]);
}

await prepareMigrationRunner();

const files = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

for (const name of files) {
  const migration = await readFile(join(migrationDirectory, name), 'utf8');
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  try {
    const result = await applyMigration(name, statements);
    console.log(`${result[0]?.applied ? 'Applied' : 'Already applied'}: ${name}`);
  } catch (error) {
    throw Object.assign(error, { migration: name });
  }
}

if (localClient) await localClient.end();
