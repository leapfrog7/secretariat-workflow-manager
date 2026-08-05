import { neon } from '@neondatabase/serverless';
import { REQUIRED_DATABASE_MIGRATION } from '../shared/releaseContract.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DATABASE_URL) {
    return response.status(503).json({ status: 'not_ready', code: 'database_not_configured' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT EXISTS (
        SELECT 1 FROM public.swm_migrations WHERE name = ${REQUIRED_DATABASE_MIGRATION}
      ) AS compatible
    `;
    if (!rows[0]?.compatible) {
      return response.status(503).json({
        status: 'not_ready',
        code: 'database_migration_required',
        requiredMigration: REQUIRED_DATABASE_MIGRATION,
      });
    }
    return response.status(200).json({
      status: 'ready',
      service: 'secretariat-workflow-manager-api',
      requiredMigration: REQUIRED_DATABASE_MIGRATION,
      capabilities: { dailyAutomation: Boolean(process.env.CRON_SECRET) },
    });
  } catch (error) {
    console.error('API readiness check failed.', { message: error.message });
    return response.status(503).json({ status: 'not_ready', code: 'database_unavailable' });
  }
}
