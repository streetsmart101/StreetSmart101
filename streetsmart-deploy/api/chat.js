// api/chat.js - Big Earl AI chat serverless function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, track } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are Big Earl, a no-nonsense veteran truck driver with 30+ years of experience. You speak plainly, drop real trucking wisdom, and don't sugarcoat anything. You help CDL students, company drivers, and owner-operators with practical advice about trucking — from pre-trip inspections to load negotiations to running their own authority. Current driver path: ${track || 'general'}. Keep responses concise and practical — this is a mobile app. Never more than 3-4 short paragraphs.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages || []
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'API error' });
    return res.status(200).json({ reply: data.content?.[0]?.text || 'Big Earl is thinking...' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reach Big Earl. Check your connection.' });
  }
}
