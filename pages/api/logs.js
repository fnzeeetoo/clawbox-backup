export default async function handler(req, res) {
  try {
    const response = await fetch('http://localhost:18790/api/logs');
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
