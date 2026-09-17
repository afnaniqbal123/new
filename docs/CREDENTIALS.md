# Getting the keys

Everything in BusinessOS runs **without a single one of these**. That was a
deliberate design constraint, not a coincidence: no credential is a blocker, so
you can demo the whole product today and connect real services in whatever
order they become available.

What you lose without each key is listed under "What works without it" — read
that first and decide whether you actually need the key yet.

Every value below goes in **`BE/.env`** (copy `BE/.env.example` if you have not
already), and the backend must be restarted afterwards. None of them belong in
`FE/.env.local` — a browser bundle is public, and a secret in it is a leaked
secret.

| Service | Blocks anything? | Free? | Time |
| --- | --- | --- | --- |
| [Gemini](#1-gemini-the-ai-clerk) | No | Yes, generous free tier | ~2 min |
| [Cloudinary](#2-cloudinary-image-uploads) | No | Yes | ~5 min |
| [Brevo](#3-brevo-outgoing-email) | No | Yes, 300 emails/day | ~10 min |
| [WhatsApp Cloud API](#4-whatsapp-cloud-api) | No | Yes for testing | ~30 min |
| [Stripe](#5-stripe-saas-billing) | No | Test mode is free | ~15 min |
| [Redis](#6-redis-background-jobs) | No | Yes | ~5 min |

---

## 1. Gemini (the AI clerk)

**What works without it:** everything except the "AI Business Clerk" page and
the automatic reading of WhatsApp messages into draft orders. The clerk page
says so plainly rather than erroring. Crucially, **no arithmetic depends on
this key** — the AI decides which report to run and how to read a sentence;
every figure is computed by code either way (CONTEXT.md D7).

**Steps**

1. Go to <https://aistudio.google.com/app/apikey> and sign in with a Google
   account.
2. Click **Create API key**. Pick an existing Google Cloud project, or let it
   create one.
3. Copy the key — it starts with `AIza`.
4. Put it in `BE/.env`:

   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-2.0-flash
   ```

5. Restart the backend. The clerk page stops showing its "not set up" notice.

**Notes**

- The free tier is rate-limited per minute, not per month. That is ample for
  one business; a busy multi-tenant deployment wants a paid key.
- `GEMINI_MODEL` is deliberately a variable. `gemini-2.0-flash` is the cheap,
  fast default; swapping it is an env change, not a code change.

---

## 2. Cloudinary (image uploads)

**What works without it:** everything except uploading a product photo or a
business logo.

**Steps**

1. Sign up at <https://cloudinary.com/users/register_free>.
2. On the dashboard, find **Product Environment Credentials** — it shows
   *Cloud name*, *API Key* and *API Secret* (click the eye icon to reveal it).
3. Put them in `BE/.env`:

   ```
   MEDIA_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=123456789012345
   CLOUDINARY_API_SECRET=...
   CLOUDINARY_FOLDER=businessos
   ```

**Using AWS S3 instead:** set `MEDIA_PROVIDER=s3` and fill in
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME`.
Both providers are fully implemented; presigned-upload routes are S3-only.
Cloudinary is the recommendation purely because its free tier is real.

---

## 3. Brevo (outgoing email)

**What works without it:** everything except emails actually leaving the
building — password resets, signup OTPs and invitations are generated and
logged but not delivered. For a single-owner demo you can read the OTP from the
backend log.

**Steps**

1. Sign up at <https://www.brevo.com>.
2. **SMTP & API** → **API Keys** → **Generate a new API key**.
3. Verify the sender address you intend to send from (Brevo will not send from
   an unverified one): **Senders, Domains & Dedicated IPs** → **Senders**.
4. Put them in `BE/.env`:

   ```
   EMAIL_PROVIDER=brevo
   EMAIL_API_KEY=xkeysib-...
   EMAIL_SENDER=you@yourdomain.com
   EMAIL_SENDER_NAME=Your Business
   EMAIL_LOGO_URL=https://.../logo.png
   ```

`EMAIL_LOGO_URL` should be a public HTTPS image. Without it the logo falls back
to a `data:` URI that Gmail refuses to render.

---

## 4. WhatsApp Cloud API

This is the longest one, so: **the entire WhatsApp feature works before you
start**. The simulator on the WhatsApp screen pushes a message through the real
ingestion pipeline — signature handling aside, it is the same code path a real
message takes: parse → match products → price → draft order → confirm. You are
not building toward a demo here; you are swapping a simulated transport for a
real one.

**What works without it:** everything, using the simulator. What you gain is
real customers being able to message you.

### 4a. Create the Meta app

1. Go to <https://developers.facebook.com/> and log in with a Facebook account.
2. **My Apps** → **Create App**.
3. Choose use case **Other**, then type **Business**.
4. Name it, pick or create a Business Portfolio, and create the app.
5. On the app dashboard, find **WhatsApp** and click **Set up**.

### 4b. Get the phone number id and a token

1. In the left sidebar: **WhatsApp** → **API Setup**.
2. Meta gives you a free **test number** immediately. Under *From*, copy the
   **Phone number ID** — a long numeric id. **This is not the phone number**;
   the variable wants the id.
3. Copy the **temporary access token** shown on the same page. It expires in 24
   hours — fine for a first test, see 4e for the permanent one.
4. Under *To*, add your own WhatsApp number as a recipient and verify the code.
   A test number can only message numbers on this list.

```
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
```

### 4c. The app secret

1. **App settings** → **Basic**.
2. Next to **App secret**, click **Show**, and copy it.

```
WHATSAPP_APP_SECRET=...
```

This one is not optional in spirit even though the app starts without it: it is
what verifies the `X-Hub-Signature-256` header on every incoming webhook. With
no secret configured, the backend refuses unsigned webhooks rather than
trusting them — which is the safe failure, but it means real messages will not
arrive until you set it.

### 4d. Point the webhook at your machine

Meta must reach your backend over public HTTPS, so a local server needs a
tunnel.

1. Install and run one — for example:

   ```bash
   npx localtunnel --port 8080
   # or: ngrok http 8080
   ```

   Copy the HTTPS URL it prints, e.g. `https://tidy-cats-smile.loca.lt`.

2. Invent a verify token. Any string; it is a shared secret between you and
   Meta, nothing more:

   ```
   WHATSAPP_VERIFY_TOKEN=some-long-random-string-you-choose
   ```

3. **Restart the backend** so it knows the verify token before Meta calls.

4. In the Meta dashboard: **WhatsApp** → **Configuration** → **Webhook** →
   **Edit**.
   - **Callback URL:** `https://your-tunnel-url/whatsapp/webhook`
   - **Verify token:** exactly what you put in `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save**. Meta calls your URL immediately; if the token
     matches, it saves.

5. Still on **Configuration**, click **Manage** next to Webhook fields and
   subscribe to **messages**.

6. Send a WhatsApp message from the number you added in 4b to the test number.
   It should appear in the app's WhatsApp inbox within a second or two.

If verification fails, check in this order: the tunnel is still running; the
URL ends in `/whatsapp/webhook`; the backend was restarted after the token was
added; the token has no trailing space.

### 4e. A token that does not expire

The 24-hour token is fine for testing. For anything lasting:

1. <https://business.facebook.com/settings/system-users> → **Add** → create a
   system user with the **Admin** role.
2. **Add Assets** → your app → toggle **Full control**.
3. **Generate new token** → select your app → tick `whatsapp_business_messaging`
   and `whatsapp_business_management` → set expiry to **Never**.
4. Replace `WHATSAPP_ACCESS_TOKEN` with it.

### 4f. Your own number instead of the test number

The test number cannot message arbitrary people. To go live you need a real
number added under **WhatsApp** → **API Setup** → **Add phone number**, a
verified business, and message templates approved for anything you send first
(replies within 24 hours of a customer's message need no template). That is a
Meta business-verification process, not a code change — the same environment
variables apply, with a different phone number id.

---

## 5. Stripe (SaaS billing)

**What works without it:** everything. The billing page lists the plans and
says billing is not configured; no feature is gated behind a subscription in
this build.

**Steps**

1. Sign up at <https://dashboard.stripe.com/register>. Stay in **Test mode**
   (the toggle in the dashboard header) — test keys begin with `sk_test_`.
2. **Developers** → **API keys**: copy the **Secret key** and **Publishable
   key**.

   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

3. **Product catalogue** → **Add product**. Create one product per paid plan
   (Starter, Business), each with a **recurring monthly** price. Open each
   price and copy its id (`price_...`):

   ```
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_BUSINESS=price_...
   ```

4. Webhook, so subscription changes reach the app:

   ```bash
   stripe login
   stripe listen --forward-to localhost:8080/billing/webhook
   ```

   It prints a signing secret (`whsec_...`):

   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

   In production, create the endpoint under **Developers** → **Webhooks**
   instead, pointed at `https://your-api/billing/webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated` and
   `customer.subscription.deleted`.

5. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

---

## 6. Redis (background jobs)

**What works without it:** everything, including the daily digests and
reminders — they just run inside the API process. What you lose is retries,
survival across restarts, and the ability to run more than one instance
(each would run every scheduled job). CONTEXT.md D13.

**Local:**

```bash
brew install redis && brew services start redis
```

```
REDIS_URL=redis://127.0.0.1:6379
```

**Free hosted:** <https://upstash.com> gives a free Redis with a TLS URL —
paste it as `REDIS_URL` unchanged (`rediss://...`).

---

## Checking what is actually configured

The backend says so at startup. Warnings like these are **normal and harmless**
on a fresh install — each one names what degrades, and nothing stops:

```
WARN [StripeService] STRIPE_SECRET_KEY is not set — billing is disabled.
WARN [JobRunnerService] REDIS_URL is not set — background jobs run in-process.
```

In the app itself: **Settings → WhatsApp** shows the connection state, and the
**AI Clerk** page says whether the model is reachable.

## Security

- `BE/.env` is git-ignored. Keep it that way; never commit a real key.
- If a key leaks, rotate it at the provider — every one of the services above
  lets you revoke and reissue.
- Anything in `FE/.env.local` ships to the browser in plain text. Only public
  values (the API base URL, a Stripe *publishable* key) belong there.
- Use test/sandbox credentials until you are genuinely taking money.
