export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const { action, priceId, email, planId, sessionId } = req.body;

  // ── VERIFY SESSION ───────────────────────────────────────────────────────
  if (action === 'verify' || sessionId) {
    try {
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` }
      });
      const session = await r.json();
      if (!r.ok) return res.status(200).json({ verified: false, error: 'Could not verify session' });
      if (session.payment_status === 'paid') {
        return res.status(200).json({ verified: true, planId: session.metadata?.planId || planId, email: session.customer_email });
      }
      return res.status(200).json({ verified: false, error: 'Payment not completed' });
    } catch(e) {
      return res.status(200).json({ verified: false, error: e.message });
    }
  }

  // ── CUSTOMER PORTAL (manage/cancel subscription) ─────────────────────────
  if (action === 'portal') {
    try {
      // Find customer by email
      const search = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
        headers: { 'Authorization': `Bearer ${stripeKey}` }
      });
      const customers = await search.json();
      const customerId = customers.data?.[0]?.id;
      if (!customerId) return res.status(200).json({ error: 'No subscription found for this account' });

      // Create portal session
      const portal = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'customer': customerId,
          'return_url': 'https://streetsmart101.vercel.app'
        }).toString()
      });
      const portalSession = await portal.json();
      if (!portal.ok) return res.status(200).json({ error: portalSession.error?.message || 'Could not open billing portal' });
      return res.status(200).json({ url: portalSession.url });
    } catch(e) {
      return res.status(200).json({ error: e.message });
    }
  }

  // ── CREATE CHECKOUT SESSION ───────────────────────────────────────────────
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'customer_email': email || '',
        'success_url': `https://streetsmart101.vercel.app?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&success=true`,
        'cancel_url': 'https://streetsmart101.vercel.app?canceled=true',
        'metadata[planId]': planId || ''
      }).toString()
    });

    const session = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: session.error?.message || 'Stripe error' });
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch(e) {
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
