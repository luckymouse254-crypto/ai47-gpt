module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  try {
    const { prompt } = req.body || {};
    const HF_TOKEN = process.env.HF_TOKEN;
    const r = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt || 'astronaut cat' })
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(500).json({ error: t.slice(0,400) });
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.json({ image: `data:image/png;base64,${buf.toString('base64')}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
