// sw.js - PWA Service Worker
// IMPORTANT: The interface can be installed as an app, but image generation requires a configured local model or AI provider.
const CACHE_NAME = 'ai47-gpt-v1';
const urlsToCache = ['/', '/index.html', '/style.css', '/app.js', '/assets/ai47-logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
