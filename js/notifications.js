// StretchTracker — Notification Logic

// ===== CONFIGURATION =====
// After deploying the Cloudflare Worker, paste your worker URL here:
const PUSH_SERVER_URL = 'https://stretch-tracker-push.rburke-stretch.workers.dev'

// VAPID public key — must match the key used by the Cloudflare Worker
const VAPID_PUBLIC_KEY = 'BNimBpl8w_y9e3H4x3SCgV27YuL3LdLjonXxYUNeR6o_bPUsFT954P6vASM21VYn2qKay5aXDuQj8g27uw8rvQ8'

// ===== Utilities =====

function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

function isPushConfigured() {
  return PUSH_SERVER_URL !== 'REPLACE_WITH_YOUR_WORKER_URL' && PUSH_SERVER_URL !== ''
}

// Convert a base64url string to a Uint8Array (needed for applicationServerKey)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// ===== Push Subscription =====

async function getPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return reg.pushManager.getSubscription()
  } catch { return null }
}

async function subscribeToPush() {
  if (!isPushConfigured()) return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  if (getNotificationPermission() !== 'granted') return null

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return existing

    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  } catch (err) {
    console.error('Push subscribe failed:', err)
    return null
  }
}

async function resubscribeToPush() {
  if (!isPushConfigured()) return null
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  if (getNotificationPermission() !== 'granted') return null

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  } catch (err) {
    console.error('Push resubscribe failed:', err)
    return null
  }
}

// Send the push subscription + schedule to the Cloudflare Worker
async function syncToServer(subscription) {
  if (!isPushConfigured() || !subscription) return false
  try {
    const state = getState()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const res = await fetch(`${PUSH_SERVER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        schedule: state.settings.notifications,
        timezone
      })
    })
    return res.ok
  } catch (err) {
    console.error('Failed to sync to push server:', err)
    return false
  }
}

// Update only the schedule on the server (call when settings change)
async function updateServerSchedule() {
  if (!isPushConfigured()) return false
  const subscription = await getPushSubscription()
  if (!subscription) return false
  try {
    const state = getState()
    const res = await fetch(`${PUSH_SERVER_URL}/schedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: state.settings.notifications })
    })
    return res.ok
  } catch { return false }
}

// ===== Full Setup Flow =====
// Called after permission is granted. Subscribes to push and syncs to server.
async function setupPushNotifications() {
  const subscription = await subscribeToPush()
  if (!subscription) return false
  return syncToServer(subscription)
}

// ===== Test Notification =====
// Fires immediately — useful for verifying notifications work at all
async function sendTestNotification() {
  if (getNotificationPermission() !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification('Test — StretchTracker 🙌', {
      body: 'Notifications are working correctly!',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'stretch-test'
    })
    return true
  } catch (err) {
    // Fallback: plain Notification
    if (getNotificationPermission() === 'granted') {
      new Notification('Test — StretchTracker 🙌', {
        body: 'Notifications are working correctly!',
        icon: './icons/icon-192.png'
      })
      return true
    }
    return false
  }
}

// ===== Fallback: in-app check when app is opened =====
// Fires a notification if the app is opened within 30 min of a scheduled time
// (works without the push server, but only when the app is opened)

const NOTIFY_WINDOW_MINUTES = 30

function minutesSinceMidnight() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function isWithinWindow(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const scheduled = h * 60 + m
  const now = minutesSinceMidnight()
  return now >= scheduled && now < scheduled + NOTIFY_WINDOW_MINUTES
}

async function checkAndFirePending() {
  if (getNotificationPermission() !== 'granted') return
  if (!('serviceWorker' in navigator)) return

  // If push server is configured and subscription exists, skip in-app fallback
  // (the server handles delivery even when app is closed)
  if (isPushConfigured()) {
    const sub = await getPushSubscription()
    if (sub) return  // server handles it
  }

  const state = getState()
  const settings = state.settings.notifications
  const firedToday = state.notifications.firedToday || { carpal: [], legs: [] }
  let updatedFired = { ...firedToday }
  let changed = false

  for (const category of ['carpal', 'legs']) {
    const cat = settings[category]
    if (!cat.enabled) continue
    for (const timeStr of cat.times) {
      if (!isWithinWindow(timeStr)) continue
      if ((updatedFired[category] || []).includes(timeStr)) continue

      try {
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification('Time to Stretch! 🙌', {
          body: category === 'carpal'
            ? 'Quick hand & wrist stretch — takes just 5 minutes.'
            : 'Daily leg & foot stretch — your body will thank you.',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          data: { category },
          tag: `stretch-${category}`
        })
      } catch {
        if (getNotificationPermission() === 'granted') {
          new Notification('Time to Stretch! 🙌', {
            body: category === 'carpal' ? 'Hand & wrist stretch.' : 'Leg & foot stretch.',
            icon: './icons/icon-192.png'
          })
        }
      }

      updatedFired[category] = [...(updatedFired[category] || []), timeStr]
      changed = true
    }
  }

  if (changed) {
    setState({
      notifications: {
        ...state.notifications,
        lastChecked: new Date().toISOString(),
        firedToday: updatedFired
      }
    })
  }
}
