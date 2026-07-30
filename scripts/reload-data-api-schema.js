import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const sql = neon(process.env.DATABASE_URL);
await sql`SELECT pg_notify('pgrst', 'reload schema')`;
await sql`SELECT pg_notify('pgrst', 'reload config')`;
console.log('Data API schema and configuration reload requested.');
