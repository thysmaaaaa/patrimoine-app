/**
 * Service Worker minimal — met en cache les fichiers statiques
 * pour permettre une ouverture de l'app même hors-ligne.
 * Les données (Firestore) et les cours (API) nécessitent une
 * connexion ; seule la "coquille" de l'app fonctionne offline.
 */

const CACHE_NAME = "patrimoine-cache-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./firebase-service.js",
  "./market-api.js",
  "./finance-utils.js",
  "./chart.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels vers Firebase ou les API de marché :
  // on les laisse toujours passer au réseau pour des données à jour.
  const isExternalApi =
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("finnhub") ||
    url.hostname.includes("coingecko") ||
    url.hostname.includes("exchangerate");

  if (isExternalApi) {
    return; // laisse le navigateur gérer normalement (réseau)
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Met en cache les nouvelles ressources statiques récupérées
          if (event.request.method === "GET" && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});
