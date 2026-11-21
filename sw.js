/**
 * 幸运转盘 · Service Worker（离线缓存）
 * 策略：
 *   - 页面（导航请求）：网络优先，失败回退缓存 → 打开就是最新版，断网也能用
 *   - 静态资源（图标等）：缓存优先 + 后台更新
 * 首次访问后，所有资源缓存在本机，断网也能完整使用。
 */
'use strict';

const CACHE_NAME = 'wheel-cache-v23';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isDoc = event.request.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html');

  if (isDoc) {
    // 页面：网络优先 → 保证一打开就是最新版；断网时回退到缓存
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(event.request);
        if (fresh && fresh.ok) cache.put(event.request, fresh.clone());
        return fresh;
      } catch (e) {
        return (await cache.match(event.request))
          || (await cache.match('./index.html'))
          || (await cache.match('./'))
          || Response.error();
      }
    })());
    return;
  }

  // 静态资源：缓存优先 + 后台静默更新
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    const network = fetch(event.request)
      .then((response) => {
        if (response && response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached || network;
  })());
});
