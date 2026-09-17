import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTHORIZATION_ERRORS } from 'src/modules/authorization/constants/api-response/authorization.response';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { signToken } from '../auth/auth-test-app';
import { createAuthzTestApp } from './authz-test-app';

/**
 * The permission contract over real HTTP: 401 without identity, 403 with
 * identity but without permission, 200 when both hold. No database — the
 * whole authorization path runs on token claims.
 */
describe('Authorization contract (e2e)', () => {
  let app: INestApplication<App>;
  const server = () => request(app.getHttpServer());

  const SELF = '507f1f77bcf86cd799439011';
  const tokenFor = (role: USER_ROLES) => signToken({ sub: SELF, role });

  beforeAll(async () => {
    app = (await createAuthzTestApp()) as INestApplication<App>;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('401 — no identity', () => {
    it('refuses a permissioned route with no token', async () => {
      const res = await server().get('/widgets');
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('still lets a @Public() route through', async () => {
      const res = await server().get('/open');
      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  describe('403 — identity without permission', () => {
    it('refuses a caller whose role grants nothing relevant', async () => {
      const res = await server()
        .get('/widgets')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toBe(AUTHORIZATION_ERRORS.FORBIDDEN);
    });

    /**
     * The distinction that matters: 401 says "identify yourself", 403 says
     * "you did, and it does not help". Answering 401 here would send a client
     * to re-authenticate, which cannot change the outcome.
     */
    it('answers 403, not 401, for an authenticated caller', async () => {
      const res = await server()
        .get('/widgets')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).not.toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('200 — permitted', () => {
    it('admits a role the policy grants', async () => {
      const res = await server()
        .get('/widgets')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.CASHIER)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });

    it('admits an elevated role via the Manage wildcard', async () => {
      const res = await server()
        .get('/widgets')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.ADMIN)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  describe('record-level checks', () => {
    it('admits a caller to their own record', async () => {
      const res = await server()
        .get('/widgets/mine')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });

    /**
     * The whole reason record-level checks exist. CASL's name-only check
     * ignores conditions, so this caller passes the route guard on the
     * strength of their self-grant — and is refused once the record is known.
     */
    it('refuses the same caller another owner’s record', async () => {
      const res = await server()
        .get('/widgets/theirs')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    /**
     * Regression for the escalation found in review on #26: `PATCH /users/:id`
     * had a name-only guard and no record check, so a VIEWER cleared it on the
     * strength of the conditional self-update grant and could edit anyone.
     */
    it('refuses a non-elevated caller updating another owner’s record', async () => {
      const res = await server()
        .get('/widgets/update-theirs')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('still lets that caller update their own record', async () => {
      const res = await server()
        .get('/widgets/update-mine')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.VIEWER)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });

    /**
     * The policy's `cannot(Delete, { _id: self })` is invisible to a name-only
     * guard. Without the record check an elevated caller could delete their own
     * account through the admin route, despite the rule forbidding it.
     */
    it('enforces a cannot() carve-out that the guard cannot see', async () => {
      const res = await server()
        .get('/widgets/delete-own')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.ADMIN)}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('admits an elevated role to any record', async () => {
      const res = await server()
        .get('/widgets/theirs')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.ADMIN)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });
  });

  describe('tenant boundary', () => {
    /**
     * Closes the gap the spec review found: #19 asks for tenant-boundary
     * coverage, and nothing previously exercised `context.organizationId`
     * reaching a rule. This only works because the tenant guard is ordered
     * ahead of PermissionsGuard — reverse them and the ability is built with
     * `organizationId: undefined` and this test fails.
     */
    it('admits a caller to their own organization', async () => {
      const res = await server()
        .get('/widgets/in-my-org')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.CASHIER)}`);

      expect(res.status).toBe(HttpStatus.OK);
    });

    it('refuses the same caller another organization', async () => {
      const res = await server()
        .get('/widgets/in-other-org')
        .set('Authorization', `Bearer ${tokenFor(USER_ROLES.CASHIER)}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
