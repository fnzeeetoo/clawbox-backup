import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  console.log('PROXY DEBUG: incoming', { method, url: req.url, body: req.body });

  // Mock data for testing without real engine
  if (process.env.USE_MOCK_DATA === 'true') {
    if (method === 'GET') {
      // Mock list of backups
      return res.status(200).json({
        success: true,
        data: [
          {
            id: 'mock-backup-1',
            sourceId: 'openclaw-workspace',
            destinationId: 'local-backup',
            type: 'full',
            timestamp: new Date().toISOString(),
            size: 12345678,
            status: 'completed',
          },
        ],
      });
    }
    if (method === 'POST') {
      const { sourceId, destinationId, backupType = 'incremental' } = req.body;
      if (!sourceId || !destinationId) {
        return res.status(400).json({ success: false, error: 'Invalid source or destination' });
      }
      const mockBackup = {
        id: `mock-${Date.now()}`,
        sourceId,
        destinationId,
        type: backupType,
        timestamp: new Date().toISOString(),
        size: 0,
        status: 'running',
      };
      return res.status(200).json({ success: true, data: mockBackup });
    }
  }

  try {
    const url = new URL(`/api/backups${req.url?.replace(/^\/api\/backups/, '') || ''}`, BACKUP_API);
    console.log('PROXY DEBUG: forwarding to', url.toString(), { body: req.body });

    const fetchRes = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    console.log('PROXY DEBUG: engine responded', fetchRes.status);
    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    console.error('PROXY DEBUG: error', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
}
