import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  console.log('PROXY DEBUG: incoming', { method, url: req.url, body: req.body });

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