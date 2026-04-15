# Push Server Setup Guide

This deploys a free Cloudflare Worker that sends Web Push notifications to your iPhone at scheduled times — even when the app is fully closed.

**Time to complete: ~15 minutes**

---

## Step 1 — Create a Cloudflare account

Go to [cloudflare.com](https://cloudflare.com) and sign up for free. No credit card required.

---

## Step 2 — Install Wrangler (Cloudflare CLI)

You already have Node.js installed. Run:

```
cd push-server
npm install
```

Then log in:

```
npx wrangler login
```

This opens a browser window. Approve the access.

---

## Step 3 — Create the KV namespace

```
npx wrangler kv namespace create STRETCH_KV
```

Copy the `id` from the output and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "STRETCH_KV"
id = "PASTE_YOUR_ID_HERE"
```

---

## Step 4 — Add your secrets

```
npx wrangler secret put VAPID_PRIVATE_KEY
```
When prompted, paste this value exactly:
```
Ni9DEJEtKdD-D-XkAQuMxpGSw1D1w3tZBL5HoQIRG9Y
```

```
npx wrangler secret put VAPID_EMAIL
```
When prompted, enter your email address (e.g. `mailto:you@gmail.com`)

---

## Step 5 — Deploy

```
npx wrangler deploy
```

The output will show your worker URL, e.g.:
```
https://stretch-tracker-push.YOUR-SUBDOMAIN.workers.dev
```

Copy that URL.

---

## Step 6 — Add the URL to the app

Open `js/notifications.js` and replace the placeholder on line 5:

```js
const PUSH_SERVER_URL = 'https://stretch-tracker-push.YOUR-SUBDOMAIN.workers.dev'
```

Then push to GitHub:
```
git add js/notifications.js
git commit -m "Add push server URL"
git push
```

---

## Step 7 — Subscribe your device

1. Open the app on your iPhone (from Home Screen, not Safari)
2. Go to **Settings**
3. Tap **Enable Background Push**
4. Done — notifications will now arrive even when the app is closed

---

## Verification

To test immediately:
1. In Settings → tap **Send Test Notification**
2. You should see a notification appear even if the app is in the background

To test the scheduled delivery:
1. Set a notification time 10-15 minutes from now in Settings
2. Lock your phone / close the app completely
3. The notification should arrive within 10 minutes of the scheduled time

---

## Troubleshooting

**"Enable Background Push" button shows "Failed"**
- Make sure you deployed the worker and copied the URL correctly to `js/notifications.js`
- Check `npx wrangler tail` for error logs

**Notifications arrive up to 10 minutes late**
- This is normal — the worker cron runs every 10 minutes. GitHub Actions runners can also add delay.

**Stopped receiving notifications**
- Your push subscription may have expired. Tap "Enable Background Push" again in Settings.
