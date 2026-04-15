/**
 * StretchTracker Push Server — Cloudflare Worker
 *
 * Endpoints:
 *   POST /subscribe       — store push subscription + schedule + timezone
 *   PUT  /schedule        — update notification schedule only
 *   GET  /health          — health check
 *
 * Cron trigger (every 10 minutes):
 *   Checks if any notification is due and sends Web Push messages.
 *
 * Environment variables (set via wrangler secret or dashboard):
 *   VAPID_PRIVATE_KEY     — base64url-encoded P-256 private key scalar
 *   VAPID_EMAIL           — e.g. mailto:you@example.com
 *
 * KV namespace binding: STRETCH_KV
 */

// ── VAPID public key (must match the key in js/notifications.js) ──────────────
const VAPID_PUBLIC_KEY = 'BI33qiby5ZUnTDAMxAoU39GjEv4jhcdAtmJQ7uURKW_pIpG5771dLCtRo9aCeal7KhH_ZiolCdZjs2iN5aysats'

// ── Utility: base64url ────────────────────────────────────────────────────────
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Uint8Array.from(atob((str + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

// ── VAPID: create JWT + auth header ──────────────────────────────────────────
async function vapidHeaders(endpoint, vapidPrivateKeyB64, email) {
  const aud = new URL(endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 43200  // 12 hours

  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(new TextEncoder().encode(JSON.stringify({ aud, exp, sub: email })))
  const unsigned = `${header}.${claims}`

  // Import private key from raw 32-byte d value
  const pubBytes = b64urlDecode(VAPID_PUBLIC_KEY)
  const x = pubBytes.slice(1, 33)
  const y = pubBytes.slice(33, 65)
  const d = b64urlDecode(vapidPrivateKeyB64)

  const jwk = {
    kty: 'EC', crv: 'P-256',
    x: b64url(x), y: b64url(y), d: b64url(d),
    key_ops: ['sign']
  }

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))
  const jwt  = `${unsigned}.${b64url(sig)}`

  return {
    Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    'Content-Type': 'application/octet-stream'
  }
}

// ── Web Push encryption ───────────────────────────────────────────────────────
// Implements RFC 8291 (Message Encryption for Web Push)

async function encryptPayload(subscriptionKeys, plaintext) {
  const encoder = new TextEncoder()
  const p256dh  = b64urlDecode(subscriptionKeys.p256dh)
  const auth    = b64urlDecode(subscriptionKeys.auth)
  const payload = encoder.encode(plaintext)

  // Generate local (sender) ephemeral key pair
  const senderKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits'])

  // Import recipient's public key
  const recipientPub = await crypto.subtle.importKey(
    'raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPub }, senderKeys.privateKey, 256
  )

  // Export sender's public key (65-byte uncompressed)
  const senderPubRaw = await crypto.subtle.exportKey('raw', senderKeys.publicKey)

  // HKDF-SHA-256: auth secret → pseudorandom key
  const prk = await hkdf(
    'SHA-256',
    auth,
    new Uint8Array(sharedBits),
    concat(encoder.encode('Content-Encoding: auth\0'), new Uint8Array([1])),
    32
  )

  // Salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF for content encryption key and nonce
  const keyInfo   = buildInfo('aesgcm', p256dh, new Uint8Array(senderPubRaw))
  const nonceInfo = buildInfo('nonce',  p256dh, new Uint8Array(senderPubRaw))

  const contentKey   = await hkdf('SHA-256', salt, prk, concat(encoder.encode(keyInfo),   new Uint8Array([1])), 16)
  const nonce        = await hkdf('SHA-256', salt, prk, concat(encoder.encode(nonceInfo), new Uint8Array([1])), 12)

  // Pad the payload (2-byte length prefix, then payload, then padding)
  const padLength = 0
  const padded = new Uint8Array(2 + payload.length + padLength)
  new DataView(padded.buffer).setUint16(0, padLength, false)
  padded.set(payload, 2)

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt'])
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)

  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    senderPublicKey: new Uint8Array(senderPubRaw)
  }
}

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { result.set(a, offset); offset += a.length }
  return result
}

