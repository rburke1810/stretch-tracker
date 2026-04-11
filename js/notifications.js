// StretchTracker — Notification Logic

// How notifications work on iOS PWA:
// - App must be added to home screen (iOS 16.4+)
// - No server = no true background push
// - We check scheduled times on every app open / visibility change
// - If current time falls within 30 min after a scheduled time
//   and we haven't fired that slot today, we fire the notification
// - The SW handles notificationclick to route back into the app

const NOTIFY_WINDOW_MINUTES = 30

function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  const result = await Notification.requestPermission()
  return result
}

// Returns true if the app is running as an installed PWA (standalone mode).
// iOS only shows notifications from installed PWAs.
function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true
}

// Parse "HH:MM" string into { h, m }
function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return { h, m }
}

// Get the number of minutes since midnight for "now"
function minutesSinceMidnight() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

// Check if we should fire a notification for a given scheduled time slot.
// Returns true if:
//   - current time is >= scheduled time
//   - current time is < scheduled time + NOTIFY_WINDOW_MINUTES
function isWithinWindow(timeStr) {
  const { h, m } = parseTime(timeStr)
  const scheduledMinutes = h * 60 + m
  const nowMinutes = minutesSinceMidnight()
  return nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + NOTIFY_WINDOW_MINUTES
}

// Fire a notification via the service worker registration.
// Falls back to Notification constructor if SW isn't available.
async function fireNotification(category) {
  const title = 'Time to Stretch! 🙌'
  const body = category === 'carpal'
    ? 'Quick hand & wrist stretch — takes just 5 minutes.'
    : 'Daily leg & foot stretch — your body will thank you.'
  const icon = './icons/icon-192.png'
  const options = { body, icon, badge: icon, data: { category }, tag: `stretch-${category}` }

  try {
    const reg = await navigator.serviceWorker.ready
    reg.showNotification(title, options)
  } catch {
    // Fallback when SW isn't ready
    if (Notification.permission === 'granted') {
      new Notification(title, options)
    }
  }
}

// Main check: called on every app focus / visibility change.
// Reads the schedule from state and fires any overdue notifications.
async function checkAndFirePending() {
  if (getNotificationPermission() !== 'granted') return
  if (!('serviceWorker' in navigator)) return

  const state = getState()
  const settings = state.settings.notifications
  const firedToday = state.notifications.firedToday

  let changed = false

  for (const category of ['carpal', 'legs']) {
    const catSettings = settings[category]
    if (!catSettings.enabled) continue

    for (const timeStr of catSettings.times) {
      if (!isWithinWindow(timeStr)) continue
      if ((firedToday[category] || []).includes(timeStr)) continue

      // Fire the notification
      await fireNotification(category)

      // Record as fired
      const updatedFired = {
        ...firedToday,
        [category]: [...(firedToday[category] || []), timeStr]
      }
      setState({
        notifications: {
          ...state.notifications,
          lastChecked: new Date().toISOString(),
          firedToday: updatedFired
        }
      })
      changed = true

      // Also tell the SW about the updated schedule so it can persist state
      try {
        const reg = await navigator.serviceWorker.ready
        reg.active && reg.active.postMessage({
          type: 'UPDATE_FIRED_TODAY',
          firedToday: updatedFired
        })
      } catch {}
    }
  }

  // Always update lastChecked timestamp
  if (!changed) {
    setState({
      notifications: {
        ...getState().notifications,
        lastChecked: new Date().toISOString()
      }
    })
  }
}

// Post the full notification schedule to the service worker for its own reference.
async function syncScheduleToSW() {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const state = getState()
    reg.active && reg.active.postMessage({
      type: 'SYNC_SCHEDULE',
      schedule: state.settings.notifications,
      firedToday: state.notifications.firedToday
    })
  } catch {}
}
