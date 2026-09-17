# ADR 0007 — The product assistant is an unauthenticated endpoint with no data access

- **Status:** Accepted
- **Date:** 2026-09-13

## Context

The marketing page needed a floating assistant a visitor could ask about the
product — pricing, what the WhatsApp flow does, whether a cashier can see
margin. A visitor has no account, so the endpoint behind it cannot require one.

Every other route in this codebase is authenticated and tenant-scoped. ADR 0001
draws that boundary deliberately, and `AiController` sits well inside it:
`OrganizationAccessGuard` and `PermissionsGuard` are applied at the class level,
and its `ask` route runs a real report with the caller's own CASL ability so a
cashier asking about margin gets an honest refusal.

Adding a `@Public()` route to that controller would have been the small diff.
It would also have placed an unauthenticated handler among tenant-scoped ones,
protected only by nobody ever reordering a decorator or copy-pasting a
neighbouring method. That is the kind of arrangement that is correct on the day
it is written and a data leak two refactors later.

## Decision

A separate `PublicAssistantController` at `/assistant`, in its own file, with no
class-level guards and `@Public()` on each route. It depends on
`ProductAssistantService`, which:

- injects no model, repository or report service — it **cannot** read tenant
  data, because it has nothing to read it with;
- answers only from a hard-coded `KNOWLEDGE` array of facts about the product;
- passes those facts to the model in the prompt rather than asking it to recall
  them, so the model's job is selection and phrasing, never assertion.

This is the same division of labour as the business clerk (CONTEXT.md D9),
applied to marketing copy instead of to figures: the model chooses and phrases,
the code owns what is true.

The knowledge base doubles as the fallback. With no `GEMINI_API_KEY`, the
service scores the question against each entry's keywords and returns the best
match verbatim, so the widget answers either way.

## Consequences

**What it buys.** "This endpoint has no authentication" is a property of the
file, visible in its name and its imports, rather than a decorator two
screens up. The service's constructor is the proof that it cannot leak tenant
data — a reviewer does not have to trace call sites to be sure. And the public
surface stays honest about the product, because a model that cannot recall
cannot invent a feature or a price.

**What it costs.** Two controllers now exist in one module, which is one more
file than strictly necessary. Product claims live in a TypeScript array in the
backend rather than in a CMS, so changing the pricing copy is a deploy —
acceptable while the pricing itself is also hard-coded in
`billing.constant.ts`, and a reason to revisit both together rather than either
alone.

**What is deliberately not solved.** There is no rate limiting on this route
yet. `PLATFORM_ASSISTANT_RATE_LIMIT` exists in the environment but nothing
consumes it; a public endpoint that spends model quota should be throttled
before this is exposed to the internet. Tracked as follow-up, not shipped here.
