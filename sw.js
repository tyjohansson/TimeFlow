// TimeFlow Service Worker — offline-first caching

const CACHE = 'timeflow-v4';

// Derive the base path from wherever the SW is installed
// Works on GitHub Pages (/TimeFlow/) and Vercel (/) alike
const BASE = self.location.pathname.replace(/sw\.js$/, '');

const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'app.css',
  BASE + 'app.js',
  BASE + 'manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});
