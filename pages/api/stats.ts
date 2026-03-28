import { NextApiRequest, NextApiResponse } from 'next';
const BACKUP_API = process.env.BACKUP_API_URL || 'http://localhost:18790';
export default async function handler(req, res) {
  if (process.env.USE_MOCK_DATA === 'true' && req.method === 'GET') {
    return res.status(200).json({ success: true, data: { system: { uptime: 1234567 }, destinations: [{ destinationId: 'local-backup', totalBackups: 42, totalSize: 12000000000, newestBackup: new Date(Date.now() - 86400000).toISOString() }], recentBackups: [{ id: 'mock-1', source: 'openclaw-workspace', destination: 'local-backup', type: 'full', status: 'completed', startedAt: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86400000 + 5000).toISOString(), size: 12345678 }, { id: 'mock-2', source: 'openclaw-workspace', destination: 'local-backup', type: 'full', status: 'running', startedAt: new Date().toISOString(), completedAt: null, size: 0 }] });
  }
  try {
    const r = await fetch();
    const d = await r.json();
    res.status(r.status).json(d);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}
