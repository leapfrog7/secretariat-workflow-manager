import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const sql = neon(process.env.DATABASE_URL);
const [tables, policies, functions, migrations] = await Promise.all([
  sql`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'workspaces', 'workspace_members', 'audit_events')
  `,
  sql`SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'`,
  sql`
    SELECT count(*)::int AS count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_platform_admin', 'is_active_workspace_member', 'admin_update_profile')
  `,
  sql`
    SELECT count(*)::int AS count
    FROM public.swm_migrations
    WHERE name = '001_identity_and_access.sql'
  `,
]);

const result = {
  tables: tables[0].count,
  policies: policies[0].count,
  functions: functions[0].count,
  migrationRecords: migrations[0].count,
};

const expected = { tables: 4, policies: 8, functions: 3, migrationRecords: 1 };
const valid = Object.entries(expected).every(([key, value]) => result[key] === value);

console.log(JSON.stringify(result, null, 2));
if (!valid) throw new Error('Database verification did not match the expected identity schema.');
