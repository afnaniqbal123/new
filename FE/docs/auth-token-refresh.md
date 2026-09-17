# Silent single-flight token refresh

**Status: implemented by default.** `src/services/api-client.ts` runs this exact pattern in
its response interceptor. It's the default here — unlike most of our other real projects
(CarnectionIQ, Glow-Tech, Solar-lead all just end the session on 401, no refresh flow) —
because this boilerplate's backend contract issues a genuinely short-lived (15-minute)
access token; forcing a full re-login every 15 minutes would be a poor default UX. A project
whose backend issues longer-lived tokens is free to rip this back out for a plain
hard-logout-on-401, which is the simpler default those other projects use.

## Why this is the default here

- The access token's 15-minute lifetime makes hard-logout-on-401 a bad UX default — a user
  would be forced to re-authenticate multiple times per hour.
- `glassatecture-fe` (a Next.js project) already runs this pattern in production, so it's a
  proven reference, not a novel design.
- The refresh token **rotates** on every use (see "How this boilerplate actually implements
  it" below), which is exactly the scenario single-flight coordination exists to guard
  against — without it, concurrent
  401s would each fire their own refresh, race, and the loser would replay an already-spent
  refresh token, logging the user out everywhere.

## The pattern (adapted from `glassatecture-fe`)

1. **Single-flight guard.** A module-level `isRefreshing` flag plus a queue of pending
   callbacks, so concurrent 401s don't each trigger their own refresh call:

   ```ts
   let isRefreshing = false;
   let pendingQueue: Array<(token: string | null) => void> = [];

   function subscribeToRefresh(callback: (token: string | null) => void) {
     pendingQueue.push(callback);
   }

   function resolveQueue(token: string | null) {
     pendingQueue.forEach((callback) => callback(token));
     pendingQueue = [];
   }
   ```

2. **Response interceptor** — the first 401 kicks off the refresh; any 401 that arrives
   while a refresh is already in flight just queues its retry instead of firing a second
   refresh request:

   ```ts
   apiClient.interceptors.response.use(
     (response) => response,
     async (error: AxiosError) => {
       const original = error.config as
         (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
       if (error.response?.status !== 401 || !original || original._retry) {
         return Promise.reject(normalizeError(error));
       }
       original._retry = true;

       if (isRefreshing) {
         return new Promise((resolve, reject) => {
           subscribeToRefresh((token) => {
             if (!token) return reject(normalizeError(error));
             original.headers.set('Authorization', `Bearer ${token}`);
             resolve(apiClient(original));
           });
         });
       }

       isRefreshing = true;
       try {
         const token = await requestRefresh(); // POST /auth/refresh, write to authStore
         resolveQueue(token);
         if (!token) return Promise.reject(normalizeError(error));
         original.headers.set('Authorization', `Bearer ${token}`);
         return apiClient(original);
       } finally {
         isRefreshing = false;
       }
     }
   );
   ```

3. **Exclude auth-flow routes** (login/signup/refresh itself) from triggering a refresh —
   a 401 on `/auth/login` means "wrong password," not "token expired."

4. **Force-logout on refresh failure** — if `requestRefresh()` comes back empty, clear the
   auth store and redirect, exactly like the hard-logout default does today.

## How this boilerplate actually implements it

`src/services/api-client.ts` uses a shared in-flight `Promise<string>` instead of the
queue-array shape above (same single-flight guarantee, fewer moving parts):

- Both tokens from a refresh are written back via `useAuthStore.getState().setTokens(...)` —
  writing only the new access token would leave a spent refresh token in storage, which trips
  the backend's stolen-token/reuse detection on the very next refresh.
- `AUTH_FLOW_ROUTES` (derived from `AuthRoutes`, excluding `ME`/`CHANGE_PASSWORD`) is the
  exclusion list — a 401 on any of those means bad credentials/OTP/token, not an expired
  access token.
- On refresh failure, `useAuthStore.getState().logout()` runs — same cleanup a manual logout
  does (clears the store, clears the TanStack Query cache) — and `RoleGuards`
  (`src/routes/RoleGuards.tsx`) redirects.
- Verify it by hand: trigger two requests that 401 at nearly the same time and confirm the
  Network tab shows exactly one `/auth/refresh-token` call — this boilerplate has no automated
  test framework to assert it for you.
