---
name: fe-api-guide
description: Generate a complete Frontend Integration package from a backend codebase, OpenAPI/Swagger spec, Postman collection, or API docs — three deliverables. (1) ONE single consolidated Markdown FE API guide covering every module/feature/flow in the whole API (never split per module). (2) One README.md per backend module explaining what that module does internally, written only where a module doesn't already have one. (3) ONE self-contained interactive HTML application — a real, professional-grade product, NOT a raw Swagger-style endpoint tester and NOT a curated subset with a JSON-dump fallback for the rest. Every single module gets a real UI section built from proper components (forms, tables, modals, chat bubbles, avatars, file uploaders with previews, step diagrams, provider tabs when multiple providers do the same job e.g. Stripe vs PayPal) and every flow that can genuinely be completed end-to-end in a browser IS completed end-to-end — real multipart avatar/file uploads, real user search-and-pick with pagination to start a conversation, real redirects to a live checkout URL (or an honestly-labeled simulated checkout screen in mock mode), not alerts or JSON dumps standing in for the real UX. Use whenever the user asks for an "API guide", "FE integration guide", "backend docs for frontend devs", "API playground", "demo app for our API", "endpoint reference", module READMEs, or a professional/production-quality frontend showcase of every module and endpoint so BE/FE devs can see and test every flow exactly the way a real frontend would integrate it — even phrased as "document our APIs for the frontend team," "make a testing page for all our endpoints," "show every module in the UI," or "build something FE devs can look at to see how integration should work."
---

# FE API Guide Generator

Produces three deliverables from one extracted module map.

**Read this whole file before writing any HTML.** The single most common way this skill fails is producing something that _looks_ like an app shell wrapped around a handful of screens, with everything else quietly demoted to a raw JSON tester. That is an explicit failure mode of this skill, not an acceptable simplification — see "The non-negotiables" below.

1. **One consolidated FE API guide** — a single `.md` file covering every module and every endpoint in the whole API. Never split this into one file per module.
2. **Per-module README.md files** — one per backend module, only where one doesn't already exist.
3. **One self-contained interactive HTML application** — a professional-grade product surface for the whole API. See Phase 4.

## The non-negotiables (read before Phase 4)

These are the specific ways a previous run of this skill fell short, kept here so they don't happen again:

1. **Every module in `modules.json` gets a real UI section — no exceptions, no "put it in the Explorer instead."** If the API has both a Stripe billing integration and a PayPal billing integration, the app shows **both**, side by side (tabs or a provider switcher) inside Billing — not just whichever one happened to get hand-built first. A raw endpoint-tester ("Explorer") is allowed to exist _in addition_, as a developer convenience for raw request/response poking, but it never substitutes for a module having its own real screen. If you catch yourself writing "the rest live in the Explorer" for anything other than truly screen-less infrastructure routes (webhook receivers, health checks), that's the failure mode — stop and give it a real section instead. See "Module Workspace" below for how to do this for every module without hand-authoring 16 bespoke screens from scratch.
2. **Multi-step flows that end outside your app must actually go there.** A "subscribe to this plan" or "pay this invoice" button that calls a checkout/order-creation endpoint and gets back a redirect URL must **actually redirect the browser to that URL** when running live (`window.location.href = session.url`). It is not acceptable to show the JSON response and call that "done" — that's the exact Swagger-tester behavior this skill exists to avoid. In mock mode there is nothing real to redirect to, so instead render an honest, clearly-`MOCK`-labeled simulated checkout screen (a modal styled like a payment page) so the _shape_ of the flow is still demonstrable — never fabricate a fake "payment succeeded" and never silently do nothing when a button is clicked.
3. **File uploads must be real multipart uploads, not JSON pretending to be one.** If a DTO/route is `multipart/form-data` (an avatar field, a file field), the corresponding form must build a real `FormData`, attach the actual chosen file, and submit it as multipart — with a live image preview before/after. Don't quietly downgrade a multipart endpoint to a JSON body with a fake filename string.
4. **"Pick an existing thing to act on" must use the real list/search endpoint, not a hardcoded array.** Starting a new chat with someone, assigning a role to a user, attaching an invoice to a customer — anywhere the user needs to choose an entity, wire a real search box (calling the real list endpoint with its actual query params) with real pagination controls if the endpoint supports paging. A hardcoded `mockRooms`-style array is only acceptable as the _mock-mode fallback content_ for that same real search UI, never as a replacement for building the search UI at all.
5. **"Working condition" means actually working, end to end, when clicked** — not "the button exists and shows a JSON response." Before presenting the file, mentally (or actually, via a headless browser) walk every primary button/form on every screen and confirm it does the real thing described above, in both live and mock mode.

