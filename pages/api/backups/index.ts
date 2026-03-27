import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  try {
    const url = new URL(`/api/backups${req.url?.replace(/^\/api\/backups/, '') || ''}`, BACKUP_API);

    const fetchRes = await fetch(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers as Record<string, string>),
      },
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}