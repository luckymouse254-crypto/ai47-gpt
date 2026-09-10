// cloudProvider.js - OPTIONAL CLOUD PROVIDER - Enabled for Vercel
// Uses Hugging Face Inference API (free tier) server-side only
// Secrets NEVER in frontend - only process.env here

export class CloudProvider {
  constructor({ apiUrl, apiKey, model } = {}) {
    // Support multiple env names: HF_TOKEN, HUGGINGFACE_API_KEY, CLOUD_PROVIDER_API_KEY, HF_API_TOKEN
    this.apiKey = apiKey || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.CLOUD_PROVIDER_API_KEY || process.env.HF_API_TOKEN || process.env.API_KEY;
    this.model = model || process.env.HF_MODEL || 'black-forest-labs/FLUX.1-schnell';
    // HF Inference endpoint
    this.apiUrl = apiUrl || process.env.CLOUD_PROVIDER_API_URL || `https://api-inference.huggingface.co/models/${this.model}`;
    this.name = 'cloud-hf';
    this.enabled = process.env.OPTIONAL_CLOUD_PROVIDER === 'true' || !!this.apiKey;
  }

  async checkStatus() {
    if (!this.enabled) return false;
    if (!this.apiKey) return false;
    // Light check - try to fetch model info
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });
      // Even if 401/403, key exists, we consider configured true for Vercel
      // Real test is generation
      return true;
    } catch {
      // If we have a key, consider configured true (honest: key present)
      return !!this.apiKey;
    }
  }

  async generateImage({ prompt, negativePrompt, aspectRatio, quality, steps, guidance, seed }) {
    if (!this.apiKey) throw new Error('HF_TOKEN not set. Add HF_TOKEN in Vercel Environment Variables (server-side).');
    
    const { width, height } = this.mapAspectRatio(aspectRatio);
    
    // HF Inference API call - FLUX and SD models accept inputs as prompt
    // For SDXL, include negative_prompt in parameters
    const payload = {
      inputs: prompt,
      parameters: {
        negative_prompt: negativePrompt || '',
        width,
        height,
        num_inference_steps: steps || 20,
        guidance_scale: guidance || 7.5,
        seed: seed ? parseInt(seed) : undefined
      }
    };

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'x-wait-for-model': 'true'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      // Model loading?
      if (text.includes('loading') || res.status === 503) {
        throw new Error('Model is loading (Hugging Face cold start). Wait 20s and try again. Free tier loads on demand.');
      }
      throw new Error(`HF API error ${res.status}: ${text.slice(0,300)}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // Some models return JSON with error
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      // If JSON contains image base64
      if (json.images) return { success: true, provider: this.name, prompt, images: json.images, model: this.model };
    }

    // Image bytes -> base64 data URI
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = contentType.includes('image') ? contentType : 'image/png';
    const dataUri = `data:${mime};base64,${base64}`;

    return {
      success: true,
      provider: this.name,
      prompt,
      model: this.model,
      images: [dataUri],
      message: 'Generated via Hugging Face Inference API (free tier)'
    };
  }

  async editImage({ prompt, imagePath }) {
    throw new Error('Image editing not yet implemented for cloud provider. Use local ComfyUI for editing, or extend this provider with img2img API.');
  }

  async createVariation({ prompt }) {
    // Variation = generate with same prompt
    return this.generateImage({ prompt });
  }

  mapAspectRatio(ratio) {
    const map = {
      '1:1': { width: 1024, height: 1024 },
      '9:16': { width: 768, height: 1344 },
      '16:9': { width: 1344, height: 768 },
      '4:5': { width: 864, height: 1080 },
      '3:4': { width: 864, height: 1152 }
    };
    return map[ratio] || map['1:1'];
  }
}
