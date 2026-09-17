import { http, HttpResponse } from 'msw';
import { server } from 'src/mocks/server';
import { AuthRoutes } from 'src/constants/auth';
import { useAuthStore } from 'src/stores/authStore';
import { apiClient } from './api-client';

const DEMO_USER = {
  _id: '1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'MEMBER',
  status: 'ACTIVE',
};

function envelope(data: unknown) {
  return HttpResponse.json({ data, status: 200, message: 'ok' });
}

/**
 * Standalone tests for the interceptor pair (bearer attach + single-flight
 * refresh-and-retry) — reusable request-handling logic, not tied to any one
 * feature's workflow. `AUTH.ME` stands in for "a protected, non-auth-flow
 * route" (it's the one route besides CHANGE_PASSWORD that api-client.ts's
 * isAuthFlowRoute check excludes, so a 401 on it is eligible for refresh —
 * unlike LOGIN/SIGNUP/etc, tested separately below).
 */
describe('apiClient', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null });
  });

  it('attaches the access token as a Bearer header when one is set', async () => {
    useAuthStore.setState({ accessToken: 'test-access-token' });
    let receivedAuth: string | null = null;
    server.use(
      http.get(AuthRoutes.ME, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return envelope(DEMO_USER);
      })
    );

    await apiClient.get(AuthRoutes.ME);

    expect(receivedAuth).toBe('Bearer test-access-token');
  });

  it('sends no Authorization header when there is no access token', async () => {
    let receivedAuth: string | null = 'not-checked-yet';
    server.use(
      http.get(AuthRoutes.ME, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return envelope(DEMO_USER);
      })
    );

    await apiClient.get(AuthRoutes.ME);

    expect(receivedAuth).toBeNull();
  });

  it('refreshes the access token and retries once on a 401 from a non-auth-flow route', async () => {
    useAuthStore.setState({ accessToken: 'expired-token', refreshToken: 'valid-refresh-token' });
    let meCallCount = 0;
    let refreshCallCount = 0;
    server.use(
      http.get(AuthRoutes.ME, ({ request }) => {
        meCallCount += 1;
        if (request.headers.get('authorization') === 'Bearer expired-token') {
          return HttpResponse.json({ message: 'Token expired.' }, { status: 401 });
        }
        return envelope(DEMO_USER);
      }),
      http.post(AuthRoutes.REFRESH_TOKEN, () => {
        refreshCallCount += 1;
        return envelope({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: '15m',
          refreshExpiresIn: '60d',
        });
      })
    );

    const response = await apiClient.get(AuthRoutes.ME);

    expect(response.status).toBe(200);
    expect(meCallCount).toBe(2);
    expect(refreshCallCount).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('new-access-token');
  });

  it('logs out and rejects cleanly (not a hang or a second refresh attempt) when the refresh call itself fails', async () => {
    useAuthStore.setState({
      accessToken: 'expired-token',
      refreshToken: 'stale-refresh-token',
      user: DEMO_USER,
    });
    let refreshCallCount = 0;
    server.use(
      http.get(AuthRoutes.ME, () =>
        HttpResponse.json({ message: 'Token expired.' }, { status: 401 })
      ),
      http.post(AuthRoutes.REFRESH_TOKEN, () => {
        refreshCallCount += 1;
        return HttpResponse.json({ message: 'Refresh token expired.' }, { status: 401 });
      })
    );

    await expect(apiClient.get(AuthRoutes.ME)).rejects.toMatchObject({ status: 401 });

    expect(refreshCallCount).toBe(1);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('never attempts a refresh for a 401 on an auth-flow route like login', async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: 'some-refresh-token' });
    let refreshCallCount = 0;
    server.use(
      http.post(AuthRoutes.LOGIN, () =>
        HttpResponse.json({ message: 'Invalid credentials.' }, { status: 401 })
      ),
      http.post(AuthRoutes.REFRESH_TOKEN, () => {
        refreshCallCount += 1;
        return envelope({
          accessToken: 'x',
          refreshToken: 'y',
          expiresIn: '15m',
          refreshExpiresIn: '60d',
        });
      })
    );

    await expect(
      apiClient.post(AuthRoutes.LOGIN, { email: 'ada@example.com', password: 'wrong' })
    ).rejects.toMatchObject({ status: 401, message: 'Invalid credentials.' });

    expect(refreshCallCount).toBe(0);
  });
});
