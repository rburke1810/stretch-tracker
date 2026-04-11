// StretchTracker — Entry Point & Router

// ===== Navigation =====
// Simple string-based router. Views are rendered by ui.js renderers.

function navigate(view, params) {
  // Clean up session if leaving
  if (view !== 'session') {
    cleanupSessionListeners()
    stopSession()
  }
  switch (view) {
    case 'home':       renderHome();            break
    case 'session':    renderSession(params);   break
    case 'completion': renderCompletion(params); break
    case 'settings':   renderSettings();        break
    default:           renderHome();
  }
}

// ===== Service Worker Registration =====
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(reg => {
      // Listen for messages from the SW (e.g., notification click → start session)
      navigator.serviceWorker.addEventListener('message', event => {
        const { type, category } = event.data || {}
        if (type === 'START_SESSION' && category) {
          navigate('session', { category })
        }
      })
    })
    .catch(err => console.warn('SW registration failed:', err))
}

// ===== Wake Lock =====
let _wakeLock = null

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    _wakeLock = await navigator.wakeLock.request('screen')
  } catch {}
}

async function releaseWakeLock() {
  if (_wakeLock) {
    try { await _wakeLock.release() } catch {}
    _wakeLock = null
  }
}

// Re-acquire wake lock when returning to foreground
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await requestWakeLock()
    await checkAndFirePending()
  }
})

// ===== Check URL params for deep-link from notification =====
function checkStartParam() {
  const params = new URLSearchParams(window.location.search)
  const start = params.get('start')
  if (start === 'carpal' || start === 'legs') {
    // Clean the URL without reloading
    window.history.replaceState({}, '', window.location.pathname)
    return start
  }
  return null
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', async () => {
  ensureTodayProgress()
  registerServiceWorker()

  // Request wake lock for session screen keep-awake
  await requestWakeLock()

  // Fire any pending notifications
  await checkAndFirePending()

  // Check if launched from a notification deep-link
  const startCategory = checkStartParam()

  if (startCategory) {
    navigate('session', { category: startCategory })
  } else {
    navigate('home')
  }
})
