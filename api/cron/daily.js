import { runDailyAutomation } from '../lib/dailyAutomation.js';

export default async function handler(request, response) {
  if (!process.env.CRON_SECRET || request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await runDailyAutomation();
    return response.status(200).json(result);
  } catch (error) {
    console.error('Daily automation failed.', error);
    return response.status(500).json({ error: 'Daily automation failed.' });
  }
}
