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
          id: 'local-backup',
          name: 'Local SSD Backup Store',
          type: 'local',
          mountPoint: '/var/backups',
          path: 'clawbox',
          retention: { policy: 'keep_last', days: 30 },
        },
        {
          id: 'usb-backup',
          name: 'USB Drive Backup',
          type: 'usb',
          mountPoint: '/mnt/usb',
          path: 'clawbox',
          retention: { policy: 'keep_last', days: 60 },
        },
      ],
    });
  }

  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/destinations`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
