# Component Patterns — FE Demo App

Concrete, adaptable building blocks for the app-shaped output (Phase 4). Copy the pattern, not
necessarily the exact code — swap in the project's real palette/type from `design-guide.md`,
adapt field names to the real DTOs from `modules.json`, and generate repetitive markup (nav
items, table rows, Explorer entries, Module Workspace sections) programmatically in your build
step rather than hand-typing each one.

The patterns are ordered roughly bespoke-screen → generic engine → the two mechanisms
(§13 picker, §14 Module Workspace) that make full module coverage achievable without
hand-authoring dozens of unique screens.

## 1. State + app shell

One global state object. `session` holds whatever login/signup returns, so the rest of the app
can read `STATE.session.user` without re-fetching.

```html
<script>
  const STATE = {
    baseUrl: '',
    authToken: '',
    theme: matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
    session: null, // { token, user } once logged in (real or mock)
    activeScreen: 'home',
  };

  const MODULES = [/* ...generated from Phase 1 modules.json... */];

  function findFeature(id) {
    for (const m of MODULES)
      for (const f of m.features) if (f.id === id) return f;
    return null;
  }
  function featuresForScreen(screen) {
    return MODULES.flatMap((m) => m.features).filter(
      (f) => f.screen === screen,
    );
  }

  function isLoggedIn() {
    return !!STATE.session;
  }
  function onLoginSuccess(session) {
    STATE.session = session;
    if (session.token) STATE.authToken = session.token;
    document.getElementById('auth-token').value = STATE.authToken;
    renderNav(); // unlock auth-gated nav items, show avatar/name
    go('home');
  }
</script>
```

## 2. Nav shell + connection bar

Every `module`, not just the hand-built screens, needs a nav entry — modules without a bespoke
screen point at a Module Workspace (§14) instead of being left out.

```html
<div class="topbar">
  <span class="brand">{{ProjectName}}</span>
  <button class="conn-toggle" onclick="toggleConnBar()">Connection ▾</button>
  <div id="conn-bar" hidden>
    <input
      id="base-url"
      placeholder="https://api.example.com"
      oninput="STATE.baseUrl=this.value"
    />
    <input
      id="auth-token"
      type="password"
      placeholder="Bearer token (auto-filled on login)"
      oninput="STATE.authToken=this.value"
    />
    <span id="conn-mode" class="tag"></span>
  </div>
  <div id="session-chip"></div>
</div>
<nav id="app-nav"></nav>
<main id="screen-root"></main>

<script>
  function toggleConnBar() {
    document.getElementById('conn-bar').hidden =
      !document.getElementById('conn-bar').hidden;
  }
  function updateConnMode() {
    document.getElementById('conn-mode').textContent = STATE.baseUrl
      ? 'LIVE mode'
      : 'MOCK mode';
  }

  // Bespoke screens first, then one nav item per module that has no bespoke screen
  // (each of those renders via renderModuleWorkspace(module) — see §14), then Explorer last.
  const BESPOKE_SCREENS = [
    'home',
    'auth',
    'profile',
    'chat',
    'admin',
    'billing',
    'media',
    'notifications',
  ];
  function buildNavItems() {
    const bespoke = [
      { id: 'home', label: 'Home', requiresAuth: false },
      {
        id: 'auth',
        label: 'Login / Signup',
        requiresAuth: false,
        hideWhenAuthed: true,
      },
      { id: 'profile', label: 'Profile', requiresAuth: true },
      { id: 'chat', label: 'Chat', requiresAuth: true },
      { id: 'admin', label: 'Team', requiresAuth: true },
      { id: 'billing', label: 'Billing', requiresAuth: true },
      { id: 'media', label: 'Media', requiresAuth: true },
      { id: 'notifications', label: 'Notifications', requiresAuth: true },
    ]; // drop any the API genuinely has nothing for
    const covered = new Set(
      bespoke.flatMap((n) => featuresForScreen(n.id)).map((f) => f.module),
    );
    const workspaceItems = MODULES.filter((m) => !covered.has(m.module)).map(
      (m) => ({
        id: 'workspace:' + m.module,
        label: m.module,
        requiresAuth: m.features.some((f) => f.auth_required),
      }),
    );
    return [
      ...bespoke,
      ...workspaceItems,
      { id: 'explorer', label: 'API Explorer', requiresAuth: false },
    ];
  }
  const NAV_ITEMS = buildNavItems();

  function renderNav() {
    const nav = document.getElementById('app-nav');
    nav.innerHTML = NAV_ITEMS.filter((n) => !(n.hideWhenAuthed && isLoggedIn()))
      .map(
        (
          n,
        ) => `<button class="nav-item ${STATE.activeScreen === n.id ? 'active' : ''}"
        ${n.requiresAuth && !isLoggedIn() ? 'disabled title="Log in first"' : ''}
        onclick="go('${n.id}')">${n.label}</button>`,
      )
      .join('');
    document.getElementById('session-chip').innerHTML = isLoggedIn()
      ? `<span class="avatar">${initials(STATE.session.user)}</span> ${escapeHtml(STATE.session.user?.name || '')} <button onclick="logout()">Log out</button>`
      : '';
  }
  function go(screen) {
    STATE.activeScreen = screen;
    renderNav();
    const root = document.getElementById('screen-root');
    if (screen.startsWith('workspace:')) {
      const mod = MODULES.find(
        (m) => m.module === screen.slice('workspace:'.length),
      );
      root.innerHTML = renderModuleWorkspace(mod); // §14
    } else {
      root.innerHTML = SCREEN_RENDERERS[screen]
        ? SCREEN_RENDERERS[screen]()
        : '';
    }
  }
  function initials(user) {
    if (!user?.name) return '?';
    return user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }
</script>
```

