// promptEnhancer.js - Local/template-based enhancement WITHOUT paid API
// Works offline, no API key required. Preserves user intent.

const lightingMap = {
  realistic: 'natural lighting, detailed, photorealistic, high detail',
  cinematic: 'cinematic lighting, dramatic composition, volumetric light, depth of field',
  anime: 'anime style, vibrant colors, clean lines, detailed shading',
  fantasy: 'fantasy art, ethereal lighting, magical atmosphere',
  cyberpunk: 'cyberpunk, neon lights, futuristic city glow, high contrast',
  '3d': '3D render, octane render, studio lighting, highly detailed',
  'digital art': 'digital painting, brush strokes, artistic, detailed',
  watercolor: 'watercolor painting, soft washes, artistic texture',
  'oil painting': 'oil painting, thick brushstrokes, classical art style',
  minimalist: 'minimalist, clean composition, simple, elegant',
  portrait: 'portrait photography, soft lighting, shallow depth of field, professional',
  'product photography': 'product photography, studio lighting, white background, professional',
  comic: 'comic book style, bold outlines, vibrant colors, dynamic',
  futuristic: 'futuristic, studio photography, sharp focus, high-tech, sleek',
  'studio photography': 'studio photography, softbox lighting, professional, sharp'
};

const qualitySuffix = {
  Standard: 'high quality, detailed',
  High: 'ultra high quality, highly detailed, sharp focus, 8k, photorealistic, masterpiece'
};

export function enhancePromptLocal(prompt, style = 'realistic') {
  if (!prompt) return '';
  const trimmed = prompt.trim();
  if (trimmed.length < 3) return trimmed;

  // Don't over-enhance already long prompts
  if (trimmed.length > 180) return trimmed;

  const base = trimmed.replace(/[.,;!?]+$/, '');
  const lighting = lightingMap[style] || lightingMap.realistic;
  
  // Template-based enhancement: subject + environment + lighting + composition + quality
  // Preserve intent - only add supportive descriptors
  const templates = [
    `${base}, ${lighting}, atmospheric depth, detailed textures, professional composition`,
    `A detailed view of ${base}, ${lighting}, intricate details, cinematic depth`,
    `${base}, ${lighting}, highly detailed, sharp focus, professional photography`
  ];
  
  // Simple deterministic choice based on prompt length
  const idx = base.length % templates.length;
  return templates[idx];
}

export function getNegativePrompt(style) {
  const baseNegative = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, logo, cropped';
  const styleNegatives = {
    realistic: 'cartoon, anime, illustration, painting, drawing, unrealistic',
    anime: 'photorealistic, 3D, realistic, blurry, distorted',
    portrait: 'full body, landscape, blurry, deformed',
    'product photography': 'cluttered background, people, animals'
  };
  return `${baseNegative}, ${styleNegatives[style] || ''}`.replace(/, ,/g, ',').trim();
}

// Optional: enhancePromptWithLocalLLM could be added later using a local LLM server
