// validation.js - Security and validation

export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt is required' };
  }
  const trimmed = prompt.trim();
  if (trimmed.length < 2) return { valid: false, error: 'Prompt too short' };
  if (trimmed.length > 2000) return { valid: false, error: 'Prompt too long (max 2000 chars)' };
  // Basic XSS check
  const forbidden = ['<script', 'javascript:', 'onerror=', 'onload='];
  const lower = trimmed.toLowerCase();
  for (const f of forbidden) {
    if (lower.includes(f)) return { valid: false, error: 'Invalid characters in prompt' };
  }
  return { valid: true };
}

export function validateFile(file) {
  if (!file) return { valid: false, error: 'No file' };
  const allowed = ['image/png','image/jpeg','image/jpg','image/webp'];
  if (!allowed.includes(file.mimetype)) return { valid: false, error: 'Invalid file type. Use PNG, JPG, WEBP' };
  if (file.size > 10 * 1024 * 1024) return { valid: false, error: 'File too large (max 10MB)' };
  return { valid: true };
}
