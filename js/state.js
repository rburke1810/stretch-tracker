// StretchTracker — State / localStorage Layer

const STATE_KEY = 'stretchtracker_state'

const DEFAULT_STATE = {
  version: 1,
  settings: {
    sessionDurationMinutes: 5,
    timePerStretchSeconds: 45,
    notifications: {
      carpal: { enabled: true,  times: ['09:00', '13:00', '18:00'] },
      legs:   { enabled: true,  times: ['19:00'] }
    }
  },
  progress: {},
  notifications: {
    lastChecked: null,
    firedToday: { carpal: [], legs: [] }
  }
}

function deepMerge(target, source) {
  const result = Object.assign({}, target)
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function pruneOldProgress(progress) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const pruned = {}
  for (const [date, val] of Object.entries(progress)) {
    if (new Date(date) >= cutoff) pruned[date] = val
  }
  return pruned
}

function resetFiredTodayIfNeeded(state) {
  const today = todayKey()
  const lastChecked = state.notifications.lastChecked
  if (!lastChecked || lastChecked.slice(0, 10) !== today) {
    state.notifications.firedToday = { carpal: [], legs: [] }
  }
  return state
}

function getState() {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return deepMerge(DEFAULT_STATE, {})
    const saved = JSON.parse(raw)
    // Merge saved over defaults so new default keys appear automatically
    let state = deepMerge(DEFAULT_STATE, saved)
    state.progress = pruneOldProgress(state.progress || {})
    state = resetFiredTodayIfNeeded(state)
    return state
  } catch {
    return deepMerge(DEFAULT_STATE, {})
  }
}

function setState(patch) {
  const current = getState()
  const next = deepMerge(current, patch)
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('StretchTracker: failed to save state', e)
  }
  return next
}

function resetState() {
  localStorage.removeItem(STATE_KEY)
  return deepMerge(DEFAULT_STATE, {})
}

// Ensure today's progress entry exists for both categories
function ensureTodayProgress() {
  const state = getState()
  const today = todayKey()
  if (!state.progress[today]) {
    setState({
      progress: {
        ...state.progress,
        [today]: {
          carpal: { sessionsCompleted: 0, target: 3 },
          legs:   { sessionsCompleted: 0, target: 1 }
        }
      }
    })
  }
}

function getTodayProgress() {
  const state = getState()
  const today = todayKey()
  return state.progress[today] || {
    carpal: { sessionsCompleted: 0, target: 3 },
    legs:   { sessionsCompleted: 0, target: 1 }
  }
}

function incrementSessionCount(category) {
  const state = getState()
  const today = todayKey()
  const todayProgress = state.progress[today] || {
    carpal: { sessionsCompleted: 0, target: 3 },
    legs:   { sessionsCompleted: 0, target: 1 }
  }
  const updated = {
    ...todayProgress,
    [category]: {
      ...todayProgress[category],
      sessionsCompleted: todayProgress[category].sessionsCompleted + 1
    }
  }
  setState({
    progress: { ...state.progress, [today]: updated }
  })
}

function getStreakDays() {
  const state = getState()
  const today = new Date()
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const day = state.progress[key]
    if (!day) break
    const carpalDone = day.carpal.sessionsCompleted >= day.carpal.target
    const legsDone   = day.legs.sessionsCompleted   >= day.legs.target
    if (carpalDone && legsDone) {
      streak++
    } else {
      break
    }
  }
  return streak
}
