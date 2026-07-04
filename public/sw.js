// Service worker mínimo do Doca Livre.
// Objetivo principal: tornar o app instalável (PWA) no Chrome/Android.
// Estratégia: network-first para navegação (HTML), sem cachear dados do Supabase.

const CACHE = 'ultrafrio-shell-v4'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Nunca interceptar chamadas externas (Supabase, APIs). Só o próprio domínio.
  if (url.origin !== self.location.origin) return

  // Navegação (HTML): rede primeiro, cai para o cache do shell se offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Demais assets do próprio domínio: cache primeiro, atualizando em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined)
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
