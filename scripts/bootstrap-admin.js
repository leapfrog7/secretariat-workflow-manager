import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
const email = process.argv[2]?.trim().toLowerCase();

if (!databaseUrl) throw new Error('DATABASE_URL is required.');
if (!email) throw new Error('Usage: npm run admin:bootstrap -- officer@example.gov.in');

const sql = neon(databaseUrl);
const profiles = await sql`
  UPDATE public.profiles
  SET role = 'platform_admin', status = 'active', reviewed_at = now(), updated_at = now()
  WHERE lower(email) = ${email}
  RETURNING user_id, email
`;

if (profiles.length !== 1) {
  throw new Error(`Expected one registered profile for ${email}; found ${profiles.length}.`);
}

await sql`
  INSERT INTO public.audit_events (actor_user_id, event_type, target_type, target_id, metadata)
  VALUES ('bootstrap', 'profile.bootstrap_admin', 'profile', ${profiles[0].user_id}, ${JSON.stringify({ email })}::jsonb)
`;

console.log(`Activated platform administrator: ${profiles[0].email}`);