## 3. Auth forms (login / signup / forgot-password)

Real form, real validation, real error banner — driven by the actual DTO fields from
`modules.json` (don't hardcode `email`/`password` if the real DTO has different field names).

```html
<script>
  function renderLogin() {
    return `
    <div class="auth-card">
      <h1>Log in</h1>
      <div id="auth-error" class="banner banner-error" hidden></div>
      <form onsubmit="return handleLogin(event)">
        <label>Email<input type="email" name="email" required></label>
        <label>Password<input type="password" name="password" required></label>
        <button type="submit" class="btn-primary" id="login-submit">Log in</button>
      </form>
      <p class="muted">No account? <a href="#" onclick="go('signup');return false;">Sign up</a>
       · <a href="#" onclick="go('forgot');return false;">Forgot password?</a></p>
    </div>`;
  }
  async function handleLogin(evt) {
    evt.preventDefault();
    const form = evt.target;
    const btn = document.getElementById('login-submit');
    const errEl = document.getElementById('auth-error');
    errEl.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Logging in…';
    const body = { email: form.email.value, password: form.password.value };
    const feature = findFeature('auth-login'); // real id from modules.json
    const result = await callApi(feature, { body });
    btn.disabled = false;
    btn.textContent = 'Log in';
    if (result.error) {
      errEl.hidden = false;
      errEl.textContent =
        (result.body && (result.body.message || JSON.stringify(result.body))) ||
        'Login failed';
      return false;
    }
    const payload = result.body?.data ?? result.body;
    onLoginSuccess({
      token: payload.token || payload.accessToken,
      user: payload.user,
      mock: result.mock,
    });
    return false;
  }
</script>
```

Signup and forgot/reset-password forms follow the same shape.

## 4. Modal + floating assistant button

```html
<button class="fab" onclick="openAssistant()" aria-label="Help">💬</button>
<div id="assistant-modal" class="modal-overlay" hidden>
  <div class="modal">
    <button class="modal-close" onclick="closeAssistant()">✕</button>
    <div class="chat-thread" id="assistant-thread"></div>
    <form onsubmit="return sendAssistantMessage(event)">
      <input
        id="assistant-input"
        placeholder="Ask a question…"
        autocomplete="off"
      />
      <button type="submit" class="btn-primary">Send</button>
    </form>
  </div>
</div>
<script>
  function openAssistant() {
    document.getElementById('assistant-modal').hidden = false;
    document.getElementById('assistant-input').focus();
  }
  function closeAssistant() {
    document.getElementById('assistant-modal').hidden = true;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAssistant();
  });
</script>
```

## 5. Chat screen (with a real "start a new conversation" picker)

The room list is only half of a real chat screen — the other half is starting a _new_
conversation, which means a real user search, not a static contact list. See §13 for the
reusable search-and-pick pattern; this is it applied to chat.

```html
<script>
  function renderChat() {
    return `
    <div class="chat-screen">
      <aside class="room-list">
        <button class="btn-primary" style="margin:10px" onclick="openNewChatPicker()">+ New conversation</button>
        <div id="room-list-items"></div>
      </aside>
      <section class="chat-thread-pane">
        <div class="chat-thread" id="chat-thread"></div>
        <form onsubmit="return sendChatMessage(event)">
          <input id="chat-input" placeholder="Message…" autocomplete="off">
          <button type="submit" class="btn-primary">Send</button>
        </form>
      </section>
    </div>`;
  }
  function chatBubble(msg, isMine, mock) {
    return `<div class="bubble-row ${isMine ? 'mine' : 'theirs'}">
    <span class="avatar small">${initials(msg.sender)}</span>
    <div class="bubble">${mock ? '<span class="tag tag-mock">MOCK</span><br>' : ''}${escapeHtml(msg.content)}</div>
  </div>`;
  }
  async function sendChatMessage(evt) {
    evt.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !STATE.activeRoomId) return false;
    input.value = '';
    const feature = findFeature('chat-send-message'); // real id
    const result = await callApi(feature, {
      pathParams: { roomId: STATE.activeRoomId },
      body: { content: text },
    });
    appendMessageToThread(result.body?.data ?? result.body, true, result.mock);
    return false;
  }

  // "New conversation": real search against the real user-list endpoint, real pagination,
  // selecting a result calls the real get-or-create-room endpoint.
  function openNewChatPicker() {
    openEntityPicker({
      title: 'Start a conversation',
      listFeatureId: 'users-find-all', // real id — must be the real searchable user list
      searchParam: 'search', // from modules.json list_query_support
      pageParam: 'page',
      limitParam: 'limit',
      renderItem: (u) =>
        `<div class="picker-row"><span class="avatar small">${initials(u)}</span> ${escapeHtml(u.name)} <span class="muted">${escapeHtml(u.email)}</span></div>`,
      onPick: async (user) => {
        const feature = findFeature('chat-get-or-create-room'); // real id
        const result = await callApi(feature, {
          pathParams: { otherUserId: user._id || user.id },
        });
        const room = result.body?.data ?? result.body;
        closeEntityPicker();
        openRoom(room._id || room.id, room);
      },
    });
  }
</script>
```

## 6. Data table (Team/Admin, and reused inside Module Workspaces)

```html
<script>
  function renderTable(rows, columns, rowActions) {
    if (!rows.length) return '<div class="empty-state">Nothing here yet.</div>';
    const head =
      columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('') +
      (rowActions ? '<th></th>' : '');
    const body = rows
      .map((r) => {
        const cells = columns
          .map(
            (c) =>
              `<td>${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '')}</td>`,
          )
          .join('');
        const actions = rowActions
          ? `<td class="row-actions">${rowActions(r)}</td>`
          : '';
        return `<tr>${cells}${actions}</tr>`;
      })
      .join('');
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
</script>
```

