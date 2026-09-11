export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { prompt } = req.body || {};
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) return res.status(500).json({ error: 'Add HF_TOKEN in Vercel Env' });
    
    const r = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt || 'sad man' })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: t.slice(0,500) });
    }
    const b = Buffer.from(await r.arrayBuffer());
    return res.json({ image: `data:image/png;base64,${b.toString('base64')}` });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
