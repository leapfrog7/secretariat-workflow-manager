import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const requestedOrigin = process.argv[2];
if (!requestedOrigin) {
  throw new Error('Usage: npm run auth:trust-origin -- https://app.example.com');
}

const parsed = new URL(requestedOrigin);
if (parsed.origin !== requestedOrigin || !['http:', 'https:'].includes(parsed.protocol)) {
  throw new Error('Provide an origin only, without a path or trailing slash.');
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  SELECT id, trusted_origins
  FROM neon_auth.project_config
`;

if (rows.length !== 1) {
  throw new Error(`Expected one Neon Auth configuration row; found ${rows.length}.`);
}

const trustedOrigins = Array.isArray(rows[0].trusted_origins) ? rows[0].trusted_origins : [];
const mergedOrigins = [...new Set([...trustedOrigins, requestedOrigin])];

await sql`
  UPDATE neon_auth.project_config
  SET trusted_origins = ${JSON.stringify(mergedOrigins)}::jsonb,
      updated_at = now()
  WHERE id = ${rows[0].id}
`;

console.log(`Trusted Auth origin: ${requestedOrigin}`);
