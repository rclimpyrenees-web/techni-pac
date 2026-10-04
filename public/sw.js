const CACHE_NAME = "techni-pac-cache-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie simple : réseau d'abord, secours sur le cache si hors-ligne.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// --- Notifications ------------------------------------------------------------
// Le message arrive chiffré ; le navigateur le déchiffre et le remet ici.
self.addEventListener("push", (event) => {
  let notif = {};
  try { notif = event.data ? event.data.json() : {}; } catch (_e) { notif = { corps: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(notif.titre || "TECHNI-PAC", {
      body: notif.corps || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: notif.tag || undefined,
      data: { onglet: notif.onglet || "" },
    })
  );
});

// Un appui sur la notification ouvre l'application (ou la ramène au premier
// plan) sur le bon onglet.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const onglet = event.notification.data && event.notification.data.onglet;
  const adresse = "/" + (onglet ? "?onglet=" + encodeURIComponent(onglet) : "");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) {
          if (onglet && "navigate" in f) return f.navigate(adresse).then((x) => (x || f).focus()).catch(() => f.focus());
          return f.focus();
        }
      }
      return self.clients.openWindow(adresse);
    })
  );
});
