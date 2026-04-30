// api/auth.js - Supabase auth proxy to bypass CORS
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name, token, userId, progress, profile, trackId, refreshToken } = req.body;

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://caepuprpgpajaztboclq.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZXB1cHJwZ3BhamF6dGJvY2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDMxNTYsImV4cCI6MjA5MzExOTE1Nn0.TahznaO2p9PRdIS1P6JxVBn49QjNJSbaaf6OlrZ_j80";

  try {
    // ── SIGN UP ──────────────────────────────────────────────────────────────
    if (action === 'signup') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: { name, full_name: name } })
      });
      const data = await r.json();
      if (!r.ok) return res.status(200).json({ error: data.error_description || data.msg || data.message || 'Sign up failed' });
      if (data.access_token) {
        return res.status(200).json({ user: { id: data.user?.id, email: data.user?.email, name, token: data.access_token, refresh_token: data.refresh_token } });
      }
      return res.status(200).json({ success: true, needsConfirmation: false });
    }

    // ── SIGN IN ──────────────────────────────────────────────────────────────
    if (action === 'signin') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok) return res.status(200).json({ error: data.error_description || data.message || 'Invalid email or password' });
      return res.status(200).json({ user: { id: data.user?.id, email: data.user?.email, name: data.user?.user_metadata?.name || data.user?.user_metadata?.full_name || email.split('@')[0], token: data.access_token, refresh_token: data.refresh_token } });
    }

    // ── SIGN OUT ─────────────────────────────────────────────────────────────
    if (action === 'signout') {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      return res.status(200).json({ success: true });
    }

    // ── RESET PASSWORD ───────────────────────────────────────────────────────
    if (action === 'reset') {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email })
      });
      return res.status(200).json({ success: r.ok });
    }

    // ── SAVE PROGRESS ────────────────────────────────────────────────────────
    if (action === 'saveProgress') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/user_progress?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ progress: progress || {}, profile: profile || {}, track_id: trackId || 'beginner', updated_at: new Date().toISOString() })
      });
      // If PATCH found no rows, do INSERT
      if (r.status === 404 || r.headers.get('content-range') === '*/0') {
        const r2 = await fetch(`${SUPABASE_URL}/rest/v1/user_progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ user_id: userId, progress: progress || {}, profile: profile || {}, track_id: trackId || 'beginner', updated_at: new Date().toISOString() })
        });
        return res.status(200).json({ success: r2.ok });
      }
      return res.status(200).json({ success: true });
    }

    // ── LOAD PROGRESS ────────────────────────────────────────────────────────
    if (action === 'loadProgress') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/user_progress?user_id=eq.${userId}&select=progress,profile,track_id`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data?.[0]) return res.status(200).json({ data: null });
      return res.status(200).json({ data: { progress: data[0].progress, profile: data[0].profile, trackId: data[0].track_id } });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (e) {
    return res.status(200).json({ error: `Server error: ${e.message}` });
  }
}
