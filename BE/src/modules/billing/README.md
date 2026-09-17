# Billing

SaaS subscription billing — plans, checkout, and the webhook that grants them.

## Scope, precisely

This bills the **distributor** for using BusinessOS. It does **not** process
the distributor's own customer payments: those settle in cash and bank
transfer, and card acquiring on someone else's behalf is a different, licensed
product (CONTEXT.md D12).

## Plans

`constants/billing.constant.ts` holds the plans, their limits, and the env key
holding each one's Stripe price id. Limits are enforced server-side by
`PlanLimitGuard`, reading the same table the pricing page renders from — so the
page and the guard cannot drift.

Price ids live in the environment, not in code: they differ between a test
account and a live one, and hardcoding either guarantees the wrong one ships.

## Only the webhook grants a plan

A successful checkout **redirect is not proof of payment**. The URL is
guessable, and a user who closes the tab mid-payment still lands on it. Only
`handleWebhook`, verified against Stripe's signature, moves an organization
onto a paid plan; the redirect says "thanks, this may take a moment".

The organization id travels in `client_reference_id` and in metadata, so the
webhook identifies the tenant without trusting anything the browser sends back.

## Without Stripe configured

Every endpoint still answers. Plans render with `purchasable: false`, the UI
says billing is not set up, and no feature is gated. `StripeService` warns at
startup rather than refusing to boot — see `docs/CREDENTIALS.md` § Stripe.

## Relationship to the `stripe` module

`../stripe/` owns the SDK. Nothing here imports `stripe` directly; it calls
`StripeService` and receives normalized `StripeSubscriptionEvent` values. That
keeps a vendor SDK's types out of the domain, and means a provider change is
one module's problem.
