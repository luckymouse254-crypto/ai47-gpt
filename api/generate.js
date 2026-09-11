export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { prompt } = req.body;
    const HF_TOKEN = process.env.HF_TOKEN;
    const MODEL = 'black-forest-labs/FLUX.1-schnell';
    const URL = https://router.huggingface.co/hf-inference/models/${MODEL};

    const r = await fetch(URL, {
      method: 'POST',
      headers: { 'Authorization': Bearer ${HF_TOKEN}, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt || 'cute cat', parameters: { num_inference_steps: 4 } })
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: t });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const base64 = buf.toString('base64');
    return res.status(200).json({ image: data:image/png;base64,${base64} });
    
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
