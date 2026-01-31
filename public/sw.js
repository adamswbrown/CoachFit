/**
 * CoachFit Service Worker
 * Enables offline functionality and caching for PWA
 */

const CACHE_NAME = 'coachfit-v1'
const STATIC_CACHE = 'coachfit-static-v1'
const DYNAMIC_CACHE = 'coachfit-dynamic-v1'
const OFFLINE_QUEUE_KEY = 'coachfit-offline-queue'

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/client-dashboard',
  '/coach-dashboard',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png',
]

// API routes that should be cached
const CACHEABLE_API_ROUTES = [
  '/api/entries',
  '/api/client/entries',
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
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
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

  // Skip non-GET requests except for entry submissions
  if (request.method !== 'GET') {
    // Handle offline entry submissions
    if (request.method === 'POST' && url.pathname === '/api/entries') {
      event.respondWith(handleOfflineEntrySubmission(request))
      return
    }
    return
  }

  // Skip external requests
  if (url.origin !== self.location.origin) {
    return
  }

  // Skip auth-related requests (always need network)
  if (url.pathname.startsWith('/api/auth')) {
    return
  }

  // For API requests - network first, then cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // For navigation requests - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
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

// Network-first strategy (for API requests)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Network first falling back to cache')
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle navigation requests
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request)
    return networkResponse
  } catch (error) {
    console.log('[SW] Navigation offline, trying cache')

    // Try to get the cached page
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    // Try to return cached dashboard as fallback
    const dashboardResponse = await caches.match('/dashboard')
    if (dashboardResponse) {
      return dashboardResponse
    }

    // Return offline page
    return new Response(getOfflinePage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// Handle offline entry submissions
async function handleOfflineEntrySubmission(request) {
  try {
    // Try network first
    const response = await fetch(request.clone())
    return response
  } catch (error) {
    console.log('[SW] Offline - queueing entry for later')

    // Queue the entry for later
    const body = await request.clone().json()
    await queueOfflineEntry(body)

    return new Response(JSON.stringify({
      success: true,
      offline: true,
      message: 'Entry saved offline. Will sync when back online.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Queue entry for offline sync
async function queueOfflineEntry(entry) {
  const queue = await getOfflineQueue()
  queue.push({
    ...entry,
    queuedAt: new Date().toISOString()
  })
  await saveOfflineQueue(queue)
}

// Get offline queue from IndexedDB
async function getOfflineQueue() {
  return new Promise((resolve) => {
    const request = indexedDB.open('coachfit-offline', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction('queue', 'readonly')
      const store = transaction.objectStore('queue')
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
    const request = indexedDB.open('coachfit-offline', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
      }
    }

    request.onsuccess = (event) => {
      const db = event.target.result
      const transaction = db.transaction('queue', 'readwrite')
      const store = transaction.objectStore('queue')

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

// Listen for online event to sync queued entries
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'SYNC_OFFLINE_ENTRIES') {
    console.log('[SW] Syncing offline entries...')
    const queue = await getOfflineQueue()

    const results = []
    for (const entry of queue) {
      try {
        const response = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
          credentials: 'include'
        })

        if (response.ok) {
          results.push({ success: true, entry })
        } else {
          results.push({ success: false, entry, error: 'Server error' })
        }
      } catch (error) {
        results.push({ success: false, entry, error: error.message })
      }
    }

    // Clear successfully synced entries
    const failedEntries = results.filter(r => !r.success).map(r => r.entry)
    await saveOfflineQueue(failedEntries)

    // Notify clients
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_SYNC_COMPLETE',
        synced: results.filter(r => r.success).length,
        failed: failedEntries.length
      })
    })
  }
})

// Offline HTML page
function getOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
          padding: 20px;
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
        }
        button {
          background: #1E3A8A;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover {
          background: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <svg class="icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="256" cy="256" r="220" stroke="#1E3A8A" stroke-width="28"/>
          <path d="M180 300 L256 140 L332 300" stroke="#1E3A8A" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h1>You're Offline</h1>
        <p>Check your internet connection and try again. Any entries you've made will sync when you're back online.</p>
        <button onclick="window.location.reload()">Try Again</button>
      </div>
    </body>
    </html>
  `
}