function buildInfo(type, recipientPub, senderPub) {
  // "Content-Encoding: <type>\0P-256\0" + uint16_be(len(recipient)) + recipient + uint16_be(len(sender)) + sender
  const encoder = new TextEncoder()
  const prefix = encoder.encode(`Content-Encoding: ${type}\0P-256\0`)
  const recvLen = new Uint8Array(2); new DataView(recvLen.buffer).setUint16(0, recipientPub.length, false)
  const sendLen = new Uint8Array(2); new DataView(sendLen.buffer).setUint16(0, senderPub.length, false)
  return concat(prefix, recvLen, recipientPub, sendLen, senderPub)
}

async function hkdf(hash, salt, ikm, info, length) {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash }, false, ['sign'])
  const prk     = await crypto.subtle.sign('HMAC', saltKey, ikm)
  const prkKey  = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash }, false, ['sign'])
  const t       = await crypto.subtle.sign('HMAC', prkKey, info)
  return new Uint8Array(t).slice(0, length)
}

// ── Send a Web Push message ───────────────────────────────────────────────────
async function sendPush(subscription, payload, vapidPrivateKey, vapidEmail) {
  const { endpoint, keys } = subscription

  const { ciphertext, salt, senderPublicKey } = await encryptPayload(keys, payload)

  const headers = await vapidHeaders(endpoint, vapidPrivateKey, vapidEmail)
  headers['Content-Encoding'] = 'aesgcm'
  headers['Encryption'] = `salt=${b64url(salt)}`
  headers['Crypto-Key'] = `dh=${b64url(senderPublicKey)}; p256ecdsa=${VAPID_PUBLIC_KEY}`
  headers['Content-Length'] = ciphertext.length.toString()
  headers['TTL'] = '2419200'

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: ciphertext
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Push failed ${res.status}: ${body}`)
  }
  return res
}

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

  // Cron trigger — runs every 10 minutes, sends due notifications
  async scheduled(event, env) {
    const subscriptionStr = await env.STRETCH_KV.get('subscription')
    const scheduleStr     = await env.STRETCH_KV.get('schedule')
    const timezone        = (await env.STRETCH_KV.get('timezone')) || 'UTC'

    if (!subscriptionStr || !scheduleStr) return

    const subscription = JSON.parse(subscriptionStr)
    const schedule     = JSON.parse(scheduleStr)

    // Get local time parts
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now)

    const getPart = type => fmt.find(p => p.type === type).value
    const localHour = parseInt(getPart('hour'), 10)
    const localMin  = parseInt(getPart('minute'), 10)
    const localDate = `${getPart('year')}-${getPart('month')}-${getPart('day')}`
    const nowMinutes = localHour * 60 + localMin

    // Track which notifications were fired today
    const firedKey     = `fired_${localDate}`
    const firedTodayStr = await env.STRETCH_KV.get(firedKey)
    const firedToday   = firedTodayStr ? JSON.parse(firedTodayStr) : { carpal: [], legs: [] }

    let changed = false
    const WINDOW = 10  // fire within 10-minute window (matches cron interval)

    for (const [category, settings] of Object.entries(schedule)) {
      if (!settings || !settings.enabled) continue

      for (const timeStr of (settings.times || [])) {
        const [h, m] = timeStr.split(':').map(Number)
        const scheduledMinutes = h * 60 + m

        if (nowMinutes < scheduledMinutes || nowMinutes >= scheduledMinutes + WINDOW) continue
        if ((firedToday[category] || []).includes(timeStr)) continue

        const payload = JSON.stringify({
          title: 'Time to Stretch! 🙌',
          body: category === 'carpal'
            ? 'Quick hand & wrist stretch — takes just 5 minutes.'
            : 'Daily leg & foot stretch — your body will thank you.',
          category
        })

        try {
          await sendPush(subscription, payload, env.VAPID_PRIVATE_KEY, env.VAPID_EMAIL)
          firedToday[category] = [...(firedToday[category] || []), timeStr]
          changed = true
          console.log(`Sent ${category} notification for ${timeStr}`)
        } catch (e) {
          console.error(`Failed to send ${category} push:`, e.message)
        }
      }
    }

    if (changed) {
      await env.STRETCH_KV.put(firedKey, JSON.stringify(firedToday), {
        expirationTtl: 172800  // expire after 48 hours
      })
    }
  }
}