## Phase 1 — Build the module map

Sources, roughly in order of how much you should trust them for exact shapes:

1. **OpenAPI/Swagger spec** (json/yaml) — read directly, it already has schemas, examples, auth. If the project can run locally and exposes a live spec (e.g. NestJS `SwaggerModule` at `/api-docs-json`, or an equivalent), booting it and fetching the spec beats reading annotations by hand — it's the actual runtime truth.
2. **Postman collection** (json export) — has real example requests/responses, very high signal.
3. **Backend source code** (routes/controllers, DTOs/serializers, validators, models, **and the service layer**) — read the actual route files, request validation, and response serialization. Don't guess field names — grep for them. Reading the service layer (not just controllers/DTOs) matters more for this skill than a plain API-reference skill would need, because Phase 3 (READMEs) and Phase 4 (the app) both need to know _business logic_, not just shapes: what a login response actually contains today, what a webhook handler actually does (or doesn't) do, what's hardcoded/TODO/disabled, whether a "create" DTO is multipart or JSON, whether a list endpoint supports `page`/`limit`/`search` for a picker UI.
4. **Existing docs / README / markdown** — use, but verify against code if code is also available; docs drift out of date.
5. **User's plain-language description in chat** — use as-is, but ask for payload shapes if truly unknown rather than inventing business-critical fields (e.g. payment amounts, auth tokens).

Read every file that plausibly defines a route before writing anything. For a codebase, this typically means: `grep -r` for router/route decorators (`@app.route`, `@router.get`, `router.post`, `app.get(`, controller annotations, etc.), then open each matched file, then follow into the request/response models it references. Don't stop at the first handful of endpoints — walk the whole routes directory tree.

For each endpoint/feature, capture into a structured list (build this as a working scratch file, e.g. a `modules.json` in the scratchpad directory, before touching HTML):

```json
{
  "module": "Auth",
  "features": [
    {
      "name": "Login",
      "method": "POST",
      "path": "/api/v1/auth/login",
      "description": "Authenticates a user with email + password, returns access and refresh tokens.",
      "auth_required": false,
      "headers": [{ "name": "Content-Type", "value": "application/json" }],
      "path_params": [],
      "query_params": [],
      "request_body": { "email": "user@example.com", "password": "••••••••" },
      "response_success": {
        "status": 200,
        "body": {
          "accessToken": "eyJ...",
          "refreshToken": "eyJ...",
          "user": { "id": 1, "email": "user@example.com" }
        }
      },
      "response_errors": [
        {
          "status": 401,
          "body": {
            "error": "invalid_credentials",
            "message": "Email or password is incorrect"
          }
        }
      ],
      "notes": "Rate limited to 5 attempts / 15 min per IP.",
      "response_kind": "object",
      "screen": "auth",
      "is_multipart": false,
      "is_redirect_flow": false,
      "list_query_support": null
    }
  ]
}
```

New fields for this skill's app-shaped output, beyond the basics:

- `screen` — which real-world screen/section this feature belongs to (see Module Workspace section — every `module` maps to at least one screen; there is no "no screen" escape hatch anymore, only "screen == its own module workspace").
- `is_multipart` — true if the route is `multipart/form-data` (file/avatar upload). Drives whether the generated form builds `FormData` or a JSON body.
- `is_redirect_flow` — true if a successful call returns a URL the user is meant to be sent to (checkout session URL, OAuth approval link, etc.). Drives the real-redirect-or-simulated-checkout behavior.
- `list_query_support` — for list endpoints, the real query params that support search/paging, e.g. `{ "search": "search", "page": "page", "limit": "limit" }`, or `null` if the endpoint doesn't paginate/search. Drives whether a picker UI gets a real search+pagination control.

`response_kind` drives which widget renders a raw response: `"list"` → table, `"timeseries"|"metrics"` → chart, `"chat"` → chat UI, otherwise plain JSON viewer.

Group features into modules the way the product actually breaks down, mirroring the real route/folder structure. When two modules are parallel providers for the same job (Stripe vs PayPal, SendGrid vs Postmark, etc.), keep them as separate `module` entries but note the pairing (e.g. a shared `provider_group: "billing"` tag) so Phase 4 knows to render them as tabs/switcher within one screen rather than as two unrelated nav items.

