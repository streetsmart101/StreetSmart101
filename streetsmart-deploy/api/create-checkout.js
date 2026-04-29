export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { priceId, email, planId } = req.body;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });
  if (!priceId) return res.status(400).json({ error: 'Missing priceId' });
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'payment_method_types[]': 'card', 'line_items[0][price]': priceId, 'line_items[0][quantity]': '1', 'mode': 'subscription', 'customer_email': email || '', 'success_url': 'https://streetsmart101.vercel.app?success=true&plan=' + planId, 'cancel_url': 'https://streetsmart101.vercel.app?canceled=true', 'metadata[planId]': planId || '' }).toString()
    });
    const session = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: session.error?.message || 'Stripe error' });
    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
