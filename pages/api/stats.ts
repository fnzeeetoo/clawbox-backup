import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Mock data for testing without real engine
  if (process.env.USE_MOCK_DATA === 'true' && req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: {
        totalBackups: 42,
        totalSize: 1.2e10, // ~12GB
        lastBackup: new Date(Date.now() - 86400000).toISOString(),
        nextScheduled: new Date(Date.now() + 3600000).toISOString(),
        sourcesCount: 2,
        destinationsCount: 1,
        recentActivity: [
          { type: 'backup_completed', source: 'openclaw-workspace', destination: 'local-backup', timestamp: new Date(Date.now() - 86400000).toISOString(), size: 12345678 },
          { type: 'backup_started', source: 'openclaw-workspace', destination: 'local-backup', timestamp: new Date().toISOString(), size: 0 },
        ],
      },
    });
  }

  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/stats`);
    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
