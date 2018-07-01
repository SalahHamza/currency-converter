const staticCacheName  = 'convter--static-v1';
const dynamicCacheName = 'convter--dynamic-v1';
const allCaches = [
	staticCacheName,
	dynamicCacheName
];

self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open(staticCacheName).then( (cache) => {
			return cache.addAll([
				'./',
				'./index.html',
				'./assets/scripts/app.js',
				'./assets/styles/style.css',
				'./assets/styles/imgs/caret-down.png',
				'./assets/images/money.png',
				'./assets/icons/icons.css',
				'./assets/icons/fonts/icons.eot',
				'./assets/icons/fonts/icons.svg',
				'./assets/icons/fonts/icons.ttf',
				'./assets/icons/fonts/icons.woff',
				'./vendors/scripts/idb.min.js',
				'https://free.currencyconverterapi.com/api/v5/currencies?'
			]);
		})
	);
});



self.addEventListener('activate', function(e) {
	console.log('[ServiceWorker] Activate');
	e.waitUntil(
		caches.keys().then( (keyList) => {
			return Promise.all(
				keyList.filter( (key) => {
					return key.startsWith('convter--') && 
						!allCaches.includes(key);
				})
				.map( (key) => {
					console.log('[ServiceWorker] Removing old cache', key);
					return caches.delete(key);
				})
			);
		})
	);
	return self.clients.claim();
});


self.addEventListener('fetch', function(e) {
  var dataUrl = 'https://free.currencyconverterapi.com/api/v5/convert?';
  if (e.request.url.includes(dataUrl)) {
    e.respondWith(
			fetch(e.request).then( (res) => {
				console.log('Fetching from Network');
				const resClone = res.clone();
				caches.open(dynamicCacheName).then( (cache) => {
					cache.put(e.request, resClone);
				});
				return res;
			}).catch(function() {
				console.log('Fetching from Cache');
				return caches.match(e.request);
			})
    );
  } else {
    e.respondWith(
      caches.match(e.request).then( (response) => {
        return response || fetch(e.request);
      })
    );
  }
});


