/**
 * StretchTracker Push Server — Cloudflare Worker
 * No npm dependencies — uses Web Crypto API natively.
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

const VAPID_PUBLIC_KEY = 'BNimBpl8w_y9e3H4x3SCgV27YuL3LdLjonXxYUNeR6o_bPUsFT954P6vASM21VYn2qKay5aXDuQj8g27uw8rvQ8'

// ── Base64url helpers ─────────────────────────────────────────────────────────

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  return Uint8Array.from(atob((str + pad).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}

function concat(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

// ── VAPID JWT ─────────────────────────────────────────────────────────────────

async function vapidHeaders(endpoint, vapidPrivateKeyB64, email) {
  const aud = new URL(endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 43200 // 12 hours

  const enc = new TextEncoder()
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(enc.encode(JSON.stringify({ aud, exp, sub: email })))
  const unsigned = `${header}.${claims}`

  // Build PKCS8 DER from raw private key scalar
  // ECPrivateKey (RFC 5915) wrapped in PKCS8 (RFC 5958) with P-256 OID
  const privBytes = b64urlDecode(vapidPrivateKeyB64)
  const pubBytes  = b64urlDecode(VAPID_PUBLIC_KEY)
  // ECPrivateKey ::= SEQUENCE { version INTEGER(1), privateKey OCTET STRING, publicKey [1] BIT STRING }
  const ecPrivKey = concat(
    new Uint8Array([0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20]),  // SEQUENCE(107), version=1, OCTET STRING(32)
    privBytes,
    new Uint8Array([0xa1, 0x44, 0x03, 0x42, 0x00]),               // [1](68), BIT STRING(66), 0 unused bits
    pubBytes
  )
  // PKCS8 AlgorithmIdentifier for id-ecPublicKey + secp256r1 OID
  const pkcs8 = concat(
    new Uint8Array([
      0x30, 0x81, 0x87,              // SEQUENCE
      0x02, 0x01, 0x00,              // version = 0
      0x30, 0x13,                    // AlgorithmIdentifier SEQUENCE
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // id-ecPublicKey OID
        0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // secp256r1 OID
      0x04, 0x6d,                    // OCTET STRING wrapping ECPrivateKey
    ]),
    ecPrivKey
  )

  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned))

  return {
    Authorization: `vapid t=${unsigned}.${b64url(sig)}, k=${VAPID_PUBLIC_KEY}`,
    'Content-Type': 'application/octet-stream'
  }
}

// ── HKDF (single block, length ≤ 32 bytes) ───────────────────────────────────

async function hkdf(hash, salt, ikm, info, length) {
  const saltKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash }, false, ['sign'])
  const prk     = await crypto.subtle.sign('HMAC', saltKey, ikm)
  const prkKey  = await crypto.subtle.importKey('raw', prk,  { name: 'HMAC', hash }, false, ['sign'])
  const t       = await crypto.subtle.sign('HMAC', prkKey, info)
  return new Uint8Array(t).slice(0, length)
}

// ── Web Push message encryption (RFC 8291 / aesgcm) ──────────────────────────

function buildInfo(type, recipientPub, senderPub) {
  const enc    = new TextEncoder()
  const prefix = enc.encode(`Content-Encoding: ${type}\0P-256\0`)
  const rLen   = new Uint8Array(2); new DataView(rLen.buffer).setUint16(0, recipientPub.length, false)
  const sLen   = new Uint8Array(2); new DataView(sLen.buffer).setUint16(0, senderPub.length,    false)
  return concat(prefix, rLen, recipientPub, sLen, senderPub)
}

async function encryptPayload(subscriptionKeys, plaintext) {
  const enc       = new TextEncoder()
  const p256dh    = b64urlDecode(subscriptionKeys.p256dh)
  const auth      = b64urlDecode(subscriptionKeys.auth)
  const payload   = enc.encode(plaintext)

  // Ephemeral sender key pair
  const senderKeys   = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const recipientPub = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits   = await crypto.subtle.deriveBits({ name: 'ECDH', public: recipientPub }, senderKeys.privateKey, 256)
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey))

  // PRK = HKDF(salt=auth, ikm=shared, info="Content-Encoding: auth\0" || 0x01, L=32)
  const prk = await hkdf('SHA-256', auth, new Uint8Array(sharedBits),
    concat(enc.encode('Content-Encoding: auth\0'), new Uint8Array([1])), 32)

  const salt     = crypto.getRandomValues(new Uint8Array(16))
  const keyInfo  = buildInfo('aesgcm', p256dh, senderPubRaw)
  const nonceInfo = buildInfo('nonce',  p256dh, senderPubRaw)

  // CEK and nonce — note: keyInfo/nonceInfo are already Uint8Arrays, no encode() needed
  const cek   = await hkdf('SHA-256', salt, prk, concat(keyInfo,   new Uint8Array([1])), 16)
  const nonce = await hkdf('SHA-256', salt, prk, concat(nonceInfo, new Uint8Array([1])), 12)

  // Pad: uint16_be(0) || plaintext
  const padded = new Uint8Array(2 + payload.length)
  new DataView(padded.buffer).setUint16(0, 0, false)
  padded.set(payload, 2)

  const aesKey    = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt'])
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded))

  return { encrypted, salt, senderPubRaw }
}

// ── Send a Web Push message ───────────────────────────────────────────────────

async function sendPush(subscription, payload, vapidPrivateKey, vapidEmail) {
  const { endpoint, keys } = subscription
  const { encrypted, salt, senderPubRaw } = await encryptPayload(keys, payload)
  const headers = await vapidHeaders(endpoint, vapidPrivateKey, vapidEmail)

  headers['Content-Encoding'] = 'aesgcm'
  headers['Encryption']       = `salt=${b64url(salt)}`
  headers['Crypto-Key']       = `dh=${b64url(senderPubRaw)}; p256ecdsa=${VAPID_PUBLIC_KEY}`
  headers['Content-Length']   = String(encrypted.length)
  headers['TTL']              = '2419200'

  const res = await fetch(endpoint, { method: 'POST', headers, body: encrypted })
  if (!res.ok) throw new Error(`Push failed ${res.status}: ${await res.text()}`)
  return res
}

// ── CORS + JSON helpers ───────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ── Worker entry ──────────────────────────────────────────────────────────────

export default {

  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true })

    if (request.method === 'POST' && url.pathname === '/subscribe') {
      try {
        const { subscription, schedule, timezone } = await request.json()
        if (!subscription?.endpoint || !subscription?.keys) return json({ error: 'Invalid subscription' }, 400)
        await env.STRETCH_KV.put('subscription', JSON.stringify(subscription))
        await env.STRETCH_KV.put('schedule',     JSON.stringify(schedule || {}))
        await env.STRETCH_KV.put('timezone',     timezone || 'UTC')
        return json({ ok: true })
      } catch (e) { return json({ error: e.message }, 500) }
    }

    if (request.method === 'PUT' && url.pathname === '/schedule') {
      try {
        const { schedule } = await request.json()
        await env.STRETCH_KV.put('schedule', JSON.stringify(schedule))
        return json({ ok: true })
      } catch (e) { return json({ error: e.message }, 500) }
    }

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(event, env) {
    const [subscriptionStr, scheduleStr, timezone] = await Promise.all([
      env.STRETCH_KV.get('subscription'),
      env.STRETCH_KV.get('schedule'),
      env.STRETCH_KV.get('timezone')
    ])
    if (!subscriptionStr || !scheduleStr) return

    const subscription = JSON.parse(subscriptionStr)
    const schedule     = JSON.parse(scheduleStr)
    const tz           = timezone || 'UTC'

    // Local time in user's timezone
    const now  = new Date()
    const fmt  = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now)
    const get       = type => fmt.find(p => p.type === type).value
    const nowMin    = parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10)
    const localDate = `${get('year')}-${get('month')}-${get('day')}`

    const firedKey = `fired_${localDate}`
    const firedToday = JSON.parse(await env.STRETCH_KV.get(firedKey) || '{"carpal":[],"legs":[]}')

    let changed = false

    for (const [category, settings] of Object.entries(schedule)) {
      if (!settings?.enabled) continue
      for (const timeStr of (settings.times || [])) {
        const [h, m] = timeStr.split(':').map(Number)
        const slotMin = h * 60 + m
        if (nowMin < slotMin || nowMin >= slotMin + 1) continue
        if ((firedToday[category] || []).includes(timeStr)) continue

        const payload = JSON.stringify({
          title: 'Time to Stretch! 🙌',
          body:  category === 'carpal'
            ? 'Quick hand & wrist stretch — takes just 5 minutes.'
            : 'Daily leg & foot stretch — your body will thank you.',
          category
        })

        try {
          await sendPush(subscription, payload, env.VAPID_PRIVATE_KEY, env.VAPID_EMAIL)
          firedToday[category] = [...(firedToday[category] || []), timeStr]
          changed = true
          console.log(`Sent ${category} notification for ${timeStr} (${tz})`)
        } catch (e) {
          console.error(`Push failed for ${category} ${timeStr}:`, e.message)
        }
      }
    }

    if (changed) {
      await env.STRETCH_KV.put(firedKey, JSON.stringify(firedToday), { expirationTtl: 172800 })
    }
  }
}
