# Design Guide — FE Demo App HTML

This is a **real application UI**, not a developer tool. A frontend dev should mistake the
happy path for an actual product for the first few seconds — clean login screen, real chat
window, real checkout form — before noticing it's also a self-contained test harness. Don't
default to a three-pane docs-browser layout, and don't default to a purple-gradient-SaaS-
template look either. Pick a restrained, specific visual identity and hold it across every
screen.

## App shell layout

```
┌────────────────────────────────────────────────────────────────┐
│ Top bar: brand · [ Connection ▾ ] (collapsed base-url/token)    │
├───────────┬────────────────────────────────────────────────────┤
│ Nav        │  Active screen (Login / Chat / Billing / …)         │
│ Home       │                                                     │
│ Login      │  Real components: forms, tables, chat window,      │
│ Profile    │  modals — not JSON tabs.                            │
│ Chat       │                                                     │
│ Team       │                                            ┌──────┐│
│ Billing    │                                            │ help ││ ← floating
│ Media      │                                            │  💬  ││   assistant
│ ⋯          │                                            └──────┘│   button
│ API        │                                                     │
│ Explorer   │                                                     │
└───────────┴────────────────────────────────────────────────────┘
```

Nav ~230px, collapsible to a top drawer under ~760px. The **Connection bar** (base URL +
bearer token) starts collapsed — one click/tap expands it — since it's setup, not the point of
the page; don't let it dominate the top of every screen the way a playground's config bar
would. The floating assistant button (if the API has a chat/support endpoint) is fixed
bottom-right on every screen, above all other content, opening a modal or slide-in drawer.

**API Explorer** is a normal nav item, last in the list, not a separate mode — inside it, the
old three-pane docs-tool layout (sidebar of endpoints, Docs/Request/Try it/Response tabs) is
appropriate, since that section's job really is raw endpoint browsing. Keep that part
information-dense and tool-like; keep every other screen product-like.

**Module Workspace** items sit in the nav between the bespoke screens and the Explorer, one per
module that didn't get a hand-built screen — they must still look like the rest of the app (see
below), not like a demoted version of the Explorer.

## Tokens

