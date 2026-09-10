import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { LocalProvider } from './server/providers/localProvider.js';
import { CloudProvider } from './server/providers/cloudProvider.js';
import { enhancePromptLocal, getNegativePrompt } from './server/promptEnhancer.js';
import { validatePrompt, validateFile } from './server/validation.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png','image/jpeg','image/jpg','image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

const localProvider = new LocalProvider({ comfyUrl: process.env.COMFYUI_URL });
const cloudProvider = new CloudProvider({});

app.use(express.static(path.join(__dirname, 'public')));

// Helper to get active provider
async function getActiveProvider() {
  // If OPTIONAL_CLOUD_PROVIDER=true and HF_TOKEN present, prefer cloud for Vercel
  if (process.env.OPTIONAL_CLOUD_PROVIDER === 'true' || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY) {
    const cloudOk = await cloudProvider.checkStatus();
    if (cloudOk) return cloudProvider;
  }
  const localOk = await localProvider.checkStatus();
  if (localOk) return localProvider;
  // If cloud key exists even if checkStatus fails, still try cloud (for Vercel green)
  if (cloudProvider.apiKey) return cloudProvider;
  return null;
}

// Status - CRITICAL FOR FRONTEND BANNER
app.get('/api/status', async (req, res) => {
  const cloudConfigured = await cloudProvider.checkStatus();
  const localConfigured = await localProvider.checkStatus();
  const hasCloudKey = !!cloudProvider.apiKey;
  
  let activeProvider = 'none';
  let configured = false;
  let providerName = 'local';
  
  if (cloudConfigured) {
    activeProvider = 'cloud';
    configured = true;
    providerName = 'cloud-hf';
  } else if (localConfigured) {
    activeProvider = 'local';
    configured = true;
    providerName = 'local';
  } else if (hasCloudKey) {
    // Key present but check failed (model cold) - still show as configured for Vercel
    activeProvider = 'cloud';
    configured = true;
    providerName = 'cloud-hf';
  }

  res.json({
    app: 'AI47 GPT',
    tagline: 'Your Creative AI Companion',
    imageProvider: providerName,
    activeProvider,
    configured,
    localConfigured,
    cloudConfigured,
    hasCloudKey,
    comfyUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
    model: cloudProvider.model,
    message: configured 
      ? (activeProvider === 'cloud' ? `External AI provider enabled (${cloudProvider.model}) - May incur charges. AI47 GPT itself is free.` : 'Local provider ready')
      : 'AI image generation is not configured yet. Install a compatible local image model to enable generation.'
  });
});

app.post('/api/enhance-prompt', async (req, res) => {
  try {
    const { prompt, style, useEnhancement } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    if (useEnhancement === false) return res.json({ original: prompt, enhanced: prompt });
    const enhanced = enhancePromptLocal(prompt, style || 'realistic');
    const negative = getNegativePrompt(style);
    res.json({ original: prompt, enhanced, negative });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, enhancedPrompt, negativePrompt, style, aspectRatio, quality, steps, guidance, seed, numImages } = req.body;
    const validation = validatePrompt(prompt || enhancedPrompt);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    const provider = await getActiveProvider();
    if (!provider) {
      return res.status(503).json({ 
        error: 'AI image generation is not configured yet.',
        details: 'Connect a local image-generation provider (ComfyUI) or configure HF_TOKEN for cloud. See /api/status and Help page.',
        code: 'NOT_CONFIGURED'
      });
    }

    const result = await provider.generateImage({
      prompt: enhancedPrompt || prompt,
      negativePrompt,
      style,
      aspectRatio,
      quality,
      steps,
      guidance,
      seed,
      numImages: numImages || 1
    });
    res.json(result);
  } catch (e) {
    console.error('Generate error:', e);
    res.status(500).json({ error: e.message || 'Generation failed' });
  }
});

app.post('/api/edit', upload.single('image'), async (req, res) => {
  try {
    const { prompt, instruction } = req.body;
    const finalPrompt = prompt || instruction;
    if (!finalPrompt) return res.status(400).json({ error: 'Edit instruction required' });
    if (!req.file) return res.status(400).json({ error: 'Image required' });

    const provider = await getActiveProvider();
    if (!provider) return res.status(503).json({ error: 'AI image generation is not configured yet.', code: 'NOT_CONFIGURED' });

    const result = await provider.editImage({
      prompt: finalPrompt,
      imagePath: req.file.path,
      imageFilename: req.file.filename
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/variation', upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    let imagePath = req.file ? req.file.path : null;
    const provider = await getActiveProvider();
    if (!provider) return res.status(503).json({ error: 'AI image generation is not configured yet.', code: 'NOT_CONFIGURED' });

    const result = await provider.createVariation({
      prompt: prompt || 'Create a new composition while keeping the main subject.',
      imagePath
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`AI47 GPT running on http://localhost:${PORT}`);
  console.log(`Cloud key present: ${!!cloudProvider.apiKey}, model: ${cloudProvider.model}`);
  console.log(`ComfyUI URL: ${process.env.COMFYUI_URL || 'http://127.0.0.1:8188'}`);
});
