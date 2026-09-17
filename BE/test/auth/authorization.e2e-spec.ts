import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { ORGANIZATION_HEADER } from 'src/modules/auth/constants/auth.constant';
import { GENERAL_ERRORS } from 'src/constants/api-response/general.response';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import {
  createAuthTestApp,
  signToken,
  userModelReads,
  MEMBER_ORGANIZATION,
  FOREIGN_ORGANIZATION,
} from './auth-test-app';

/**
 * The authorization contract: what an authenticated caller is allowed to do,
 * and which organization they are allowed to do it in. Both run after
 * identity is settled, and neither reloads the user to decide a role.
 */
describe('Authorization contract (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = (await createAuthTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userModelReads.count = 0;
  });

  describe('role authorization', () => {
    it('admits a caller whose token carries the required role', async () => {
      const res = await server()
        .get('/admin-only')
        .set(
          'Authorization',
          `Bearer ${signToken({ role: USER_ROLES.ADMIN })}`,
        );

      expect(res.status).toBe(HttpStatus.OK);
    });

    it('answers 403 when an authenticated caller lacks the role', async () => {
      const res = await server()
        .get('/admin-only')
        .set(
          'Authorization',
          `Bearer ${signToken({ role: USER_ROLES.VIEWER })}`,
        );

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toBe(AUTH_ERRORS.FORBIDDEN_ROLE);
    });

    it('still answers 401 when there is no identity at all', async () => {
      const res = await server().get('/admin-only');

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    /**
     * The performance half of the architecture, asserted rather than assumed:
     * both guards run and neither touches the user collection.
     */
    it('reaches the handler without a single user-collection read', async () => {
      const res = await server()
        .get('/admin-only')
        .set(
          'Authorization',
          `Bearer ${signToken({ role: USER_ROLES.ADMIN })}`,
        );

      expect(res.status).toBe(HttpStatus.OK);
      expect(userModelReads.count).toBe(0);
    });

    it('authenticates a plain protected route without a user-collection read', async () => {
      const res = await server()
        .get('/protected')
        .set('Authorization', `Bearer ${signToken()}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(userModelReads.count).toBe(0);
    });
  });

  describe('tenant authorization', () => {
    it('admits a caller into the organization they belong to', async () => {
      const res = await server()
        .get('/tenant')
        .set('Authorization', `Bearer ${signToken()}`)
        .set(ORGANIZATION_HEADER, MEMBER_ORGANIZATION);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.organizationId).toBe(MEMBER_ORGANIZATION);
    });

    /**
     * Before the guard existed, this request succeeded: the header was copied
     * onto the request by the authentication guard, so asserting membership
     * was the same as having it.
     */
    it('denies a caller who asks for an organization they do not belong to', async () => {
      const res = await server()
        .get('/tenant')
        .set('Authorization', `Bearer ${signToken()}`)
        .set(ORGANIZATION_HEADER, FOREIGN_ORGANIZATION);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toBe(AUTH_ERRORS.ORGANIZATION_ACCESS_DENIED);
    });

    it('requires the organization to be named at all', async () => {
      const res = await server()
        .get('/tenant')
        .set('Authorization', `Bearer ${signToken()}`);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toBe(AUTH_ERRORS.ORGANIZATION_REQUIRED);
    });

    /**
     * The header on its own establishes nothing. Without the guard there is
     * no authorized tenant context, and the handler is refused rather than
     * handed an empty filter that would quietly scope the query to everything.
     */
    it('gives a route no tenant context just because the header was sent', async () => {
      const res = await server()
        .get('/tenant-unguarded')
        .set('Authorization', `Bearer ${signToken()}`)
        .set(ORGANIZATION_HEADER, MEMBER_ORGANIZATION);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toBe(GENERAL_ERRORS.FORBIDDEN);
    });

    it('refuses an anonymous caller before any membership lookup', async () => {
      const res = await server()
        .get('/tenant')
        .set(ORGANIZATION_HEADER, MEMBER_ORGANIZATION);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(userModelReads.count).toBe(0);
    });
  });
});
