export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { type, query } = req.query;
  const apiKey = process.env.FMCSA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'FMCSA API key not configured' });
  if (!query || !type) return res.status(400).json({ error: 'Missing query or type parameter' });
  try {
    let url;
    const base = 'https://mobile.fmcsa.dot.gov/qc/services';
    if (type === 'dot') url = `${base}/carriers/${encodeURIComponent(query)}?webKey=${apiKey}`;
    else if (type === 'mc') url = `${base}/carriers/docket-number/${encodeURIComponent(query)}?webKey=${apiKey}`;
    else if (type === 'name') url = `${base}/carriers/name/${encodeURIComponent(query)}?webKey=${apiKey}`;
    else return res.status(400).json({ error: 'Invalid type' });
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'FMCSA API error' });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch from FMCSA' });
  }
}
