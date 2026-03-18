/**
 * CoachFit Service Worker
 * Enables offline functionality and caching for PWA
 * Supports both Coach and Client personas
 */

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `coachfit-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `coachfit-dynamic-${CACHE_VERSION}`
const API_CACHE = `coachfit-api-${CACHE_VERSION}`

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

// Pages to cache for each persona (cached on first visit)
const CLIENT_PAGES = [
  '/client-dashboard',
  '/client-dashboard/settings',
  '/client-dashboard/pairing',
]

const COACH_PAGES = [
  '/coach-dashboard',
  '/coach-dashboard/weekly-review',
  '/coach-dashboard/healthkit-data',
  '/coach-dashboard/questionnaire-analytics',
  '/coach-dashboard/pairing',
]

// API routes that benefit from caching (stale-while-revalidate)
const CACHEABLE_API_ROUTES = [
  '/api/entries',
  '/api/client/entries',
  '/api/client/cohorts',
  '/api/coach-dashboard/overview',
  '/api/coach-dashboard/weekly-summaries',
  '/api/cohorts',
]

// API routes that support offline queuing
const OFFLINE_QUEUE_ROUTES = [
  { method: 'POST', path: '/api/entries' },
  { method: 'POST', path: '/api/coach/notes' },
  { method: 'PUT', path: '/api/clients/' }, // Coach notes on client
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { credentials: 'same-origin' })
        })).catch(err => {
          console.log('[SW] Some static assets failed to cache:', err)
        })
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old version caches
            return name.startsWith('coachfit-') &&
              !name.includes(CACHE_VERSION)
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return
  }

  // Skip auth-related requests (always need network)
  if (url.pathname.startsWith('/api/auth')) {
    return
  }

  // Handle non-GET requests (offline queue)
  if (request.method !== 'GET') {
    const offlineRoute = OFFLINE_QUEUE_ROUTES.find(
      r => r.method === request.method && url.pathname.startsWith(r.path)
    )
    if (offlineRoute) {
      event.respondWith(handleOfflineQueueableRequest(request, url.pathname))
      return
    }
    return
  }

  // For API requests - stale-while-revalidate for cacheable routes
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API_ROUTES.some(route =>
      url.pathname.startsWith(route)
    )
    if (isCacheable) {
      event.respondWith(staleWhileRevalidate(request))
    } else {
      event.respondWith(networkFirst(request))
    }
    return
  }

  // For navigation requests - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url.pathname))
    return
  }

  // For static assets - cache first
  event.respondWith(cacheFirst(request))
})

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Cache first failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Network-first strategy (for non-cacheable API requests)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Network first falling back to cache')
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      // Add header to indicate cached response
      const headers = new Headers(cachedResponse.headers)
      headers.set('X-SW-Cache', 'true')
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      })
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Stale-while-revalidate (for cacheable API routes)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE)
  const cachedResponse = await cache.match(request)

  // Start network request in background
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(() => null)

  // Return cached response immediately if available
  if (cachedResponse) {
    // Add header to indicate stale response
    const headers = new Headers(cachedResponse.headers)
    headers.set('X-SW-Cache', 'stale')

    // Wait for network in background (don't block)
    fetchPromise.then(() => {
      // Could notify clients of updated data here
    })

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers
    })
  }

  // No cache, wait for network
  const networkResponse = await fetchPromise
  if (networkResponse) {
    return networkResponse
  }

  return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Handle navigation requests with persona-aware caching
async function handleNavigation(request, pathname) {
  try {
    const networkResponse = await fetch(request)

    // Cache the page for offline access
    if (networkResponse.ok) {
      const isClientPage = CLIENT_PAGES.some(p => pathname.startsWith(p))
      const isCoachPage = COACH_PAGES.some(p => pathname.startsWith(p))

      if (isClientPage || isCoachPage) {
        const cache = await caches.open(DYNAMIC_CACHE)
        cache.put(request, networkResponse.clone())
      }
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Navigation offline, trying cache for:', pathname)

    // Try to get the cached page
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Try role-specific fallbacks
    const isCoachPath = pathname.startsWith('/coach')
    const isClientPath = pathname.startsWith('/client')

    if (isCoachPath) {
      const coachFallback = await caches.match('/coach-dashboard')
      if (coachFallback) return coachFallback
    }

    if (isClientPath) {
      const clientFallback = await caches.match('/client-dashboard')
      if (clientFallback) return clientFallback
    }

    // Generic dashboard fallback
    const dashboardResponse = await caches.match('/dashboard')
    if (dashboardResponse) {
      return dashboardResponse
    }

    // Return offline page
    return new Response(getOfflinePage(isCoachPath ? 'coach' : 'client'), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// Handle requests that can be queued offline
async function handleOfflineQueueableRequest(request, pathname) {
  try {
    // Try network first
    const response = await fetch(request.clone())
    return response
  } catch (error) {
    console.log('[SW] Offline - queueing request for later:', pathname)

    // Queue the request for later
    const body = await request.clone().json()
    await queueOfflineAction({
      method: request.method,
      path: pathname,
      body,
      queuedAt: new Date().toISOString()
    })

    // Determine response message based on action type
    let message = 'Action saved offline. Will sync when back online.'
    if (pathname.includes('/entries')) {
      message = 'Entry saved offline. Will sync when back online.'
    } else if (pathname.includes('/notes') || pathname.includes('/clients/')) {
      message = 'Notes saved offline. Will sync when back online.'
    }

    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Queue action for offline sync
async function queueOfflineAction(action) {
  const queue = await getOfflineQueue()
  queue.push(action)
  await saveOfflineQueue(queue)
}

// Get offline queue from IndexedDB
async function getOfflineQueue() {
  return new Promise((resolve) => {
    const request = indexedDB.open('coachfit-offline', 2)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = (event) => {
      const db = event.target.result

      // Check if actions store exists (new schema)
      const storeName = db.objectStoreNames.contains('actions') ? 'actions' : 'queue'

      const transaction = db.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = () => {
        resolve(getAllRequest.result || [])
      }

      getAllRequest.onerror = () => {
        resolve([])
      }
    }

    request.onerror = () => {
      resolve([])
    }
  })
}

// Save offline queue to IndexedDB
async function saveOfflineQueue(queue) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coachfit-offline', 2)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = (event) => {
      const db = event.target.result
      const storeName = db.objectStoreNames.contains('actions') ? 'actions' : 'queue'
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)

      // Clear existing queue
      store.clear()

      // Add all items
      queue.forEach(item => {
        store.add(item)
      })

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    }

    request.onerror = () => reject(request.error)
  })
}

// Listen for messages from clients
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SYNC_OFFLINE_ACTIONS') {
    console.log('[SW] Syncing offline actions...')
    await syncOfflineActions()
  }

  // Legacy support for entry sync
  if (event.data && event.data.type === 'SYNC_OFFLINE_ENTRIES') {
    console.log('[SW] Syncing offline entries...')
    await syncOfflineActions()
  }
})

// Sync all offline actions
async function syncOfflineActions() {
  const queue = await getOfflineQueue()

  if (queue.length === 0) {
    console.log('[SW] No offline actions to sync')
    return
  }

  const results = []

  for (const action of queue) {
    try {
      const response = await fetch(action.path, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
        credentials: 'include'
      })

      if (response.ok) {
        results.push({ success: true, action })
      } else {
        results.push({ success: false, action, error: 'Server error' })
      }
    } catch (error) {
      results.push({ success: false, action, error: error.message })
    }
  }

  // Clear successfully synced actions
  const failedActions = results.filter(r => !r.success).map(r => r.action)
  await saveOfflineQueue(failedActions)

  // Notify clients
  const clients = await self.clients.matchAll()
  clients.forEach(client => {
    client.postMessage({
      type: 'OFFLINE_SYNC_COMPLETE',
      synced: results.filter(r => r.success).length,
      failed: failedActions.length,
      details: results.map(r => ({
        path: r.action.path,
        success: r.success,
        error: r.error
      }))
    })
  })
}

// Offline HTML page with persona-specific messaging
function getOfflinePage(persona = 'client') {
  const isCoach = persona === 'coach'

  const title = isCoach
    ? "You're Offline"
    : "You're Offline"

  const message = isCoach
    ? "Check your internet connection and try again. Client data will refresh when you're back online."
    : "Check your internet connection and try again. Any entries you've made will sync when you're back online."

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
      <meta name="theme-color" content="#1E3A8A">
      <title>CoachFit - Offline</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          min-height: 100dvh;
          padding: 20px;
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
          background: #f8fafc;
          color: #1e293b;
        }
        .container {
          text-align: center;
          max-width: 400px;
        }
        .icon {
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 12px;
          color: #1E3A8A;
        }
        p {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #fef3c7;
          border-radius: 20px;
          font-size: 14px;
          color: #92400e;
          margin-bottom: 24px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        button {
          background: #1E3A8A;
          color: white;
          border: none;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          min-height: 44px;
        }
        button:hover {
          background: #1e40af;
        }
        button:active {
          background: #1e3a8a;
          transform: scale(0.98);
        }
        .secondary-action {
          margin-top: 16px;
        }
        .secondary-action a {
          color: #64748b;
          text-decoration: none;
          font-size: 14px;
        }
        .secondary-action a:hover {
          color: #1E3A8A;
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <svg class="icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="220" stroke="#1E3A8A" stroke-width="28"/>
          <path d="M180 300 L256 140 L332 300" stroke="#1E3A8A" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="status">
          <span class="status-dot"></span>
          <span>No internet connection</span>
        </div>
        <h1>${title}</h1>
        <p>${message}</p>
        <button onclick="window.location.reload()">Try Again</button>
        <div class="secondary-action">
          <a href="/dashboard">Go to Dashboard</a>
        </div>
      </div>
      <script>
        // Auto-retry when connection is restored
        window.addEventListener('online', () => {
          window.location.reload();
        });
      </script>
    </body>
    </html>
  `
}