**Do not fabricate fields, status codes, or business logic you couldn't find.** If a piece of information genuinely isn't discoverable from the source, mark it `"TODO: confirm with backend"` in the notes rather than inventing a plausible-looking value. This applies just as much to Phase 4's UI copy as to raw payloads: don't invent a business rule to make a screen feel more real. If the source shows a gap (a webhook handler that's an empty stub, a guard that's commented out, a hardcoded test user id), the correct UI treatment is to _show that honestly_ (a note, a disabled-with-tooltip control, a visible MOCK badge) — never paper over it with invented working behavior.

If, after reasonable searching, the source material is too thin to produce real payload examples for a given endpoint, ask the user for that endpoint's shape rather than guessing at values that look load-bearing (money amounts, IDs with business meaning, auth scopes). Cosmetic gaps (a placeholder description) don't need to block — fill and move on.

## Phase 2 — Generate the FE API guide (single Markdown file)

One `.md` file, all modules included — never one file per module. Structure:

- **Title + one-paragraph intro**: what the API is, base URL(s)/environments if known, how auth works globally.
- **Table of contents**: linked, one entry per module, matching heading anchors.
- **One `##` section per module**, each containing one `###` subsection per endpoint/feature with, in order: method + path, one-line description, auth requirement, headers, path/query params (as a table when present), a fenced `json request body example, and fenced `json response examples for success and each documented error case, then any notes.
- Generate this programmatically from `modules.json` (loop, don't hand-type each section).

Save as a single file, e.g. `<project-name>-api-guide.md`.

## Phase 3 — Generate per-module README.md files (only where missing)

For each module identified in `modules.json`, check whether that module's directory already has a `README.md`. **If it does, skip it.** Only write one where it's genuinely missing.

Where you do write one: purpose, key flows/business logic, data models it owns, dependencies on/from other modules, auth model (call out disabled/TODO guards explicitly), known gaps/TODOs visible in source, and a link back to the FE API guide's section for this module. Keep it skimmable.

## Phase 4 — Generate the interactive application (a real product, not a docs tool)

Read `references/design-guide.md` for the visual system and `references/components.md` for the reusable HTML/CSS/JS building blocks, **including the Module Workspace pattern** — the mechanism that gets every module a real screen without hand-authoring dozens of bespoke UIs. Read both before writing HTML.

**The core idea:** a backend dev should be able to hand this single file to a frontend dev and have them go "oh, _that's_ how login/chat/payments/uploads are supposed to work" — because they're looking at a login screen, a chat window with a real "start a conversation" search, a checkout button that actually goes to checkout, an avatar uploader that actually uploads — not a JSON tree standing in for any of it.

### App shell

- A left nav with one entry per **screen**. Every `module` from `modules.json` resolves to a screen — either a bespoke hand-built one (Auth, Profile, Chat, Billing, Media, Team, Notifications — build whichever of these the API actually supports) or, for modules that don't fit those patterns (or that you don't have time to hand-build individually), a **Module Workspace** screen (see components reference) — a well-designed, form/table/card-based, fully generated screen that is still real product UI, never a raw tabs-of-JSON dump. Related modules that are parallel providers for the same job (Stripe vs PayPal billing, etc.) share one nav item with an in-screen provider switcher.
- **API Explorer** is still included, last in the nav, as a raw request/response debugging convenience — but it is additive, not a substitute for module coverage. Every module must be fully usable without ever opening the Explorer.
- A persistent small **Connection bar** (collapsed by default) holding base URL + bearer token — every screen's calls route through it.
- Session state in memory: a successful login/signup stores the token and flips the shell into a logged-in state (avatar/name in the top bar, auth-gated nav items unlock) — never make the user paste their own token back in after logging in through the UI.

### Screens — build every one the API supports, to this bar

