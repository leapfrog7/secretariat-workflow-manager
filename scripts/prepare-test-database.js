import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL is required.');

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query('CREATE SCHEMA IF NOT EXISTS auth');
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
    END
    $$
  `);
  await client.query(`
    CREATE OR REPLACE FUNCTION auth.user_id()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$
  `);
  await client.query('GRANT USAGE ON SCHEMA auth TO authenticated');
  await client.query('GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated');
} finally {
  await client.end();
}
