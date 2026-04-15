/**
 * StretchTracker Push Server — Cloudflare Worker
 *
 * Endpoints:
 *   POST /subscribe  — store push subscription + schedule + timezone
 *   PUT  /schedule   — update notification schedule only
 *   GET  /health     — health check
 *
 * Cron trigger (every minute):
 *   Checks if any notification is due and sends Web Push messages.
 *
 * Environment variables (set via `wrangler secret put`):
 *   VAPID_PRIVATE_KEY  — base64url-encoded P-256 private key scalar
 *   VAPID_EMAIL        — e.g. mailto:you@example.com
 *
 * KV namespace binding: STRETCH_KV
 */

import webpush from 'web-push'

const VAPID_PUBLIC_KEY = 'BI33qiby5ZUnTDAMxAoU39GjEv4jhcdAtmJQ7uURKW_pIpG5771dLCtRo9aCeal7KhH_ZiolCdZjs2iN5aysats'

// ── CORS helper ───────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}

// ── Worker entry ──────────────────────────────────────────────────────────────
export default {

  // HTTP handler
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true })
    }

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      try {
        const { subscription, schedule, timezone } = await request.json()
        if (!subscription || !subscription.endpoint || !subscription.keys) {
          return json({ error: 'Invalid subscription' }, 400)
        }
        await env.STRETCH_KV.put('subscription', JSON.stringify(subscription))
        await env.STRETCH_KV.put('schedule', JSON.stringify(schedule || {}))
        await env.STRETCH_KV.put('timezone', timezone || 'UTC')
        return json({ ok: true })
      } catch (e) {
        return json({ error: e.message }, 500)
      }
    }

    if (request.method === 'PUT' && url.pathname === '/schedule') {
      try {
        const { schedule } = await request.json()
        await env.STRETCH_KV.put('schedule', JSON.stringify(schedule))
        return json({ ok: true })
      } catch (e) {
        return json({ error: e.message }, 500)
      }
    }

    return new Response('Not Found', { status: 404 })
  },

  // Cron trigger — runs every minute, sends due notifications
  async scheduled(event, env) {
    const subscriptionStr = await env.STRETCH_KV.get('subscription')
    const scheduleStr     = await env.STRETCH_KV.get('schedule')
    const timezone        = (await env.STRETCH_KV.get('timezone')) || 'UTC'

    if (!subscriptionStr || !scheduleStr) return

    const subscription = JSON.parse(subscriptionStr)
    const schedule     = JSON.parse(scheduleStr)

    // Get current local time in the user's timezone
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now)

    const getPart  = type => fmt.find(p => p.type === type).value
    const localHour = parseInt(getPart('hour'),   10)
    const localMin  = parseInt(getPart('minute'), 10)
    const localDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const nowMinutes = localHour * 60 + localMin

    // Track which slots were fired today (keyed by date, expires after 48h)
    const firedKey      = `fired_${localDate}`
    const firedTodayStr = await env.STRETCH_KV.get(firedKey)
    const firedToday    = firedTodayStr ? JSON.parse(firedTodayStr) : { carpal: [], legs: [] }

    let changed = false

    webpush.setVapidDetails(env.VAPID_EMAIL, VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

    for (const [category, settings] of Object.entries(schedule)) {
      if (!settings || !settings.enabled) continue

      for (const timeStr of (settings.times || [])) {
        const [h, m] = timeStr.split(':').map(Number)
        const scheduledMinutes = h * 60 + m

        // Fire within a 1-minute window (cron runs every minute)
        if (nowMinutes < scheduledMinutes || nowMinutes >= scheduledMinutes + 1) continue
        if ((firedToday[category] || []).includes(timeStr)) continue

        const payload = JSON.stringify({
          title: 'Time to Stretch! 🙌',
          body: category === 'carpal'
            ? 'Quick hand & wrist stretch — takes just 5 minutes.'
            : 'Daily leg & foot stretch — your body will thank you.',
          category
        })

        try {
          await webpush.sendNotification(subscription, payload)
          firedToday[category] = [...(firedToday[category] || []), timeStr]
          changed = true
          console.log(`Sent ${category} notification for ${timeStr} (${timezone})`)
        } catch (e) {
          console.error(`Failed to send ${category} push for ${timeStr}:`, e.message)
        }
      }
    }

    if (changed) {
      await env.STRETCH_KV.put(firedKey, JSON.stringify(firedToday), {
        expirationTtl: 172800  // expires after 48 hours
      })
    }
  }
}