## 7. Billing with provider tabs and a REAL checkout redirect

If the API integrates more than one payment provider, both get a tab in the same screen — never
just the one that got built first.

```html
<script>
  let billingProvider = 'stripe'; // first provider found in modules.json's provider_group: "billing"
  function renderBilling() {
    const providers = [
      ...new Set(
        MODULES.filter((m) => m.provider_group === 'billing').map(
          (m) => m.provider,
        ),
      ),
    ]; // e.g. ['stripe','paypal']
    return `
    <h1>Billing</h1>
    <div class="tabs">${providers.map((p) => `<button class="${billingProvider === p ? 'active' : ''}" onclick="switchBillingProvider('${p}')">${escapeHtml(p)}</button>`).join('')}</div>
    <div id="billing-provider-panel"></div>`;
  }
  function switchBillingProvider(p) {
    billingProvider = p;
    renderBillingProviderPanel();
  }
  async function renderBillingProviderPanel() {
    const panel = document.getElementById('billing-provider-panel');
    const plansFeature = findFeature(billingProvider + '-sub-plans'); // e.g. stripe-sub-plans / paypal-sub-plans
    const result = await callApi(plansFeature);
    const plans = result.body?.data ?? result.body ?? [];
    panel.innerHTML = `<div class="plan-grid">${plans
      .map(
        (p) => `
    <div class="plan-tile">
      <div>${escapeHtml(p.nickname || p.name || p.id)}</div>
      <button class="btn-primary" onclick="chooseBillingPlan('${p.id}')">Choose</button>
    </div>`,
      )
      .join('')}</div>`;
  }

  // The part that actually completes the flow instead of stopping at the JSON response.
  async function chooseBillingPlan(planId) {
    const checkoutFeature = findFeature(billingProvider + '-sub-checkout');
    const result = await callApi(checkoutFeature, {
      body: {
        planId,
        priceId: planId,
        successUrl: location.href,
        cancelUrl: location.href,
      },
    });
    const payload = result.body?.data ?? result.body ?? {};
    const redirectUrl =
      payload.url || payload.links?.find((l) => l.rel === 'approve')?.href;
    if (!result.mock && redirectUrl) {
      window.location.href = redirectUrl; // REAL redirect to the real provider checkout — this is the point
      return;
    }
    openMockCheckoutModal(billingProvider, planId, redirectUrl); // honest simulated screen, clearly labeled MOCK
  }
  function openMockCheckoutModal(provider, planId, mockUrl) {
    showModal(`
    <div class="mock-checkout">
      <span class="tag tag-mock">MOCK CHECKOUT</span>
      <h3>${escapeHtml(provider)} checkout (simulated)</h3>
      <p class="muted">No base URL set, or the mock response had no real redirect URL — this stands in for the real ${escapeHtml(provider)} hosted checkout page.</p>
      <label>Card number</label><input value="4242 4242 4242 4242" class="mono" readonly>
      <button class="btn-primary" onclick="closeModal()">Simulate successful payment</button>
    </div>`);
  }
</script>
```

