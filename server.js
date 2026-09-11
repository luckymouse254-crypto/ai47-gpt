const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
const HF_MODEL = process.env.HF_MODEL || 'black-forest-labs/FLUX.1-schnell';
// FIXED: NEW ROUTER ADDRESS
const HF_URL = https://router.huggingface.co/hf-inference/models/${HF_MODEL};

app.get('/api/status', (req,res) => res.json({ ok: true, model: HF_MODEL, hasToken: !!HF_TOKEN }));

app.post('/api/generate', async (req,res) => {
  try{
    const prompt = req.body.prompt || 'cute cat astronaut';
    const r = await fetch(HF_URL, {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${HF_TOKEN}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ inputs: prompt, parameters:{ num_inference_steps:4 } })
    });
    if(!r.ok){ const t=await r.text(); return res.status(500).json({error:t}); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.json({ image: data:image/png;base64,${buf.toString('base64')} });
  }catch(e){ res.status(500).json({ error: e.message }); }
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;
if (require.main === module) {
  app.listen(process.env.PORT||3000, ()=>console.log('running'));
}