Pick real values per project (don't reuse these verbatim) but keep this shape:

- **Color**: one neutral background scale (near-white or near-black base, your call based on
  project vibe), one accent for primary actions/active nav/links, semantic colors for success/
  error/warning states (form validation, payment status, connection status), and — inside the
  API Explorer only — the usual HTTP-method and status-code badge colors.
- **Type**: a clean sans for the whole app (`-apple-system, "Segoe UI", Helvetica, Arial,
sans-serif` or similar) — this is product UI, not a code tool, so sans leads. Reserve
  monospace for genuinely code-shaped content: the Explorer's JSON views, IDs/tokens shown to
  copy.
- **Density**: comfortable, not cramped — real forms need label/input spacing, real tables need
  row height a human can click accurately. The Explorer can be denser than the rest of the app.
- **Motion**: purposeful micro-interactions belong here in a way they wouldn't in a pure dev
  tool — a modal that scales/fades in, a toast that slides in, a chat bubble that appears with
  a slight rise, a button's loading spinner. Keep it quick (150–250ms) and consistent; nothing
  decorative or bouncy.

## Screen-specific patterns

- **Auth (login/signup/forgot/reset)**: centered card on a simple background, real labeled
  inputs with inline validation messages (not just red borders), a primary submit button with
  a loading state, a link between login/signup, error banners rendered from real API error
  responses (not generic "something went wrong").
- **Chat**: two-pane (conversation list + thread) on wide viewports, single-pane with
  back-navigation on narrow ones. Bubbles: sender's own messages right-aligned + accent-filled,
  others left-aligned + neutral, small avatar/initials circle per sender, timestamp on hover or
  below in muted text.
- **Floating assistant**: a circular FAB, bottom-right, ~52px, with a subtle shadow so it
  visibly floats above content; opens a modal (centered, ~420px wide) or a drawer sliding from
  the right — pick one and use it consistently. Its own mini chat thread inside, same bubble
  language as the main Chat screen at smaller scale.
- **Team/Admin table**: search input above the table, sticky header row, role/status shown as
  small colored badges (not raw enum strings), row hover state, an overflow (⋯) menu or inline
  buttons for row actions that open a modal rather than navigating away.
- **Billing**: card-style sections (current plan, payment methods, checkout form) rather than
  one long form. A visible "Use test card" quick-fill button next to the card number field.
  Status badges for subscription/payment state use the same success/warning/error palette as
  everywhere else, not ad-hoc colors.
- **Media/uploads**: a dashed-border dropzone with a file-picker fallback, thumbnail preview
  once a file is chosen, a progress bar or spinner during upload, a success check + the
  resulting URL shown copyable once done.
- **Notifications**: a bell icon in the top bar with a small numeric badge; click opens a
  dropdown panel (not a full page) listing recent items, each with a read/unread visual state.
- **Chat "new conversation" / any entity picker**: a modal — search input at top (debounced,
  ~250ms), scrollable result list below with an avatar + one or two lines per row, simple
  prev/next pagination controls under the list, click a row to select. This is the same modal
  shape for every picker in the app (chat contacts, assign-to-user, etc.) — keep it visually
  identical each time so it reads as one system, not a one-off per screen.
- **Billing provider tabs**: a simple tab strip (not a dropdown) at the top of the Billing
  screen when more than one payment provider exists — each tab swaps the plans/cards/checkout
  content below it, but the surrounding card/section layout stays the same shape across
  providers so switching tabs doesn't feel like a different app.
- **Mock checkout screen**: styled like a real hosted checkout page would be — centered card,
  a card-number field prefilled with the provider's well-known test number, a prominent pay
  button — but with an unmissable `MOCK CHECKOUT` label at the top so nobody mistakes it for the
  real provider's page. This is what opens when a checkout action can't get a real redirect URL
  (mock mode / unreachable backend); it must never claim a payment "succeeded" against a real
  provider.
- **Avatar upload**: the current avatar (or an initials circle if none) shown large (~72px) at
  the top of the form, a small "Change avatar" button beneath/beside it opens the file picker,
  the image swaps to a local preview the instant a file is chosen — before the upload call even
  starts.
- **Module Workspace**: a responsive card grid (one card per endpoint in that module), each card
  a mini version of the same form language as the rest of the app — labeled inputs, a primary
  button, a result area below using the same table/JSON-viewer/tag treatment as everywhere else.
  This keeps generated screens visually indistinguishable from hand-built ones at a glance.
- **Step diagram**: small horizontal numbered-dot stepper with connecting lines, done steps
  filled/checked, the active step highlighted in the accent color, future steps muted — used
  above any flow that's genuinely more than one call (OTP verification, checkout, presigned
  upload) so the shape of the flow reads at a glance.

## States that matter (same discipline as a dev tool, applied to product UI)

- **Loading**: buttons show a spinner and disable themselves, not just "look the same but do
  nothing" — every submit action needs a visible pending state.
- **Live vs mock**: never let a mock response impersonate a real one. A small, consistent
  `MOCK` tag/badge appears wherever mocked data is shown — in a chat bubble, a table, a
  toast — not just in the API Explorer's response viewer.
- **Error**: form-level errors render inline near the relevant field or as a dismissible banner
  at the top of the screen/modal, using real messages from the API's error responses where
  available.
- **Empty states**: an empty chat thread, an empty notifications panel, an empty team table all
  get a short, specific empty-state message — not a blank void.
- **No base URL set**: the whole app should still be fully explorable in mock mode — don't
  gate screens behind "connect first." Show a small persistent indicator (e.g. in the
  Connection bar) that you're in mock mode.

## Accessibility / robustness baseline

Keyboard-navigable nav, forms, modals (focus trap + Escape to close), visible focus rings,
sufficient contrast, `prefers-color-scheme` respected as the default theme (with a manual
toggle override), responsive down to ~375px width — the chat and admin-table screens are the
ones most likely to break first on narrow viewports, so check those specifically.