## 8. Profile with a REAL multipart avatar upload

If the profile-update route is `multipart/form-data`, the form must submit a real file — not a
JSON body with a fake URL string.

```html
<script>
  function renderProfileAvatarField(currentUser) {
    return `
    <div class="avatar-field">
      <img id="avatar-preview" class="avatar-lg" src="${currentUser.avatar || ''}" onerror="this.style.display='none'">
      <input type="file" id="avatar-input" accept="image/*" hidden onchange="handleAvatarChosen(this.files[0])">
      <button type="button" class="btn-ghost" onclick="document.getElementById('avatar-input').click()">Change avatar</button>
    </div>`;
  }
  let pendingAvatarFile = null;
  function handleAvatarChosen(file) {
    if (!file) return;
    pendingAvatarFile = file;
    document.getElementById('avatar-preview').src = URL.createObjectURL(file);
    document.getElementById('avatar-preview').style.display = '';
  }
  async function handleUpdateProfile(evt) {
    evt.preventDefault();
    const form = evt.target;
    const feature = findFeature('users-update-me'); // real id, is_multipart: true
    const fd = new FormData();
    fd.append('name', form.name.value);
    fd.append('phone', form.phone.value);
    if (pendingAvatarFile) fd.append('avatar', pendingAvatarFile);
    const result = await callApi(feature, { body: fd, isMultipart: true });
    // ... banner + refresh from result as usual
  }
</script>
```

