# Stripe Module

Payment processing through Stripe: one-off payments, saved cards, recurring
subscriptions, invoices, and the webhook that keeps local state in sync with
Stripe's.

## Layout

This is a **compound module**. `StripeModule` is a thin base that owns nothing
but the SDK client; each capability is a separate sub-module that imports it.

```
stripe/
├── stripe.module.ts        # base — provides & exports StripeService only
├── stripe.service.ts       # SDK client + customer resolution
├── card/                   # saved payment methods
├── payment/                # one-off payments
├── subscription/           # recurring billing
├── invoice/                # invoices
├── webhook/                # inbound Stripe events
└── constants/api-response/stripe.response.ts
```

Import `StripeModule` anywhere you need the raw client; import the specific
sub-module when you need its endpoints.

## StripeService (the shared piece)

| Method                            | Purpose                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getStripeClient()`               | The configured `Stripe` SDK instance.                                                                                                                     |
| `getOrCreateStripeCustomer(user)` | Returns the user's Stripe customer, creating it on first use. Every other sub-module goes through this so a user never ends up with two customer records. |

The client is built in `onModuleInit()` from `CONFIG.STRIPE_SECRET_KEY`.

## Endpoints

All routes below require a bearer token — authentication is global, so they
carry no guard decorator — except the webhook, which is marked `@Public()` and
authenticated by Stripe's signature instead. See
[`docs/architecture/security/authentication.md`](../../../docs/architecture/security/authentication.md).

### Cards — `/stripe/cards`

| Method   | Path           | Purpose                                    |
| -------- | -------------- | ------------------------------------------ |
| `POST`   | `/`            | Attach a card to the authenticated user.   |
| `GET`    | `/`            | List the user's cards.                     |
| `GET`    | `/all`         | List all cards (administrative).           |
| `DELETE` | `/:id`         | Detach a card.                             |
| `PATCH`  | `/:id/default` | Mark a card as the default payment method. |

### Payments — `/stripe/payments`

| Method | Path                         | Purpose                                                                   |
| ------ | ---------------------------- | ------------------------------------------------------------------------- |
| `POST` | `/intent`                    | Create a PaymentIntent for a client-side confirmation flow.               |
| `GET`  | `/intent/:id`                | Read a PaymentIntent's current state.                                     |
| `POST` | `/checkout`                  | Create a hosted Checkout Session and return its URL.                      |
| `GET`  | `/verify-session/:sessionId` | Confirm a Checkout Session completed — call this after the redirect back. |

### Subscriptions — `/stripe/subscriptions`

| Method  | Path                 | Purpose                                            |
| ------- | -------------------- | -------------------------------------------------- |
| `POST`  | `/payment-sheet`     | Payment-sheet parameters for the mobile SDK.       |
| `POST`  | `/subscribe-mobile`  | Subscribe from a mobile client.                    |
| `POST`  | `/checkout`          | Hosted checkout for a subscription plan.           |
| `POST`  | `/intent`            | Subscription intent for a custom client-side flow. |
| `GET`   | `/`                  | The user's current subscription.                   |
| `GET`   | `/history`           | Every subscription the user has held.              |
| `GET`   | `/plans`             | Plans available to subscribe to.                   |
| `PATCH` | `/upgrade`           | Move to a higher plan.                             |
| `PATCH` | `/downgrade`         | Move to a lower plan.                              |
| `POST`  | `/cancel`            | Cancel (at period end unless stated otherwise).    |
| `POST`  | `/resume`            | Resume a subscription cancelled but not yet ended. |
| `GET`   | `/verify/:sessionId` | Confirm a subscription checkout completed.         |

### Invoices — `/stripe/invoices`

| Method | Path       | Purpose                  |
| ------ | ---------- | ------------------------ |
| `POST` | `/`        | Create an invoice.       |
| `GET`  | `/:id`     | Fetch one invoice.       |
| `POST` | `/pay/:id` | Pay an invoice manually. |

### Webhook — `/stripe/webhooks`

`POST /stripe/webhooks` receives Stripe events. It is marked `@Public()`, so
the global access guard stands aside: authenticity comes from the
`stripe-signature` header verified
against `CONFIG.STRIPE_WEBHOOK_SECRET`. This is also why the handler needs the
raw request body — do not "clean up" the raw-body handling here.

Events drive local subscription state, so if webhooks are not reaching the
service, subscription status will drift from Stripe's.

## Data owned by this module

| Schema                                             | Holds                                        |
| -------------------------------------------------- | -------------------------------------------- |
| `card/schemas/card.schema.ts`                      | Saved payment methods per user.              |
| `subscription/schemas/subscription.schema.ts`      | Plan catalogue.                              |
| `subscription/schemas/user-subscription.schema.ts` | Which user is on which plan, and its status. |
| `subscription/enums/subscription-status.enum.ts`   | Allowed subscription states.                 |

## Configuration

| Key                      | Used for                              |
| ------------------------ | ------------------------------------- |
| `STRIPE_SECRET_KEY`      | Server-side SDK authentication.       |
| `STRIPE_PUBLISHABLE_KEY` | Handed to clients for their SDK.      |
| `STRIPE_WEBHOOK_SECRET`  | Verifying inbound webhook signatures. |

Read them through `ConfigService.get<string>(CONFIG.KEY)` — never
`process.env`.
