import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // Mock data for testing without real engine
  if (process.env.USE_MOCK_DATA === 'true' && method === 'GET') {
    return res.status(200).json({
      success: true,
      data: [
        {
          id: 'daily-incremental',
          name: 'Daily Incremental',
          cron: '0 2 * * *',
          sourceId: 'openclaw-workspace',
          destinationId: 'local-backup',
          backupType: 'incremental',
          enabled: true,
          lastRun: new Date(Date.now() - 86400000).toISOString(),
          nextRun: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          id: 'weekly-full',
          name: 'Weekly Full',
          cron: '0 3 * * 0',
          sourceId: 'openclaw-workspace',
          destinationId: 'local-backup',
          backupType: 'full',
          enabled: true,
          lastRun: new Date(Date.now() - 7 * 86400000).toISOString(),
          nextRun: new Date(Date.now() + 3 * 86400000).toISOString(),
        },
      ],
    });
  }

  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/schedules`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
