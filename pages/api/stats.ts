import { NextApiRequest, NextApiResponse } from 'next';

const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18789';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const fetchRes = await fetch(`${BACKUP_API}/api/stats`);
    const data = await fetchRes.json();
    res.status(fetchRes.status).json(data);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}