`callApi`'s multipart branch (see §9) must NOT set a `Content-Type` header — the browser sets
`multipart/form-data; boundary=...` automatically when the fetch `body` is a `FormData`
instance, and overriding it breaks the boundary.

## 9. Media upload with preview (presigned two-step flow)

```html
<div class="dropzone" id="dropzone">
  <input
    type="file"
    id="file-input"
    hidden
    onchange="handleFileChosen(this.files[0])"
  />
  <p>
    Drag a file here or
    <button
      class="btn-ghost"
      onclick="document.getElementById('file-input').click()"
    >
      browse
    </button>
  </p>
</div>
<div id="upload-preview"></div>
<script>
  ['dragover', 'drop'].forEach((evt) =>
    document
      .getElementById('dropzone')
      .addEventListener(evt, (e) => e.preventDefault()),
  );
  document
    .getElementById('dropzone')
    .addEventListener('drop', (e) => handleFileChosen(e.dataTransfer.files[0]));

  async function handleFileChosen(file) {
    if (!file) return;
    const preview = document.getElementById('upload-preview');
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" class="thumb"> <div class="loading">Uploading…</div>`;
    const presignFeature = findFeature('media-presign-upload'); // real id
    const presign = await callApi(presignFeature, {
      body: { fileName: file.name, contentType: file.type },
    });
    const signedUrl = presign.body?.data?.url;
    if (!presign.mock && signedUrl) {
      await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
    }
    preview.innerHTML = `<img src="${url}" class="thumb"> <div class="upload-success">✓ Uploaded${presign.mock ? ' <span class="tag tag-mock">MOCK</span>' : ''}</div>`;
  }
</script>
```

## 10. Step diagram (for multi-step flows: OTP, checkout, presigned upload)

A small, dependency-free horizontal stepper — drop it above any multi-call flow so the _shape_
of the flow is visible, not just the final result.

```html
<script>
  function renderStepDiagram(steps, currentIndex) {
    return `<div class="step-diagram">${steps
      .map(
        (s, i) => `
    <div class="step ${i < currentIndex ? 'done' : i === currentIndex ? 'active' : ''}">
      <div class="step-dot">${i < currentIndex ? '✓' : i + 1}</div>
      <div class="step-label">${escapeHtml(s)}</div>
    </div>${i < steps.length - 1 ? '<div class="step-line"></div>' : ''}`,
      )
      .join('')}</div>`;
  }
  // usage: renderStepDiagram(['Email','OTP','New password'], 1)
</script>
```

## 11. callApi — single source of truth for live + mock, JSON and multipart

```html
<script>
  async function callApi(
    feature,
    { pathParams = {}, queryParams = {}, body, isMultipart = false } = {},
  ) {
    let path = feature.path;
    Object.entries(pathParams).forEach(([k, v]) => {
      path = path.replace(`{${k}}`, encodeURIComponent(v));
    });
    const qs = new URLSearchParams(
      Object.entries(queryParams).filter(([, v]) => v != null && v !== ''),
    ).toString();
    if (qs) path += (path.includes('?') ? '&' : '?') + qs;

    updateConnMode();
    if (!STATE.baseUrl) return mockResultFor(feature);

    const url = STATE.baseUrl.replace(/\/$/, '') + path;
    const headers = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json'; // let the browser set the multipart boundary itself
    if (STATE.authToken) headers['Authorization'] = 'Bearer ' + STATE.authToken;

    try {
      const res = await fetch(url, {
        method: feature.method,
        headers,
        body:
          ['GET', 'HEAD'].includes(feature.method) || body === undefined
            ? undefined
            : isMultipart
              ? body
              : JSON.stringify(body),
      });
      let payload;
      try {
        payload = await res.json();
      } catch {
        payload = await res.text();
      }
      return { mock: false, error: !res.ok, status: res.status, body: payload };
    } catch (e) {
      return mockResultFor(feature, e.message);
    }
  }
  function mockResultFor(feature, reason) {
    const ex = feature.response_success;
    return {
      mock: true,
      error: false,
      status: ex?.status ?? 200,
      body: ex?.body ?? {},
      mockReason: reason || 'no base URL set',
    };
  }
  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  }
