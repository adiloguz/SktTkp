const CACHE_NAME = 'skt-takip-pwa-cache-v1.2'; // Önbellek sürümünü güncelledikçe değiştirin
const urlsToCache = [
    '/', // Ana dizin
    'index.html', // Ana HTML dosyası
    'manifest.json', // Manifest dosyası
    // İkonları ekleyin (manifest.json'daki yollarla eşleşmeli)
    'images/icon-72x72.png',
    'images/icon-96x96.png',
    'images/icon-128x128.png',
    'images/icon-144x144.png',
    'images/icon-152x152.png',
    'images/icon-192x192.png',
    'images/icon-384x384.png',
    'images/icon-512x512.png',
     // QuaggaJS CDN'i (isteğe bağlı, çevrimdışı barkod okuma için gerekebilir ama CDN adresleri değişebilir)
     // 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js'
     // Not: CDN kaynaklarını cachelemek riskli olabilir. Ağ bağlantısı varken CDN'den çekmek genellikle daha iyidir.
];

// Service Worker'ı Yükleme (Install) Olayı
self.addEventListener('install', event => {
    console.log('Service Worker: Yükleniyor...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Önbellek açıldı, dosyalar ekleniyor.');
                // Önemli dosyaları önbelleğe ekle
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Tüm dosyalar başarıyla önbelleğe alındı.');
                // Yeni SW'nin hemen etkinleşmesini sağla (isteğe bağlı ama genellikle iyi bir fikir)
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Önbelleğe alma sırasında hata:', error);
            })
    );
});

// Service Worker'ı Etkinleştirme (Activate) Olayı
// Genellikle eski önbellekleri temizlemek için kullanılır
self.addEventListener('activate', event => {
    console.log('Service Worker: Etkinleştiriliyor...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Eğer mevcut önbellek adı, tanımladığımız CACHE_NAME değilse, onu sil
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Eski önbellek siliniyor:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Etkinleştirildi ve eski önbellekler temizlendi.');
            // Yeni SW'nin sayfaları hemen kontrol etmesini sağla
            return self.clients.claim();
        })
    );
});

// Fetch (Ağ İsteklerini Yakalama) Olayı
// Önbellek öncelikli strateji (Cache First, then Network)
self.addEventListener('fetch', event => {
    // Sadece GET isteklerini cache'le
    if (event.request.method !== 'GET') {
        return;
    }

    // Chrome eklenti isteklerini veya non-http(s) istekleri atla
     if (!(event.request.url.startsWith('http'))) {
        return;
    }

    // QuaggaJS CDN isteğini doğrudan ağdan al (cache'lemesi riskli olabilir)
    if (event.request.url.includes('cdnjs.cloudflare.com')) {
         // Ağdan almayı dene, başarısız olursa normal devam et (cache'den deneyebilir)
         event.respondWith(
             fetch(event.request).catch(() => caches.match(event.request))
         );
        return;
     }


    event.respondWith(
        caches.match(event.request) // Önce önbellekte ara
            .then(cachedResponse => {
                if (cachedResponse) {
                    // console.log('Service Worker: Kaynak önbellekten bulundu:', event.request.url);
                    return cachedResponse; // Önbellekte varsa onu döndür
                }

                // Önbellekte yoksa, ağdan istemeyi dene
                // console.log('Service Worker: Kaynak ağdan isteniyor:', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Ağdan cevap geldiyse...
                        // Cevabı klonla çünkü hem cache'e hem browser'a gidecek (response tek kullanımlıktır)
                        const responseToCache = networkResponse.clone();

                        // Yeni kaynağı dinamik olarak önbelleğe ekle (isteğe bağlı ama kullanışlı)
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('Service Worker: Yeni kaynak önbelleğe ekleniyor:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse; // Orijinal cevabı tarayıcıya döndür
                    }
                ).catch(error => {
                    // Ağ hatası veya kaynak bulunamadı durumu
                    console.warn('Service Worker: Ağ isteği başarısız oldu:', error);
                    // Burada çevrimdışı bir sayfa veya varsayılan bir cevap döndürebilirsiniz (isteğe bağlı)
                    // Örneğin: return caches.match('/offline.html');
                });
            })
    );
});