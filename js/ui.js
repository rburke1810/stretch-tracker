// StretchTracker — View Renderers

const app = () => document.getElementById('app')

// ===== SVG Icons =====
const Icons = {
  settings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  back:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  pause:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  play:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  prev:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="6" x2="9" y2="18"/></svg>`,
  skip:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/><line x1="15" y1="6" x2="15" y2="18"/></svg>`,
  bell:     `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  check:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  close:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
}

// ===== Home View =====
function renderHome() {
  ensureTodayProgress()
  const todayProgress = getTodayProgress()
  const streak = getStreakDays()
  const permission = getNotificationPermission()
  const isPWA = isInstalledPWA()

  const carpalDone = todayProgress.carpal.sessionsCompleted
  const carpalTarget = todayProgress.carpal.target
  const legsDone = todayProgress.legs.sessionsCompleted
  const legsTarget = todayProgress.legs.target

  const carpalPct = Math.min(100, (carpalDone / carpalTarget) * 100)
  const legsPct   = Math.min(100, (legsDone   / legsTarget)   * 100)

  const showNotifBanner = permission !== 'granted'
  const showInstallHint = !isPWA && permission === 'default'

  app().innerHTML = `
    <div class="view home-view">
      <div class="view-header">
        <h1>StretchTracker</h1>
        <button class="icon-btn" id="btn-settings" aria-label="Settings">${Icons.settings}</button>
      </div>

      ${showInstallHint ? `
      <div class="install-hint">
        <strong>Add to Home Screen for notifications</strong>
        Tap the Share button in Safari, then "Add to Home Screen" to enable stretch reminders.
      </div>
      ` : ''}

      ${showNotifBanner && isPWA ? `
      <div class="notif-banner">
        <div class="notif-banner-text">
          <strong>${Icons.bell} Stretch Reminders</strong>
          Get notified when it's time to stretch
        </div>
        <button class="btn-setup" id="btn-setup-notif">Enable</button>
      </div>
      ` : ''}

      <p class="section-label">Today's Progress</p>
      <div class="progress-grid">
        <div class="progress-card carpal" id="card-carpal" role="button" tabindex="0">
          <div class="progress-card-icon">🤲</div>
          <div class="progress-card-label">Carpal Tunnel</div>
          <div class="progress-card-count">${carpalDone}<span style="font-size:14px;font-weight:400;color:var(--color-text-muted)"> / ${carpalTarget}</span></div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${carpalPct}%"></div>
          </div>
        </div>
        <div class="progress-card legs" id="card-legs" role="button" tabindex="0">
          <div class="progress-card-icon">🦵</div>
          <div class="progress-card-label">Legs & Feet</div>
          <div class="progress-card-count">${legsDone}<span style="font-size:14px;font-weight:400;color:var(--color-text-muted)"> / ${legsTarget}</span></div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${legsPct}%"></div>
          </div>
        </div>
      </div>

      ${streak > 0 ? `
      <div class="streak-row">
        🔥 <span class="streak-val">${streak}-day streak</span> — keep it up!
      </div>
      ` : ''}

      <p class="section-label">Quick Start</p>
      <div class="session-buttons">
        <button class="btn btn-carpal" id="btn-start-carpal">
          🤲 &nbsp;Carpal Tunnel Session
        </button>
        <button class="btn btn-legs" id="btn-start-legs">
          🦵 &nbsp;Legs & Feet Session
        </button>
      </div>
    </div>
  `

  document.getElementById('btn-settings').addEventListener('click', () => navigate('settings'))
  document.getElementById('btn-start-carpal').addEventListener('click', () => navigate('session', { category: 'carpal' }))
  document.getElementById('btn-start-legs').addEventListener('click', () => navigate('session', { category: 'legs' }))
  document.getElementById('card-carpal').addEventListener('click', () => navigate('session', { category: 'carpal' }))
  document.getElementById('card-legs').addEventListener('click', () => navigate('session', { category: 'legs' }))

  const setupBtn = document.getElementById('btn-setup-notif')
  if (setupBtn) setupBtn.addEventListener('click', () => renderPermissionModal())
}

// ===== Session View =====
let _sessionCategory = null
let _sessionStartTime = null

function renderSession(params) {
  const { category } = params
  _sessionCategory = category

  const state = getState()
  const queue = buildSessionQueue(category, state.settings)

  if (queue.length === 0) {
    renderHome()
    return
  }

  _sessionStartTime = Date.now()

  // Build the ring SVG circumference
  const radius = 108
  const circumference = 2 * Math.PI * radius

  app().innerHTML = `
    <div class="session-view">
      <div class="session-top-bar">
        <div class="session-top-bar-fill" id="session-progress-bar" style="width:0%"></div>
      </div>

      <div class="session-header">
        <button class="icon-btn" id="btn-session-back" aria-label="End session">${Icons.close}</button>
        <span class="session-counter" id="session-counter">Stretch 1 of ${queue.length}</span>
        <span class="session-category-badge ${category}" id="cat-badge">
          ${category === 'carpal' ? '🤲 Wrists' : '🦵 Legs'}
        </span>
      </div>

      <div class="ring-container">
        <svg class="ring-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
          <circle class="ring-track" cx="120" cy="120" r="${radius}"/>
          <circle
            class="ring-fill"
            id="ring-fill"
            cx="120" cy="120" r="${radius}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="0"
          />
        </svg>
        <div class="ring-text">
          <span class="ring-seconds" id="ring-seconds">–</span>
          <span class="ring-label">seconds</span>
        </div>
      </div>

      <h2 class="stretch-name" id="stretch-name">Loading…</h2>
      <p class="stretch-instructions" id="stretch-instructions"></p>

      <div class="session-controls">
        <button class="ctrl-btn" id="btn-prev" aria-label="Previous stretch">
          <div class="ctrl-btn-icon">${Icons.prev}</div>
          <span>Prev</span>
        </button>

        <button class="ctrl-btn pause-btn" id="btn-pause" aria-label="Pause session">
          <div class="ctrl-btn-icon">${Icons.pause}</div>
          <span>Pause</span>
        </button>

        <button class="ctrl-btn" id="btn-skip" aria-label="Skip stretch">
          <div class="ctrl-btn-icon">${Icons.skip}</div>
          <span>Skip</span>
        </button>
      </div>
    </div>
  `

  // Cache DOM refs updated on every tick
  const ringFill   = document.getElementById('ring-fill')
  const ringSeconds = document.getElementById('ring-seconds')
  const progressBar = document.getElementById('session-progress-bar')
  const counter    = document.getElementById('session-counter')
  const nameEl     = document.getElementById('stretch-name')
  const instrEl    = document.getElementById('stretch-instructions')

  function updateRingColor(progress) {
    if (progress > 0.5)       return 'var(--color-accent)'
    else if (progress > 0.25) return 'var(--color-accent-amber)'
    else                      return 'var(--color-accent-red)'
  }

  startSession(queue, {
    onNextStretch(stretch) {
      // Fade out
      nameEl.classList.add('stretch-fade-out')
      instrEl.classList.add('stretch-fade-out')

      setTimeout(() => {
        nameEl.textContent = stretch.name
        instrEl.textContent = stretch.instructions
        counter.textContent = `Stretch ${stretch.index + 1} of ${stretch.total}`
        progressBar.style.width = `${((stretch.index) / stretch.total) * 100}%`

        nameEl.classList.remove('stretch-fade-out')
        instrEl.classList.remove('stretch-fade-out')
        nameEl.classList.add('stretch-fade-in')
        instrEl.classList.add('stretch-fade-in')
        setTimeout(() => {
          nameEl.classList.remove('stretch-fade-in')
          instrEl.classList.remove('stretch-fade-in')
        }, 200)
      }, 150)
    },

    onTick({ remainingMs, currentIndex, total, stretch }) {
      const secs = Math.ceil(remainingMs / 1000)
      ringSeconds.textContent = secs

      const progress = remainingMs / (stretch.durationSeconds * 1000)
      const offset = circumference * (1 - progress)
      ringFill.setAttribute('stroke-dashoffset', offset.toFixed(2))
      ringFill.style.stroke = updateRingColor(progress)

      progressBar.style.width = `${((currentIndex + (1 - progress)) / total) * 100}%`
    },

    onComplete({ stretchCount, durationMs }) {
      incrementSessionCount(category)
      renderCompletion({ category, stretchCount, durationMs })
    }
  })

  // Controls
  const pauseBtn = document.getElementById('btn-pause')
  pauseBtn.addEventListener('click', () => {
    if (isSessionPaused()) {
      resumeSession()
      pauseBtn.querySelector('.ctrl-btn-icon').innerHTML = Icons.pause
      pauseBtn.querySelector('span').textContent = 'Pause'
    } else {
      pauseSession()
      pauseBtn.querySelector('.ctrl-btn-icon').innerHTML = Icons.play
      pauseBtn.querySelector('span').textContent = 'Resume'
    }
  })

  document.getElementById('btn-skip').addEventListener('click', () => skipStretch())
  document.getElementById('btn-prev').addEventListener('click', () => prevStretch())

  document.getElementById('btn-session-back').addEventListener('click', () => {
    stopSession()
    navigate('home')
  })

  // Auto-pause when app goes to background
  document.addEventListener('visibilitychange', _sessionVisibilityHandler)
}

function _sessionVisibilityHandler() {
  if (document.visibilityState === 'hidden') {
    pauseSession()
  } else {
    // Don't auto-resume — let user tap Resume
  }
}

function cleanupSessionListeners() {
  document.removeEventListener('visibilitychange', _sessionVisibilityHandler)
}

// ===== Completion View =====
function renderCompletion({ category, stretchCount, durationMs }) {
  cleanupSessionListeners()

  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  app().innerHTML = `
    <div class="completion-view">
      <svg class="completion-icon" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="48" cy="48" r="44" stroke="var(--color-accent)" stroke-width="3" opacity="0.3"/>
        <path class="completion-checkmark"
          d="M28 50 L42 64 L68 34"
          stroke="var(--color-accent)"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>

      <h1 class="completion-title">Session Complete!</h1>
      <p class="completion-sub">
        ${category === 'carpal' ? 'Carpal Tunnel' : 'Legs & Feet'} — well done!
      </p>

      <div class="completion-stats">
        <div class="stat-item">
          <span class="stat-value">${stretchCount}</span>
          <span class="stat-label">Stretches</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${timeStr}</span>
          <span class="stat-label">Duration</span>
        </div>
      </div>

      <div class="completion-buttons">
        <button class="btn btn-primary" id="btn-done">Done</button>
        <button class="btn btn-secondary" id="btn-go-again">Go Again</button>
      </div>
    </div>
  `

  document.getElementById('btn-done').addEventListener('click', () => navigate('home'))
  document.getElementById('btn-go-again').addEventListener('click', () => {
    navigate('session', { category: _sessionCategory || category })
  })
}

// ===== Settings View =====
async function renderSettings() {
  const state = getState()
  const { settings } = state
  const permission = getNotificationPermission()
  const pushSub = await getPushSubscription()
  const pushActive = !!pushSub && isPushConfigured()

  const carpalTimes = settings.notifications.carpal.times
  const legsTimes   = settings.notifications.legs.times
  const carpalEnabled = settings.notifications.carpal.enabled
  const legsEnabled   = settings.notifications.legs.enabled

  function timePickerRow(id, label, value) {
    return `
      <div class="time-picker-row">
        <span class="time-picker-label">${label}</span>
        <input type="time" id="${id}" value="${value}" aria-label="Notification time ${label}">
      </div>
    `
  }

  let permissionBadgeClass = permission
  let permissionLabel = permission === 'granted' ? 'Granted' :
                        permission === 'denied'  ? 'Denied'  : 'Not Set'

  app().innerHTML = `
    <div class="view settings-view">
      <div class="view-header">
        <button class="icon-btn" id="btn-back-settings" aria-label="Back">${Icons.back}</button>
        <h1>Settings</h1>
        <div style="width:44px"></div>
      </div>

      <div class="settings-section">
        <p class="settings-section-title">Session</p>
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">Session Duration</div>
              <div class="settings-row-sub">Total time per session</div>
            </div>
            <div class="stepper">
              <button class="stepper-btn" id="dur-minus">−</button>
              <span class="stepper-value" id="dur-val">${settings.sessionDurationMinutes}m</span>
              <button class="stepper-btn" id="dur-plus">+</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-row-label">Time Per Stretch</div>
              <div class="settings-row-sub">Countdown per stretch</div>
            </div>
            <div class="stepper">
              <button class="stepper-btn" id="str-minus">−</button>
              <span class="stepper-value" id="str-val">${settings.timePerStretchSeconds}s</span>
              <button class="stepper-btn" id="str-plus">+</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <p class="settings-section-title">Carpal Tunnel Notifications</p>
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">🤲 Reminders</div>
              <div class="settings-row-sub">3× per day</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="toggle-carpal" ${carpalEnabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div class="time-pickers-section ${carpalEnabled ? '' : 'hidden'}" id="carpal-times">
            ${timePickerRow('carpal-t0', '1st', carpalTimes[0] || '09:00')}
            ${timePickerRow('carpal-t1', '2nd', carpalTimes[1] || '13:00')}
            ${timePickerRow('carpal-t2', '3rd', carpalTimes[2] || '18:00')}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <p class="settings-section-title">Leg & Feet Notifications</p>
        <div class="settings-group">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">🦵 Reminder</div>
              <div class="settings-row-sub">Once per day</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="toggle-legs" ${legsEnabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
              <span class="toggle-thumb"></span>
            </label>
          </div>
          <div class="time-pickers-section ${legsEnabled ? '' : 'hidden'}" id="legs-times">
            ${timePickerRow('legs-t0', 'Time', legsTimes[0] || '19:00')}
          </div>
        </div>
      </div>

      <div class="settings-section">
        <p class="settings-section-title">Notifications</p>
        <div class="settings-group">
          <div class="settings-row">
            <div class="settings-row-label">Permission</div>
            <span class="permission-badge ${permissionBadgeClass}">${permissionLabel}</span>
          </div>
          ${permission === 'granted' ? `
          <div class="settings-row">
            <div>
              <div class="settings-row-label">Background Push</div>
              <div class="settings-row-sub">${pushActive ? 'Active — works when app is closed' : isPushConfigured() ? 'Not subscribed yet' : 'Push server not set up'}</div>
            </div>
            <span class="permission-badge ${pushActive ? 'granted' : 'default'}">${pushActive ? 'Active' : 'Off'}</span>
          </div>
          ${!pushActive && isPushConfigured() ? `
          <div class="settings-row">
            <button class="btn btn-secondary btn-sm w-full" id="btn-subscribe-push" style="margin:0">
              ${Icons.bell} &nbsp;Enable Background Push
            </button>
          </div>
          ` : pushActive ? `
          <div class="settings-row">
            <button class="btn btn-secondary btn-sm w-full" id="btn-resubscribe-push" style="margin:0">
              ${Icons.bell} &nbsp;Refresh Push Subscription
            </button>
          </div>
          ` : ''}
          <div class="settings-row">
            <button class="btn btn-secondary btn-sm w-full" id="btn-test-notif" style="margin:0">
              ${Icons.bell} &nbsp;Send Test Notification
            </button>
          </div>
          ` : `
          <div class="settings-row">
            <button class="btn btn-secondary btn-sm w-full" id="btn-req-permission" style="margin:0">
              ${Icons.bell} &nbsp;Request Permission
            </button>
          </div>
          `}
          ${permission === 'denied' ? `
          <div class="settings-row">
            <p class="text-muted" style="font-size:13px;line-height:1.5">
              Blocked. Go to <strong>iOS Settings → StretchTracker → Notifications</strong> to re-enable.
            </p>
          </div>
          ` : ''}
          ${!isInstalledPWA() ? `
          <div class="settings-row">
            <p class="text-muted" style="font-size:13px;line-height:1.5">
              Add to Home Screen in Safari for notifications to work on iOS.
            </p>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="settings-section">
        <p class="settings-section-title">Data</p>
        <div class="settings-group">
          <div class="settings-row">
            <button class="btn btn-destructive btn-sm w-full" id="btn-reset-progress" style="margin:0">
              Reset Today's Progress
            </button>
          </div>
        </div>
      </div>
    </div>
  `

  // Back
  document.getElementById('btn-back-settings').addEventListener('click', () => navigate('home'))

  // Duration stepper
  let dur = settings.sessionDurationMinutes
  const durVal = document.getElementById('dur-val')
  document.getElementById('dur-minus').addEventListener('click', () => {
    dur = Math.max(1, dur - 1)
    durVal.textContent = `${dur}m`
    saveSettings()
  })
  document.getElementById('dur-plus').addEventListener('click', () => {
    dur = Math.min(30, dur + 1)
    durVal.textContent = `${dur}m`
    saveSettings()
  })

  // Stretch duration stepper
  let strSec = settings.timePerStretchSeconds
  const strVal = document.getElementById('str-val')
  document.getElementById('str-minus').addEventListener('click', () => {
    strSec = Math.max(15, strSec - 5)
    strVal.textContent = `${strSec}s`
    saveSettings()
  })
  document.getElementById('str-plus').addEventListener('click', () => {
    strSec = Math.min(120, strSec + 5)
    strVal.textContent = `${strSec}s`
    saveSettings()
  })

  // Toggles
  document.getElementById('toggle-carpal').addEventListener('change', e => {
    document.getElementById('carpal-times').classList.toggle('hidden', !e.target.checked)
    saveSettings()
  })
  document.getElementById('toggle-legs').addEventListener('change', e => {
    document.getElementById('legs-times').classList.toggle('hidden', !e.target.checked)
    saveSettings()
  })

  // Time pickers — auto-save on change
  ;['carpal-t0', 'carpal-t1', 'carpal-t2', 'legs-t0'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.addEventListener('change', saveSettings)
  })

  function saveSettings() {
    setState({
      settings: {
        sessionDurationMinutes: dur,
        timePerStretchSeconds:  strSec,
        notifications: {
          carpal: {
            enabled: document.getElementById('toggle-carpal').checked,
            times: [
              document.getElementById('carpal-t0').value || '09:00',
              document.getElementById('carpal-t1').value || '13:00',
              document.getElementById('carpal-t2').value || '18:00'
            ]
          },
          legs: {
            enabled: document.getElementById('toggle-legs').checked,
            times: [
              document.getElementById('legs-t0').value || '19:00'
            ]
          }
        }
      }
    })
    updateServerSchedule()
  }

  // Permission request
  const permBtn = document.getElementById('btn-req-permission')
  if (permBtn) {
    permBtn.addEventListener('click', async () => {
      const result = await requestNotificationPermission()
      if (result === 'granted') {
        await setupPushNotifications()
        renderSettings()
      }
    })
  }

  // Subscribe to background push
  const subBtn = document.getElementById('btn-subscribe-push')
  if (subBtn) {
    subBtn.addEventListener('click', async () => {
      subBtn.textContent = 'Connecting…'
      subBtn.disabled = true
      const ok = await setupPushNotifications()
      if (ok) {
        renderSettings()
      } else {
        subBtn.textContent = 'Failed — check server URL'
        subBtn.disabled = false
      }
    })
  }

  // Refresh push subscription (force resubscribe after VAPID key rotation)
  const resubBtn = document.getElementById('btn-resubscribe-push')
  if (resubBtn) {
    resubBtn.addEventListener('click', async () => {
      resubBtn.textContent = 'Reconnecting…'
      resubBtn.disabled = true
      const subscription = await resubscribeToPush()
      if (subscription) {
        const ok = await syncToServer(subscription)
        if (ok) {
          renderSettings()
          return
        }
      }
      resubBtn.textContent = 'Failed — try again'
      resubBtn.disabled = false
    })
  }

  // Test notification
  const testBtn = document.getElementById('btn-test-notif')
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const ok = await sendTestNotification()
      if (!ok) alert('Could not send test notification. Make sure permission is granted and the app is installed to your home screen.')
    })
  }

  // Reset today
  document.getElementById('btn-reset-progress').addEventListener('click', () => {
    if (!confirm('Reset today\'s session progress?')) return
    const state = getState()
    const today = new Date().toISOString().slice(0, 10)
    setState({
      progress: {
        ...state.progress,
        [today]: {
          carpal: { sessionsCompleted: 0, target: 3 },
          legs:   { sessionsCompleted: 0, target: 1 }
        }
      }
    })
  })
}

// ===== Permission Modal =====
function renderPermissionModal() {
  const existing = document.getElementById('permission-modal')
  if (existing) existing.remove()

  const modal = document.createElement('div')
  modal.id = 'permission-modal'
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-handle"></div>
      <div class="modal-icon">🔔</div>
      <h2 class="modal-title" id="modal-title">Get Stretch Reminders</h2>
      <p class="modal-body">
        StretchTracker can remind you when it's time to stretch throughout the day.
        Notifications only work when the app is <strong>added to your home screen</strong>.
      </p>
      <div class="modal-buttons">
        <button class="btn btn-primary" id="modal-enable">Enable Notifications</button>
        <button class="btn btn-ghost" id="modal-dismiss">Not Now</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  document.getElementById('modal-enable').addEventListener('click', async () => {
    modal.remove()
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      await setupPushNotifications()
      renderHome()
    }
  })

  document.getElementById('modal-dismiss').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}
