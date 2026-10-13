// Cache the public app shell only. Personal API responses are never cached.
const CACHE='lifeweave-shell-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/apps/web/app.css','/apps/web/icon.svg','/packages/ui/src/styles.css']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method==='GET'&&url.origin===self.location.origin&&['/apps/web/app.css','/apps/web/icon.svg','/packages/ui/src/styles.css'].includes(url.pathname))event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));});
