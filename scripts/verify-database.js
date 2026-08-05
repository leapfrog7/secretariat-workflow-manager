import { neon } from '@neondatabase/serverless';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const databaseUrl = process.env.DATABASE_URL;
const databaseHost = new URL(databaseUrl).hostname.toLowerCase();
const useLocalPostgres = ['localhost', '127.0.0.1', '::1'].includes(databaseHost);
const localClient = useLocalPostgres ? new pg.Client({ connectionString: databaseUrl }) : null;
const sql = useLocalPostgres ? null : neon(databaseUrl);
if (localClient) await localClient.connect();
const query = async (statement) => localClient
  ? (await localClient.query(statement)).rows
  : sql.query(statement);

const [tables, policies, functions, migrations, triggers, workspaces, memberships] = await Promise.all([
  query(`
    SELECT count(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('profiles', 'workspaces', 'workspace_members', 'workspace_divisions', 'division_members', 'issue_access_grants', 'audit_events', 'cloud_issues', 'cloud_officers', 'cloud_issue_items', 'cloud_workspace_settings', 'cloud_user_settings', 'cloud_notifications', 'automation_runs', 'cloud_ai_provider_settings', 'cloud_ai_user_permissions', 'cloud_ai_generation_logs', 'paragraph_bank_entries', 'casework_operational_events')
  `),
  query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public'"),
  query(`
    SELECT count(*)::int AS count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'is_platform_admin',
        'is_active_workspace_member',
        'is_workspace_admin',
        'can_edit_workspace',
        'admin_update_profile',
        'ensure_platform_workspace',
        'admin_set_workspace_member',
        'admin_create_workspace_for_user',
        'admin_approve_and_assign_user',
        'authorize_cloud_ai_request',
        'authorize_cloud_ai_report_request',
        'can_refine_issue_report',
        'issue_access_level',
        'can_read_issue',
        'can_edit_issue',
        'can_manage_issue_access',
        'list_my_issue_access',
        'issue_access_readiness',
        'set_division_access_enabled',
        'save_cloud_issue_revision',
        'save_cloud_issue_item_revision',
        'delete_cloud_issue_revision',
        'delete_cloud_issue_item_revision',
        'save_paragraph_bank_entry_revision',
        'delete_paragraph_bank_entry_revision',
        'enforce_draft_snapshot_retention',
        'preserve_last_profile_administrator',
        'preserve_last_workspace_administrator',
        'require_issue_division_when_enforced',
        'search_casework_issues',
        'record_casework_operational_event',
        'save_cloud_workspace_settings_revision'
      )
  `),
  query(`
    SELECT count(*)::int AS count
    FROM public.swm_migrations
    WHERE name IN (
      '001_identity_and_access.sql',
      '002_workspaces_and_cloud_issues.sql',
      '003_require_active_profile_for_workspace.sql',
      '004_workspace_editor_permissions.sql',
      '005_cloud_officer_directory.sql',
      '006_complete_workspace_sync.sql',
      '007_background_reminders.sql',
      '008_cloud_ai.sql',
      '009_division_access_foundation.sql',
      '010_shared_issue_access.sql',
      '011_reload_data_api_schema.sql',
      '012_optimistic_concurrency.sql',
      '013_security_and_sync_hardening.sql',
      '014_preserve_last_administrators.sql',
      '015_require_issue_division_when_enforced.sql',
      '016_separate_issue_access_management.sql',
      '017_cloud_ai_report_operation.sql',
      '018_report_permission_hardening.sql',
      '019_paragraph_bank.sql',
      '020_draft_snapshot_retention.sql',
      '021_issue_notes.sql',
      '022_workspace_provisioning_and_isolation.sql',
      '023_administration_workspace_directory.sql',
      '024_admin_approve_and_assign_workspace.sql',
      '025_casework_scale_and_telemetry.sql',
      '026_workspace_configuration_hardening.sql'
    )
  `),
  query(`
    SELECT count(*)::int AS count
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'preserve_last_profile_administrator_trigger',
        'preserve_last_workspace_administrator_trigger',
        'require_issue_division_when_enforced_trigger',
        'enforce_issue_access_management_trigger',
        'enforce_draft_snapshot_retention_trigger'
      )
  `),
  query('SELECT count(*)::int AS count FROM public.workspaces WHERE is_active = true'),
  query("SELECT count(*)::int AS count FROM public.workspace_members WHERE status = 'active'"),
]);

const result = {
  tables: tables[0].count,
  policies: policies[0].count,
  functions: functions[0].count,
  migrationRecords: migrations[0].count,
  securityGuardTriggers: triggers[0].count,
  activeWorkspaces: workspaces[0].count,
  activeMemberships: memberships[0].count,
};

const expected = {
  tables: 19,
  policies: 48,
  functions: 32,
  migrationRecords: 26,
  securityGuardTriggers: 5,
};
const valid = Object.entries(expected).every(([key, value]) => result[key] === value);

console.log(JSON.stringify(result, null, 2));
if (localClient) await localClient.end();
if (!valid) throw new Error('Database verification did not match the expected identity schema.');