</script>
```

## 12. API Explorer (compact docs-tool, one screen among many — never a coverage substitute)

Reuse the sidebar-of-endpoints + Docs/Request/Try it/Response tab pattern here — grouped by
`module`, search box, editable JSON body textarea, table/JSON viewer for results, `LIVE`/`MOCK`
tag on every response. This is the one screen where a dense, tool-like layout is correct. Keep
it for raw debugging — but per the skill's non-negotiables, it never substitutes for a module
having a real screen or Module Workspace.

## 13. Entity search + pagination picker (reused by chat, admin, and any Module Workspace)

The generic mechanism behind "pick an existing thing" — a real search box against a real list
endpoint, with real pagination, in a modal. Chat's "new conversation" (§5) is this applied to
users; reuse it anywhere else the app needs to pick an existing entity (assign an invoice to a
customer, add a member to a room, etc.).

```html
<script>
  let pickerState = null;
  function openEntityPicker(config) {
    pickerState = { ...config, page: 1, search: '' };
    showModal(`
    <h3>${escapeHtml(config.title)}</h3>
    <input id="picker-search" placeholder="Search…" oninput="pickerSearch(this.value)">
    <div id="picker-results"><div class="loading">Loading…</div></div>
    <div class="picker-pagination">
      <button class="btn-ghost" onclick="pickerPage(-1)">‹ Prev</button>
      <span id="picker-page-label"></span>
      <button class="btn-ghost" onclick="pickerPage(1)">Next ›</button>
    </div>`);
    loadPickerResults();
  }
  function closeEntityPicker() {
    closeModal();
    pickerState = null;
  }
  let pickerDebounce;
  function pickerSearch(q) {
    clearTimeout(pickerDebounce);
    pickerDebounce = setTimeout(() => {
      pickerState.search = q;
      pickerState.page = 1;
      loadPickerResults();
    }, 250);
  }
  function pickerPage(delta) {
    pickerState.page = Math.max(1, pickerState.page + delta);
    loadPickerResults();
  }
  async function loadPickerResults() {
    const { listFeatureId, searchParam, pageParam, limitParam, renderItem } =
      pickerState;
    const feature = findFeature(listFeatureId);
    const queryParams = {};
    if (searchParam) queryParams[searchParam] = pickerState.search;
    if (pageParam) queryParams[pageParam] = pickerState.page;
    if (limitParam) queryParams[limitParam] = 10;
    const result = await callApi(feature, { queryParams });
    const items = result.body?.data ?? result.body ?? [];
    const list = Array.isArray(items)
      ? items
      : items.items || items.results || [];
    const el = document.getElementById('picker-results');
    el.innerHTML =
      (result.mock ? '<span class="tag tag-mock">MOCK</span>' : '') +
      (list.length
        ? list
            .map(
              (item) =>
                `<div class="picker-row" onclick='pickerChoose(${JSON.stringify(item).replace(/'/g, '&#39;')})'>${renderItem(item)}</div>`,
            )
            .join('')
        : '<div class="empty-state">No results.</div>');
    document.getElementById('picker-page-label').textContent =
      'Page ' + pickerState.page;
  }
  function pickerChoose(item) {
    pickerState.onPick(item);
  }
