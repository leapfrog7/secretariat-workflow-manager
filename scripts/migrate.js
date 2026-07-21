import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Pull it with `vercel env pull .env.local`.');
}

const sql = neon(databaseUrl);
const root = fileURLToPath(new URL('..', import.meta.url));
const migrationDirectory = join(root, 'db', 'migrations');

await sql`
  CREATE TABLE IF NOT EXISTS public.swm_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

const files = (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort();

for (const name of files) {
  const existing = await sql`
    SELECT name FROM public.swm_migrations WHERE name = ${name}
  `;

  if (existing.length) {
    console.log(`Already applied: ${name}`);
    continue;
  }

  const migration = await readFile(join(migrationDirectory, name), 'utf8');
  const statements = migration
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }

  await sql`INSERT INTO public.swm_migrations (name) VALUES (${name})`;
  console.log(`Applied: ${name}`);
}
