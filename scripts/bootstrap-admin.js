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

await sql`
  INSERT INTO public.workspaces (name, code, created_by)
  VALUES ('Secretariat Workspace', 'secretariat', ${profiles[0].user_id})
  ON CONFLICT (code) DO NOTHING
`;

const workspaces = await sql`
  SELECT id, name, code
  FROM public.workspaces
  WHERE code = 'secretariat'
  LIMIT 1
`;

if (workspaces.length !== 1) throw new Error('Unable to create or find the default workspace.');

await sql`
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (${workspaces[0].id}, ${profiles[0].user_id}, 'workspace_admin', 'active')
  ON CONFLICT (workspace_id, user_id) DO UPDATE
  SET role = 'workspace_admin', status = 'active', updated_at = now()
`;

console.log(`Activated platform administrator: ${profiles[0].email}`);
console.log(`Workspace ready: ${workspaces[0].name} (${workspaces[0].code})`);
