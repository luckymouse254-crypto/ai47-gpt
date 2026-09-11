module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const { prompt } = req.body || {};
    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) { res.status(500).json({ error: 'Missing HF_TOKEN' }); return; }
    const apiUrl = 'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell';
    const hfRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt || 'astronaut cat' })
    });
    if (!hfRes.ok) {
      const txt = await hfRes.text();
      res.status(500).json({ error: txt.slice(0,500) });
      return;
    }
    const buf = Buffer.from(await hfRes.arrayBuffer());
    res.status(200).json({ image: `data:image/png;base64,${buf.toString('base64')}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