</script>
```

`showModal`/`closeModal` are a minimal generic modal helper (a `.modal-overlay` + `.modal` pair
toggled via the `hidden` attribute, per `design-guide.md`) — reused by the assistant widget, the
mock checkout screen, and this picker, rather than each building its own modal markup.

## 14. Module Workspace — the mechanism that gets every module a real screen

This is what makes "every module gets a real UI section" achievable without hand-authoring a
bespoke screen for all sixteen-plus modules. It is **not** the Explorer — it's a real,
form/table/card-based screen, generated from the module's own features, that happens to be
assembled programmatically instead of hand-designed. Use it for every module that isn't one of
the hand-built screens (invoices, webhooks-as-explainer, bulk admin ops, anything else).

```html
<script>
  function renderModuleWorkspace(mod) {
    return `
    <h1>${escapeHtml(mod.module)}</h1>
    <p class="muted">${mod.features.length} endpoint${mod.features.length !== 1 ? 's' : ''} in this module.</p>
    <div class="workspace-grid">
      ${mod.features.map((f) => renderWorkspaceCard(f)).join('')}
    </div>`;
  }

  function renderWorkspaceCard(f) {
    const bodyFields = f.request_body
      ? renderGenericFields('ws-' + f.id, f.request_body)
      : '';
    const paramFields = (f.path_params || [])
      .map(
        (p) =>
          `<label>${escapeHtml(p.name)}</label><input id="ws-param-${f.id}-${p.name}" class="mono" placeholder="${escapeHtml(p.example || p.name)}">`,
      )
      .join('');
    const queryFields = (f.query_params || [])
      .map(
        (q) =>
          `<label>${escapeHtml(q.name)}</label><input id="ws-query-${f.id}-${q.name}" class="mono">`,
      )
      .join('');
    // Webhook receivers and similar provider-called (not human-called) routes get an explainer instead of a live "Try it" — never a dead JSON box pretending to be actionable.
    if (f.notes && /webhook|not callable/i.test(f.notes)) {
      return `<div class="card"><span class="method-badge method-${f.method.toLowerCase()}">${f.method}</span> <strong>${escapeHtml(f.name)}</strong>
      <p class="muted">${escapeHtml(f.description)}</p>
      <div class="notes-box">${escapeHtml(f.notes)}</div></div>`;
    }
    return `<div class="card">
    <span class="method-badge method-${f.method.toLowerCase()}">${f.method}</span> <strong>${escapeHtml(f.name)}</strong>
    <p class="muted">${escapeHtml(f.description)}</p>
    <form onsubmit="return submitWorkspaceCard(event, '${f.id}')">
      ${paramFields}${queryFields}${bodyFields}
      <button class="btn-primary" type="submit">${escapeHtml(f.method === 'GET' ? 'Fetch' : f.name)}</button>
    </form>
    <div id="ws-result-${f.id}" class="workspace-result"></div>
  </div>`;
  }

  async function submitWorkspaceCard(evt, id) {
    evt.preventDefault();
    const f = findFeature(id);
    const pathParams = {};
    (f.path_params || []).forEach((p) => {
      pathParams[p.name] =
        document.getElementById(`ws-param-${id}-${p.name}`)?.value || '';
    });
    const queryParams = {};
    (f.query_params || []).forEach((q) => {
      const v = document.getElementById(`ws-query-${id}-${q.name}`)?.value;
      if (v) queryParams[q.name] = v;
    });
    const body = f.request_body
      ? collectGenericFields('ws-' + id, f.request_body)
      : undefined;
    const resultEl = document.getElementById(`ws-result-${id}`);
    resultEl.innerHTML = '<div class="loading">Calling…</div>';
    const result = await callApi(f, { pathParams, queryParams, body });
    const tag = result.mock
      ? '<span class="tag tag-mock">MOCK</span>'
      : '<span class="tag tag-live">LIVE</span>';
    const data = result.body?.data ?? result.body;
    resultEl.innerHTML =
      tag +
      ' <span class="status-badge">' +
      result.status +
      '</span>' +
      (Array.isArray(data)
        ? renderTable(
            data,
            Object.keys(data[0] || {}).map((k) => ({ key: k, label: k })),
          )
        : `<pre class="json-view">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`);
    return false;
  }
</script>
```

`renderGenericFields`/`collectGenericFields` build one labeled input per key in a
`request_body` example (text/number/password by field-name heuristics, a JSON textarea for
nested objects/arrays) — see the generic-form helper pattern; this is what keeps Module
Workspace forms real inputs instead of one big raw JSON textarea, matching the rest of the
app's visual language (`design-guide.md`) even though the screen itself is generated.
