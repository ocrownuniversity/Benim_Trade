// BENIM Warehouse Service Worker v1.0
var CACHE_NAME = "benim-warehouse-v1";
var OFFLINE_URL = "/Benim_Trade/";

var urlsToCache = [
  "/Benim_Trade/",
  "/Benim_Trade/index.html",
  "/Benim_Trade/manifest.json",
  "/Benim_Trade/icon-192.png",
  "/Benim_Trade/icon-512.png"
];

// Install - cache files
self.addEventListener("install", function(event){
  console.log("BENIM SW: Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      console.log("BENIM SW: Caching files");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", function(event){
  console.log("BENIM SW: Activating...");
  event.waitUntil(
    caches.keys().then(function(cacheNames){
      return Promise.all(
        cacheNames.filter(function(name){
          return name !== CACHE_NAME;
        }).map(function(name){
          console.log("BENIM SW: Deleting old cache", name);
          return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - serve from cache, fallback to network
self.addEventListener("fetch", function(event){
  event.respondWith(
    caches.match(event.request).then(function(response){
      if(response){
        return response;
      }
      return fetch(event.request).then(function(networkResponse){
        // Cache new requests dynamically
        if(networkResponse && networkResponse.status === 200 && event.request.method === "GET"){
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    }).catch(function(){
      // Offline fallback
      return caches.match(OFFLINE_URL);
    })
  );
});

// Push notifications (future use)
self.addEventListener("push", function(event){
  var options = {
    body: event.data ? event.data.text() : "New update from BENIM Warehouse!",
    icon: "/Benim_Trade/icon-192.png",
    badge: "/Benim_Trade/icon-192.png",
    vibrate: [100, 50, 100],
    data: {url: "/Benim_Trade/"}
  };
  event.waitUntil(
    self.registration.showNotification("BENIM Warehouse", options)
  );
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