- **Auth** — real login/signup/forgot-password forms, inline validation and real API error messages, a success transition into the app.
- **Profile** — pre-filled from "get current user," editable fields matching the update DTO. **If the update route is multipart with an avatar field, the avatar control must be a real file picker that builds `FormData`, shows a live preview, and submits the actual file** — not a text field, not a JSON body with a fake URL.
- **Chat**, if the API has messaging — room list + bubble thread as before, **plus a real "start a new conversation" flow**: a search box wired to the real user-list/search endpoint (with pagination if the endpoint supports it), results shown as a real list the user picks from, selecting one calls the real get-or-create-room endpoint and opens the thread. No hardcoded contact list standing in for this.
- **Assistant** floating button + modal, if there's an LLM/support endpoint.
- **Team/Admin**, if the API has user/org management — real searchable+paginated table, row actions open real edit/delete forms.
- **Billing**, if the API has payments/subscriptions/cards — **and if there is more than one payment provider (Stripe, PayPal, etc.), show all of them**, as tabs or a switcher within this one screen, each with its own plans/cards/checkout wired to its own real endpoints. Selecting a plan and confirming must call the real checkout/subscribe endpoint and then **actually navigate the browser to the returned URL in live mode**, or open a clearly-`MOCK`-labeled simulated checkout screen in mock mode (see non-negotiable #2). A "use test card" quick-fill is still good practice for any raw card-detail entry points the API has.
- **Media** — drag-and-drop/file-picker, live preview, and if it's a presigned-URL flow, perform both steps for real (get the signed URL, then PUT the file to it).
- **Notifications** — bell + panel, or a full screen if the API's notification surface is rich enough to deserve one (list, mark-read, filters) — use judgment based on how many endpoints the module has.
- **Module Workspace** (see components reference) for every other module — invoices, webhooks-as-an-explainer-panel, bulk admin ops, anything not covered above. This must still look and feel like the rest of the app (cards, real labeled forms generated from the DTO, real tables for list responses, a small step-diagram for anything that's genuinely a multi-step flow) — it is the fallback for _hand-authoring effort_, not a fallback to worse UX.

### API Explorer

Raw sidebar-of-endpoints + Docs/Request/Try it/Response tabs, grouped by module, for debugging/edge cases and anything genuinely screen-less (webhook receivers meant to be called by the provider, not a human; health checks). Keep it, but remember it does not count toward module coverage per the non-negotiables above.

### The engine underneath

- All live calls — from screens, Module Workspaces, and the Explorer alike — go through one `callApi(feature, overrides)` helper so base URL/auth/mock-fallback logic lives in exactly one place. It must support a multipart mode (real `FormData`, no `Content-Type` header override — let the browser set the multipart boundary) alongside the JSON mode.
- Live attempt first; on network failure or no base URL set, fall back to a clearly-labeled mock response built from `response_success`. A screen's logged-in state, chat thread, search results, etc. should work end-to-end in mock mode so the whole app is explorable with zero backend running — including the simulated-checkout and mock search-results-list behaviors described above.
- Never bake real secrets/tokens into the file.

### Technical constraints

- Single HTML file, inline `<style>` and `<script>`, no build tooling. External CDN libs are fine when they genuinely earn their place (a real-time chat channel client, a real payment provider's client-side SDK if the project already depends on it) — but the app must not hard-fail if a CDN is unreachable; anything load-bearing (forms, tables, the mock-fallback engine, uploads) must be hand-rolled/dependency-free.
- Long file size is expected — build it in one continuous write, generating repetitive markup (table rows, nav items, Module Workspace sections, Explorer entries) programmatically from `modules.json`.
- Must be meaningfully explorable fully offline (mock mode) — only real API calls need network.

## Phase 5 — Verify before presenting

- **Module coverage**: every single `module` in `modules.json` has a real screen (bespoke or Module Workspace) — not just an Explorer entry. List them off against the nav and confirm.
- **Provider parity**: if the API has multiple providers for the same job, confirm the UI shows all of them, not just one.
- **Flow completion**: for every redirect-flow feature, confirm the button actually navigates (live) or opens a real simulated screen (mock) — not just a JSON dump or an `alert()`.
- **Upload correctness**: for every multipart feature, confirm the form builds real `FormData` with the actual file, not a JSON stand-in.
- **Picker correctness**: for every "choose an existing entity" flow, confirm it's backed by the real search/list endpoint with real pagination, not a hardcoded array (a hardcoded array is only acceptable as that same UI's mock-mode content).
- MD guide: table of contents links resolve, every ```json block is valid JSON, no leftover `{{placeholder}}` markers.
- Module READMEs: confirm you only created files that didn't already exist.
- HTML app: no leftover `{{placeholder}}` markers, embedded mock JSON is valid. **Actually click through the app** (a headless browser session is strongly preferred over reasoning about it statically) — login, send a chat message, start a new conversation via search, open the assistant, submit the profile form with an avatar file, pick a billing plan on both providers, upload a file on Media, and open a Module Workspace screen for at least one non-bespoke module — confirm each does the real thing, in both live and mock mode, with zero console errors.
- Present all three. Don't restate the whole module list — describe the app in terms of what a dev can click through, point out the connection bar, and confirm explicitly that every module has a real screen (not just the Explorer).
