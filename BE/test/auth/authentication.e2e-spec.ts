import * as jwt from 'jsonwebtoken';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JWT_AUDIENCE, JWT_ISSUER } from 'src/constants/config.constant';
import { TOKEN_TYPES } from 'src/modules/auth/constants/auth.constant';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import {
  createAuthTestApp,
  mintRealResetToken,
  signToken,
  TEST_SECRET,
} from './auth-test-app';

/**
 * The authentication contract, exercised over real HTTP.
 *
 * Every rejection below is a token that would previously have been accepted
 * somewhere in the stack, or a route that would previously have been reachable
 * without one. There is no database in this suite, which is itself part of the
 * contract: authenticating a request does not need one.
 */
describe('Authentication contract (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = (await createAuthTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('routes are protected by default', () => {
    it('refuses a route that carries no guard decorator when there is no token', async () => {
      const res = await server().get('/protected');

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(res.body.message).toBe(AUTH_ERRORS.UNAUTHORIZED);
    });

    it('lets a @Public() route through anonymously', async () => {
      const res = await server().get('/public');

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('a valid access token authenticates', () => {
    it('admits the caller and builds the principal from the claims', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken()}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.user).toEqual({
        id: '507f1f77bcf86cd799439011',
        email: 'user@example.com',
        role: USER_ROLES.ADMIN,
      });
    });

    it('carries the session id through to the principal', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken({ sid: 'session-1' })}`);

      expect(res.body.user.sessionId).toBe('session-1');
    });
  });

  describe('token purpose', () => {
    /**
     * The P0. A reset token is signed with the same secret and clears every
     * cryptographic check; only the purpose claim separates it from an access
     * credential.
     */
    it('refuses a valid password-reset token used as a bearer credential', async () => {
      const resetToken = signToken({
        type: TOKEN_TYPES.RESET_PASSWORD_TOKEN,
      });

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${resetToken}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token with no purpose claim', async () => {
      const token = jwt.sign(
        { sub: 'user-1', email: 'user@example.com', role: USER_ROLES.ADMIN },
        TEST_SECRET,
        { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '15m' },
      );

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    /**
     * The credential the application actually issues today, minted by the
     * real `PasswordResetService` — the exact string a user is emailed. The
     * legacy-JWT case above covers tokens still in flight from the old build.
     */
    it('refuses a genuine password-reset token used as a bearer credential', async () => {
      const resetToken = await mintRealResetToken();

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${resetToken}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token whose purpose the application does not know', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken({ type: 'API_KEY' })}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('claim shape', () => {
    it('refuses a token with no subject', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken({ sub: '' })}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token with no role', async () => {
      const token = jwt.sign(
        {
          sub: 'user-1',
          email: 'user@example.com',
          type: TOKEN_TYPES.SIGNIN_TOKEN,
        },
        TEST_SECRET,
        { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '15m' },
      );

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token carrying a role the application does not define', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken({ role: 'SUPERUSER' })}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('cryptographic trust boundary', () => {
    it('refuses a token signed with a different secret', async () => {
      const forged = signToken({}, {}, 'a-different-secret-entirely-32chars');

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses an expired token', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken({}, { expiresIn: '-1s' })}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token issued by someone else', async () => {
      const res = await server()
        .get('/protected')
        .set(
          'Authorization',
          `Bearer ${signToken({}, { issuer: 'some-other-service' })}`,
        );

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token minted for a different audience', async () => {
      const res = await server()
        .get('/protected')
        .set(
          'Authorization',
          `Bearer ${signToken({}, { audience: 'some-other-api' })}`,
        );

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    // The algorithm allow-list has exactly one entry. Without it a token gets
    // to nominate how it is verified.
    it('refuses an unsigned (alg: none) token', async () => {
      const unsigned = jwt.sign(
        {
          sub: 'user-1',
          email: 'user@example.com',
          role: USER_ROLES.ADMIN,
          type: TOKEN_TYPES.SIGNIN_TOKEN,
          iss: JWT_ISSUER,
          aud: JWT_AUDIENCE,
        },
        '',
        { algorithm: 'none' },
      );

      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${unsigned}`);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('refuses a token signed with an algorithm outside the allow-list', async () => {
      const res = await server()
        .get('/protected')
        .set(
          'Authorization',
          `Bearer ${signToken({}, { algorithm: 'HS512' })}`,
        );

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('malformed credentials', () => {
    it.each([
      ['not a JWT at all', 'Bearer not-a-jwt'],
      ['an empty bearer value', 'Bearer '],
      ['a scheme other than Bearer', 'Basic dXNlcjpwYXNz'],
      ['a bare token with no scheme', 'eyJhbGciOiJIUzI1NiJ9.e30.x'],
    ])('refuses %s', async (_label, header) => {
      const res = await server().get('/protected').set('Authorization', header);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    // Every failure looks identical from outside. Telling a caller which part
    // of a forged token to fix is free help for whoever is forging it.
    it('gives the same answer whatever the reason', async () => {
      const headers = [
        undefined,
        'Bearer not-a-jwt',
        `Bearer ${signToken({}, { expiresIn: '-1s' })}`,
        `Bearer ${signToken({ type: TOKEN_TYPES.RESET_PASSWORD_TOKEN })}`,
        `Bearer ${signToken({}, { issuer: 'some-other-service' })}`,
      ];

      for (const header of headers) {
        const req = server().get('/protected');
        const res = await (header ? req.set('Authorization', header) : req);

        expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
        expect(res.body.message).toBe(AUTH_ERRORS.UNAUTHORIZED);
      }
    });
  });
});
