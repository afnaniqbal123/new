# Web App / API Checklist (OWASP Top 10 / ASVS-flavored)

Use this when Stage 1 identifies a web application, public or internal API,
or anything that accepts HTTP requests. Read alongside
`checklist-common-cwe.md` — this file adds web-specific items, it doesn't
repeat injection/authz/crypto basics already covered there.

## A. Session & Token Management

- Session cookies: `HttpOnly`, `Secure`, `SameSite` set appropriately for
  the app's cross-origin needs.
- Session fixation: does the session ID rotate on login/privilege change?
- Token expiry: do access tokens actually expire, and is there a real
  revocation path for refresh tokens (not just client-side deletion)?
- Logout: does it invalidate server-side session state, or just clear a
  cookie?

## B. Cross-Site Scripting (XSS) (CWE-79)

- Reflected/stored XSS: user input rendered into HTML/JS/attribute context
  without contextual escaping. Framework auto-escaping (React/Vue/Jinja
  autoescape) usually covers this — look specifically for
  `dangerouslySetInnerHTML`, `v-html`, `{% autoescape false %}`,
  `.innerHTML =`, or raw string concatenation into templates.
- DOM-based XSS: client-side JS reading from `location.hash`/`search` and
  writing to the DOM without sanitization.

## C. Cross-Site Request Forgery (CSRF) (CWE-352)

- State-changing endpoints (POST/PUT/DELETE) relying only on cookie auth
  without a CSRF token or `SameSite=Strict/Lax` protection.
- Note: irrelevant for pure token-in-header APIs with no cookie auth —
  don't flag CSRF on an API that only accepts `Authorization: Bearer`.

## D. Server-Side Template Injection (SSTI)

- User input reaching a template string that's then _rendered_ (not just
  interpolated as data) — e.g. Jinja2 `render_template_string(user_input)`,
  or building a template name from user input.

## E. API-Specific (OWASP API Top 10 overlap)

- **Broken Object Level Authorization (BOLA/IDOR)**: does `/api/orders/123`
  check that the requester owns order 123, or just that they're
  authenticated?
- **Excessive data exposure**: does an endpoint return a whole object
  (including internal fields like password hashes, internal IDs, other
  users' data) and rely on the client to filter what's displayed?
- **Rate limiting**: are auth endpoints (login, password reset, OTP
  verification) protected against brute force? Absence isn't always a
  finding worth flagging critical on every project, but call it out for
  auth-sensitive endpoints.
- **Mass assignment via API body**: see common-cwe checklist item 10 — API
  bodies are the most common vector.
- **GraphQL-specific**: introspection enabled in production, missing query
  depth/complexity limits (DoS via deeply nested queries), field-level
  authorization gaps.

## F. File Upload Handling

- Upload endpoints: is file type validated by content, not just extension
  or client-supplied `Content-Type`?
- Are uploaded files served from the same origin/domain as the app (risk
  of stored XSS via uploaded HTML/SVG) or from a separate domain/CDN?
- Path traversal in upload filename handling — see common-cwe item 6.

## G. Security Headers & Transport

- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy` presence — worth noting as `low`/`info`
  findings if absent, not usually higher unless combined with something
  else.
- Is HTTP available alongside/instead of HTTPS for anything handling
  credentials or sessions?

## H. Business Logic

- This category doesn't pattern-match well — it requires reading the
  actual flow. Look for: price/quantity manipulation (client sends the
  price), workflow step skipping (calling step 3 of a checkout without
  having completed step 1/2), coupon/discount stacking not intended by
  design.

---

Cite specific OWASP Top 10 2021 / ASVS category names in the `citations`
field when a finding maps cleanly to one, e.g. "OWASP Top 10 2021 A01:2021
– Broken Access Control", so the user can cross-reference.
