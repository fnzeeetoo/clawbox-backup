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
          id: 'openclaw-workspace',
          name: 'OpenClaw Workspace',
          path: '/home/clawbox/.openclaw/workspace',
          type: 'directory',
          exclude: ['**/node_modules', '**/.cache', '**/tmp', '**/.git', '**/.npm'],
        },
        {
          id: 'openclaw-config',
          name: 'OpenClaw Configuration',
          path: '/etc/openclaw',
          type: 'directory',
        },
      ],
    });
  }

  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/sources`, {
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
