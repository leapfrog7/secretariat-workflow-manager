import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
const client = databaseUrl ? new pg.Client({ connectionString: databaseUrl }) : null;
const ids = {
  workspace: '10000000-0000-4000-8000-000000000001',
  division: '20000000-0000-4000-8000-000000000001',
  issue: '30000000-0000-4000-8000-000000000001',
  grant: '40000000-0000-4000-8000-000000000001',
  reportRequest: '50000000-0000-4000-8000-000000000001',
  deniedReportRequest: '50000000-0000-4000-8000-000000000002',
};

async function applyMigrations() {
  const directory = join(process.cwd(), 'db', 'migrations');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const migration = await readFile(join(directory, name), 'utf8');
    const statements = migration.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await client.query(statement);
  }
}

async function useIdentity(userId) {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('app.user_id', $1, false)", [userId]);
  await client.query('SET ROLE authenticated');
}

async function useOwner() {
  await client.query('RESET ROLE');
  await client.query("SELECT set_config('app.user_id', '', false)");
}

async function accessCapability(userId) {
  await useIdentity(userId);
  const result = await client.query(
    'SELECT public.can_manage_issue_access($1::uuid, $2::uuid) AS allowed',
    [ids.workspace, ids.issue],
  );
  return result.rows[0].allowed;
}

async function reportAccess(userId, issueIds = [ids.issue]) {
  await useIdentity(userId);
  const result = await client.query(
    'SELECT public.can_refine_issue_report($1::uuid, $2::uuid[]) AS allowed',
    [ids.workspace, issueIds],
  );
  return result.rows[0].allowed;
}

async function saveIssue({ userId, revision, visibility = 'division', title }) {
  await useIdentity(userId);
  return client.query(
    `SELECT * FROM public.save_cloud_issue_revision(
      $1::uuid, $2::uuid, $3::jsonb, $4::integer, $5::text, $6::text,
      $7::date, $8::boolean, $9::boolean, $10::uuid, $11::text
    )`,
    [
      ids.workspace,
      ids.issue,
      JSON.stringify({ id: ids.issue, shortTitle: title, subject: title, visibility, owningDivisionId: ids.division }),
      revision,
      'Pending',
      '',
      null,
      false,
      false,
      ids.division,
      visibility,
    ],
  );
}

