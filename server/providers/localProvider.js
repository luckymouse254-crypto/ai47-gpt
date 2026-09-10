// LocalProvider - Honest free/open-source architecture
// Connects to a local ComfyUI server or compatible local inference server
// No fake images. If not configured, returns configured:false

export class LocalProvider {
  constructor({ comfyUrl }) {
    this.comfyUrl = comfyUrl || process.env.COMFYUI_URL || 'http://127.0.0.1:8188';
    this.name = 'local';
  }

  async checkStatus() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      // ComfyUI has /system_stats or /object_info
      const res = await fetch(`${this.comfyUrl}/system_stats`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return true;
      // fallback try root
      const res2 = await fetch(`${this.comfyUrl}/`, { signal: controller.signal });
      clearTimeout(timeout);
      return res2.ok;
    } catch (e) {
      // Also allow env override for demo if user explicitly sets LOCAL_MOCK=true for testing without ComfyUI
      if (process.env.LOCAL_MOCK === 'true') return true;
      return false;
    }
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

  async generateImage({ prompt, negativePrompt, style, aspectRatio, quality, steps, guidance, seed, numImages }) {
    // This is where you would call ComfyUI API
    // Example ComfyUI workflow submission would go here
    // For this open-source template, we provide the interface and honest status.
    // If ComfyUI is configured, we proxy to it. Otherwise this method should not be called (caller checks checkStatus first).

    // Attempt real ComfyUI generation if available
    try {
      // For demo, if COMFYUI_URL is reachable, we try to queue a prompt
      // Simplified placeholder workflow - user should customize with their own workflow JSON
      const workflow = this.buildComfyWorkflow({ prompt, negativePrompt, aspectRatio, steps, guidance, seed });
      
      const res = await fetch(`${this.comfyUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow })
      });
      if (!res.ok) throw new Error('ComfyUI queue failed');
      const data = await res.json();
      // In real implementation, poll /history/{prompt_id} for result
      // For now return queue info honestly
      return {
        success: true,
        provider: 'local',
        prompt,
        images: [], // Will be filled when ComfyUI returns images
        queueId: data.prompt_id,
        message: 'Queued to ComfyUI. Poll /history for results. Implement polling in production.',
        note: 'LocalProvider is connected. Implement image retrieval from ComfyUI output folder or history API.'
      };
    } catch (e) {
      // If LOCAL_MOCK is enabled for development without ComfyUI, return a placeholder that is clearly NOT a fake generated image
      if (process.env.LOCAL_MOCK === 'true') {
        return {
          success: false,
          provider: 'local',
          error: 'Mock mode: ComfyUI not connected. Install ComfyUI to generate real images.',
          prompt,
          images: []
        };
      }
      throw e;
    }
  }

  async editImage({ prompt, imagePath }) {
    const configured = await this.checkStatus();
    if (!configured) throw new Error('Local provider not configured');
    // ComfyUI img2img workflow would go here
    return {
      success: true,
      provider: 'local',
      prompt,
      message: 'Image editing via ComfyUI - implement img2img workflow',
      images: []
    };
  }

  async createVariation({ prompt, imagePath }) {
    const configured = await this.checkStatus();
    if (!configured) throw new Error('Local provider not configured');
    return {
      success: true,
      provider: 'local',
      prompt,
      message: 'Variation via ComfyUI - implement variation workflow',
      images: []
    };
  }

  buildComfyWorkflow({ prompt, negativePrompt, aspectRatio, steps, guidance, seed }) {
    const { width, height } = this.mapAspectRatio(aspectRatio);
    // Minimal ComfyUI workflow template - user can replace with their own
    // This is NOT a full workflow, just a structure for documentation
    return {
      "3": {
        "inputs": {
          "seed": seed || Math.floor(Math.random() * 1000000000),
          "steps": steps || 20,
          "cfg": guidance || 7,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": { "inputs": { "ckpt_name": "sd_xl_base_1.0.safetensors" }, "class_type": "CheckpointLoaderSimple" },
      "5": { "inputs": { "width": width, "height": height, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
      "6": { "inputs": { "text": prompt, "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
      "7": { "inputs": { "text": negativePrompt || "", "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
      "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
      "9": { "inputs": { "filename_prefix": "AI47_GPT", "images": ["8", 0] }, "class_type": "SaveImage" }
    };
  }
}
