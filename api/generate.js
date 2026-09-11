const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = process.env.HF_MODEL || 'black-forest-labs/FLUX.1-schnell';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const prompt = req.body?.prompt || 'cute cat astronaut';
    if (!HF_TOKEN) return res.status(500).json({ error: 'HF_TOKEN missing in Vercel Env' });

    const url = https://router.huggingface.co/hf-inference/models/${HF_MODEL};
    
    const hfRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': Bearer ${HF_TOKEN},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 4 } })
    });

    if (!hfRes.ok) {
      const txt = await hfRes.text();
      return res.status(500).json({ error: HF ${hfRes.status}: ${txt} });
    }

    const buffer = Buffer.from(await hfRes.arrayBuffer());
    const base64 = buffer.toString('base64');
    return res.json({ image: data:image/png;base64,${base64} });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
