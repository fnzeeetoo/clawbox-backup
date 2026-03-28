import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  // Mock data for testing without real engine
  if (process.env.USE_MOCK_DATA === 'true') {
    if (method === 'GET') {
      return res.status(200).json({
        success: true,
        data: {
          detected: true,
          devices: [
            {
              id: 'usb-123',
              name: 'SanDisk Ultra',
              mountPoint: '/mnt/usb',
              totalSpace: 64e9, // 64 GB
              freeSpace: 32e9, // 32 GB free
              format: 'ext4',
              lastSeen: new Date().toISOString(),
            },
          ],
        },
      });
    }
    // For other methods, return simple success
    return res.status(200).json({ success: true, data: { action: method, mock: true } });
  }

  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/usb`, {
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
