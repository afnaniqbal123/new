# WhatsApp

Customer conversations, and the pipeline that turns a message into a draft
order.

## What it owns

| Collection      | What it is                                             |
| --------------- | ------------------------------------------------------ |
| `Conversation`  | One thread with one phone number, and its messages      |
| `DraftOrder`    | A proposed order awaiting a human's confirmation        |

## The pipeline

```
inbound message → AI extracts items → deterministic matcher → priced draft
                → human confirms → SalesService.completeSale
```

A draft order **never becomes a sale on its own**. Confirmation is a human
action, and only then does the ordinary sales path run — with the same credit
check, stock check and invoice allocation as a counter sale. That is the point
of the draft existing at all.

## Two transports, one pipeline

`WhatsAppCloudProvider` talks to Meta. The simulator (`POST /whatsapp/simulate`)
pushes a message through **the same `handleInbound`**, so the entire feature is
exercisable with no credentials — see `docs/CREDENTIALS.md` § WhatsApp. When a
real token lands it is an env change, not a build (CONTEXT.md D10).

## Webhook security

`whatsapp-webhook.controller.ts`:

- **GET** answers Meta's verification challenge, comparing `hub.verify_token`
  against `WHATSAPP_VERIFY_TOKEN`.
- **POST** verifies `X-Hub-Signature-256` — HMAC-SHA256 over the **raw body**,
  compared with `timingSafeEqual`. A `===` comparison leaks how much of a
  guessed signature was right; a parsed-then-restringified body produces a
  different hash than the one Meta signed.
- With no `WHATSAPP_APP_SECRET` configured, verification returns false and the
  request is rejected. That is the safe failure: an unsigned webhook is
  indistinguishable from an attacker who learned the URL.
- A rejected or failed webhook still returns 200. Meta disables an endpoint
  that errors repeatedly, and a disabled endpoint loses real orders.

## Idempotency

Meta retries. Every message is keyed on `waMessageId` with a **partial** unique
index — partial rather than sparse, because a sparse compound index only skips
a document when *every* indexed field is missing, so two simulated messages
with no `waMessageId` collided on `null`.

## The 24-hour window

Free-form messages are only valid within 24 hours of the customer's last
message; outside it Meta requires an approved template. `SESSION_WINDOW_MS`
tracks this, and the check lives in the service rather than the provider,
because it is a business rule rather than a transport concern.