before(async () => {
  if (!client) return;
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('DROP SCHEMA IF EXISTS auth CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('CREATE SCHEMA auth');
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END
    $$
  `);
  await client.query('GRANT USAGE ON SCHEMA public TO authenticated');
  await client.query(`
    CREATE FUNCTION auth.user_id()
    RETURNS text
    LANGUAGE sql
    STABLE
    AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$
  `);
  await client.query('GRANT USAGE ON SCHEMA auth TO authenticated');
  await client.query('GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated');
  await applyMigrations();

  await client.query(`
    INSERT INTO public.profiles (user_id, email, display_name, status, role) VALUES
      ('admin', 'admin@example.test', 'Workspace Admin', 'active', 'user'),
      ('division-admin', 'division-admin@example.test', 'Division Admin', 'active', 'user'),
      ('editor', 'editor@example.test', 'Editor', 'active', 'user'),
      ('viewer', 'viewer@example.test', 'Viewer', 'active', 'user'),
      ('target', 'target@example.test', 'Target User', 'active', 'user')
  `);
  await client.query(
    'INSERT INTO public.workspaces (id, name, code, created_by, division_access_enabled) VALUES ($1, $2, $3, $4, true)',
    [ids.workspace, 'Test Workspace', 'test-workspace', 'admin'],
  );
  await client.query(`
    INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES
      ($1, 'admin', 'workspace_admin', 'active'),
      ($1, 'division-admin', 'officer', 'active'),
      ($1, 'editor', 'officer', 'active'),
      ($1, 'viewer', 'viewer', 'active'),
      ($1, 'target', 'officer', 'active')
  `, [ids.workspace]);
  await client.query(
    'INSERT INTO public.workspace_divisions (id, workspace_id, name, code, created_by) VALUES ($1, $2, $3, $4, $5)',
    [ids.division, ids.workspace, 'Administration', 'admin', 'admin'],
  );
  await client.query(`
    INSERT INTO public.division_members (workspace_id, division_id, user_id, role, status, created_by) VALUES
      ($1, $2, 'division-admin', 'division_admin', 'active', 'admin'),
      ($1, $2, 'editor', 'editor', 'active', 'admin'),
      ($1, $2, 'viewer', 'viewer', 'active', 'admin')
  `, [ids.workspace, ids.division]);
  await client.query(
    `INSERT INTO public.cloud_issues (
      workspace_id, id, payload, status, owning_division_id, visibility,
      created_by, updated_by, revision
    ) VALUES ($1, $2, $3::jsonb, 'Pending', $4, 'division', 'admin', 'admin', 1)`,
    [ids.workspace, ids.issue, JSON.stringify({ id: ids.issue, shortTitle: 'Collaboration test', subject: 'Collaboration test' }), ids.division],
  );
  await client.query(
    `INSERT INTO public.cloud_ai_provider_settings (
      workspace_id, provider, enabled, model, created_by, updated_by
    ) VALUES ($1, 'gemini', true, 'test-model', 'admin', 'admin')`,
    [ids.workspace],
  );
});

after(async () => {
  if (client) await client.end();
});

test('collaboration access is enforced by PostgreSQL policies and revision functions', { skip: !databaseUrl }, async (context) => {
  await context.test('only workspace and owning-division managers can administer access', async () => {
    assert.equal(await accessCapability('admin'), true);
    assert.equal(await accessCapability('division-admin'), true);
    assert.equal(await accessCapability('editor'), false);
    assert.equal(await accessCapability('viewer'), false);
    assert.equal(await accessCapability('target'), false);
  });

  await context.test('ordinary editors cannot grant access through RLS', async () => {
    await useIdentity('editor');
    await assert.rejects(
      client.query(
        `INSERT INTO public.issue_access_grants (
          workspace_id, issue_id, id, principal_type, principal_id, access_level, granted_by
        ) VALUES ($1, $2, $3, 'user', 'target', 'viewer', 'editor')`,
        [ids.workspace, ids.issue, ids.grant],
      ),
      (error) => error.code === '42501',
    );
  });

  await context.test('the owning division manager can grant and revoke access', async () => {
    assert.equal(await accessCapability('target'), false);
    await useIdentity('division-admin');
    await client.query(
      `INSERT INTO public.issue_access_grants (
        workspace_id, issue_id, id, principal_type, principal_id, access_level, granted_by
      ) VALUES ($1, $2, $3, 'user', 'target', 'viewer', 'division-admin')`,
      [ids.workspace, ids.issue, ids.grant],
    );
    const inserted = await client.query('SELECT count(*)::int AS count FROM public.issue_access_grants WHERE id = $1', [ids.grant]);
    assert.equal(inserted.rows[0].count, 1);
    await useIdentity('target');
    const grantedAccess = await client.query(
      'SELECT public.issue_access_level($1::uuid, $2::uuid) AS access_level',
      [ids.workspace, ids.issue],
    );
    assert.equal(grantedAccess.rows[0].access_level, 'viewer');
    await useIdentity('division-admin');
    await client.query('DELETE FROM public.issue_access_grants WHERE id = $1', [ids.grant]);
    await useIdentity('target');
    const revokedAccess = await client.query(
      'SELECT public.issue_access_level($1::uuid, $2::uuid) AS access_level',
      [ids.workspace, ids.issue],
    );
    assert.equal(revokedAccess.rows[0].access_level, 'none');
  });

  await context.test('editors can update Issue content but cannot change its access policy', async () => {
    const contentUpdate = await saveIssue({ userId: 'editor', revision: 1, title: 'Updated by editor' });
    assert.equal(contentUpdate.rows[0].saved, true);
    assert.equal(contentUpdate.rows[0].revision, 2);

    await assert.rejects(
      saveIssue({ userId: 'editor', revision: 2, visibility: 'workspace', title: 'Access escalation attempt' }),
      /Issue access management permission required/,
    );
  });

  await context.test('viewers cannot update Issue content', async () => {
    await assert.rejects(
      saveIssue({ userId: 'viewer', revision: 2, title: 'Viewer update attempt' }),
      /Issue editing access required/,
    );
  });

  await context.test('report access includes readable Issues and rejects mixed or invalid sets', async () => {
    assert.equal(await reportAccess('viewer'), true);
    assert.equal(await reportAccess('target'), false);
    assert.equal(await reportAccess('viewer', []), false);
    assert.equal(await reportAccess('viewer', [ids.issue, null]), false);
    assert.equal(
      await reportAccess('viewer', [ids.issue, '30000000-0000-4000-8000-000000000099']),
      false,
    );
  });

  await context.test('Cloud AI report authorization checks Issue access and reserves usage atomically', async () => {
    await useIdentity('editor');
    const allowed = await client.query(
      `SELECT * FROM public.authorize_cloud_ai_report_request(
        $1::uuid, 'gemini', $2::uuid[], $3::uuid, 100
      )`,
      [ids.workspace, [ids.issue], ids.reportRequest],
    );
    assert.equal(allowed.rows[0].model, 'test-model');

    await useIdentity('target');
    await assert.rejects(
      client.query(
        `SELECT * FROM public.authorize_cloud_ai_report_request(
          $1::uuid, 'gemini', $2::uuid[], $3::uuid, 100
        )`,
        [ids.workspace, [ids.issue], ids.deniedReportRequest],
      ),
      /Issue report access required/,
    );
  });

  await context.test('suspension immediately removes effective access', async () => {
    await useOwner();
    await client.query(
      "UPDATE public.workspace_members SET status = 'suspended' WHERE workspace_id = $1 AND user_id = 'editor'",
      [ids.workspace],
    );
    await useIdentity('editor');
    const result = await client.query(
      'SELECT public.issue_access_level($1::uuid, $2::uuid) AS access_level',
      [ids.workspace, ids.issue],
    );
    assert.equal(result.rows[0].access_level, 'none');
  });

  await context.test('the owning division manager can change visibility', async () => {
    const policyUpdate = await saveIssue({ userId: 'division-admin', revision: 2, visibility: 'restricted', title: 'Updated by division manager' });
    assert.equal(policyUpdate.rows[0].saved, true);
    assert.equal(policyUpdate.rows[0].revision, 3);
  });
});
