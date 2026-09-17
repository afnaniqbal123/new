import { http, HttpResponse } from 'msw';
import { server } from 'src/mocks/server';
import { AuthRoutes } from 'src/constants/auth';
import { authService } from './authService';

function envelope(data: unknown) {
  return HttpResponse.json({ data, status: 200, message: 'ok' });
}

/**
 * Standalone tests confirming each `authService` method hits the right
 * `AuthRoutes` endpoint with the right method/payload shape — reusable
 * logic other features depend on, tested in isolation from any one workflow.
 */
describe('authService', () => {
  it('posts signup with the name/email/phone/password payload', async () => {
    let received: unknown;
    server.use(
      http.post(AuthRoutes.SIGNUP, async ({ request }) => {
        received = await request.json();
        return envelope(true);
      })
    );

    await authService.signup({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+15555550123',
      password: 'Sup3rSecret',
    });

    expect(received).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+15555550123',
      password: 'Sup3rSecret',
    });
  });

  it('posts login with email/password and returns the session', async () => {
    let received: unknown;
    server.use(
      http.post(AuthRoutes.LOGIN, async ({ request }) => {
        received = await request.json();
        // Flat token pair alongside the user — the real server's shape
        // (`IssuedSession & { user }`), not a nested `tokens` key.
        return envelope({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          expiresIn: '15m',
          refreshExpiresIn: '60d',
          user: {
            _id: '1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });
      })
    );

    const session = await authService.login({ email: 'ada@example.com', password: 'Sup3rSecret' });

    expect(received).toEqual({ email: 'ada@example.com', password: 'Sup3rSecret' });
    expect(session.user.email).toBe('ada@example.com');
    expect(session.accessToken).toBe('access-1');
  });

  it('posts refreshToken with the refresh token in the body', async () => {
    let received: unknown;
    let method = '';
    server.use(
      http.post(AuthRoutes.REFRESH_TOKEN, async ({ request }) => {
        method = request.method;
        received = await request.json();
        return envelope({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          expiresIn: '15m',
          refreshExpiresIn: '60d',
        });
      })
    );

    const tokens = await authService.refreshToken('old-refresh-token');

    expect(method).toBe('POST');
    expect(received).toEqual({ refreshToken: 'old-refresh-token' });
    expect(tokens.accessToken).toBe('new-access');
  });

  it('gets the authenticated user via GET', async () => {
    let method = '';
    server.use(
      http.get(AuthRoutes.ME, ({ request }) => {
        method = request.method;
        return envelope({
          _id: '1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          role: 'MEMBER',
          status: 'ACTIVE',
        });
      })
    );

    const user = await authService.getAuthenticatedUser();

    expect(method).toBe('GET');
    expect(user.email).toBe('ada@example.com');
  });

  it('posts logout with no body', async () => {
    let called = false;
    server.use(
      http.post(AuthRoutes.LOGOUT, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await authService.logout();

    expect(called).toBe(true);
  });
});
