// StretchTracker — Session Algorithm & Timer Engine

// Fisher-Yates shuffle (returns a new array)
function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Build a session queue for the given category and settings.
// Returns an array of stretch objects, each with durationSeconds set.
function buildSessionQueue(category, settings) {
  const pool = STRETCHES.filter(s => s.category === category)
  if (pool.length === 0) return []

  const totalSeconds = settings.sessionDurationMinutes * 60
  const perStretch   = settings.timePerStretchSeconds
  const count        = Math.max(1, Math.floor(totalSeconds / perStretch))

  const shuffled = fisherYates(pool)
  const queue = []
  while (queue.length < count) {
    queue.push(...fisherYates(pool))
  }

  return queue.slice(0, count).map((stretch, i) => ({
    ...stretch,
    durationSeconds: perStretch,
    index: i,
    total: count
  }))
}

// ===== Timer Engine =====

let _queue          = []
let _currentIndex   = 0
let _stretchStart   = null   // performance.now() timestamp
let _pausedElapsed  = 0      // ms accumulated while paused
let _isPaused       = false
let _isStopped      = true
let _rafId          = null
let _sessionStart   = null   // wall-clock Date for stats

let _onTick         = null   // ({ remainingMs, currentIndex, total, stretch })
let _onNextStretch  = null   // (stretch)
let _onComplete     = null   // ({ stretchCount, durationMs })

function _tick() {
  if (_isPaused || _isStopped) return

  const now     = performance.now()
  const elapsed = (now - _stretchStart) + _pausedElapsed
  const stretch = _queue[_currentIndex]
  const totalMs = stretch.durationSeconds * 1000
  const remaining = Math.max(0, totalMs - elapsed)

  _onTick && _onTick({
    remainingMs:   remaining,
    currentIndex:  _currentIndex,
    total:         _queue.length,
    stretch
  })

  if (remaining <= 0) {
    _advanceStretch()
  } else {
    _rafId = requestAnimationFrame(_tick)
  }
}

function _advanceStretch() {
  _currentIndex++
  if (_currentIndex >= _queue.length) {
    _isStopped = true
    const durationMs = Date.now() - _sessionStart
    _onComplete && _onComplete({
      stretchCount: _queue.length,
      durationMs
    })
    return
  }
  _stretchStart  = performance.now()
  _pausedElapsed = 0
  _onNextStretch && _onNextStretch(_queue[_currentIndex])
  _rafId = requestAnimationFrame(_tick)
}

function startSession(queue, callbacks) {
  _queue         = queue
  _currentIndex  = 0
  _stretchStart  = performance.now()
  _pausedElapsed = 0
  _isPaused      = false
  _isStopped     = false
  _sessionStart  = Date.now()

  _onTick        = callbacks.onTick        || null
  _onNextStretch = callbacks.onNextStretch || null
  _onComplete    = callbacks.onComplete    || null

  // Fire immediately so the first stretch shows
  _onNextStretch && _onNextStretch(_queue[0])
  _rafId = requestAnimationFrame(_tick)
}

function pauseSession() {
  if (_isPaused || _isStopped) return
  _pausedElapsed += performance.now() - _stretchStart
  _isPaused = true
  cancelAnimationFrame(_rafId)
}

function resumeSession() {
  if (!_isPaused || _isStopped) return
  _stretchStart = performance.now()
  _isPaused     = false
  _rafId = requestAnimationFrame(_tick)
}

function skipStretch() {
  if (_isStopped) return
  cancelAnimationFrame(_rafId)
  _advanceStretch()
}

function prevStretch() {
  if (_isStopped || _currentIndex === 0) return
  cancelAnimationFrame(_rafId)
  _currentIndex--
  _stretchStart  = performance.now()
  _pausedElapsed = 0
  _onNextStretch && _onNextStretch(_queue[_currentIndex])
  if (!_isPaused) _rafId = requestAnimationFrame(_tick)
}

function stopSession() {
  _isStopped = true
  _isPaused  = false
  cancelAnimationFrame(_rafId)
  _queue = []
}

function isSessionPaused()  { return _isPaused  }
function isSessionStopped() { return _isStopped }
function getCurrentStretch() {
  return _queue[_currentIndex] || null
}
