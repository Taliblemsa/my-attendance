// กำหนดชื่อเวอร์ชันของ Cache (หากมีการแก้โค้ด HTML ให้เปลี่ยนเวอร์ชันนี้เพื่อล้างแคชเก่า)
const CACHE_NAME = 'st-attendance-offline-v1.1';

// รายชื่อทรัพยากรหลักที่ต้องการให้โหลดเก็บไว้ (อัปเดตให้รองรับ GitHub Pages)
const PRECACHE_ASSETS = [
    './', 
    './index.html',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Pre-caching offline assets...');
            return cache.addAll(PRECACHE_ASSETS).catch(err => {
                console.warn('[ServiceWorker] Pre-cache warning:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // กลยุทธ์ 1: Network First, Fallback to Cache (สำหรับ API Google Sheets)
    if (requestUrl.hostname === 'sheets.googleapis.com') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return networkResponse;
                })
                .catch(() => {
                    console.log('[ServiceWorker] Offline mode: Serving API from cache');
                    return caches.match(event.request);
                })
        );
        return;
    }

    // กลยุทธ์ 2: Stale-While-Revalidate (สำหรับไฟล์ UI อื่นๆ)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clonedResponse = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clonedResponse);
                        });
                    }
                    return networkResponse;
                })
                .catch((error) => {
                    console.warn('[ServiceWorker] Network fetch failed, relying completely on cache.', error);
                });
            return cachedResponse || fetchPromise;
        })
    );
});
