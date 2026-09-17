import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { AuthenticatedPrincipal } from 'src/modules/auth/types/authenticated-principal.type';
import { RolesGuard } from './roles.guard';

const contextFor = (user?: AuthenticatedPrincipal): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const principal = (role: USER_ROLES): AuthenticatedPrincipal => ({
  id: 'user-1',
  email: 'user@example.com',
  role,
});

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const requireRoles = (roles: USER_ROLES[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows a route that declares no role requirement', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor(principal(USER_ROLES.VIEWER)))).toBe(
      true,
    );
  });

  it('allows a principal holding a required role', () => {
    requireRoles([USER_ROLES.OWNER, USER_ROLES.ADMIN]);
    expect(guard.canActivate(contextFor(principal(USER_ROLES.ADMIN)))).toBe(
      true,
    );
  });

  it('answers 403, not 401, when an authenticated caller lacks the role', () => {
    requireRoles([USER_ROLES.OWNER]);

    try {
      guard.canActivate(contextFor(principal(USER_ROLES.VIEWER)));
      fail('expected the guard to refuse');
    } catch (error) {
      const response = (error as HttpException).getResponse() as {
        status: number;
        message: string;
      };
      // Re-authenticating cannot fix a permission problem, so telling the
      // client to do that (401) would be actively misleading.
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.message).toBe(AUTH_ERRORS.FORBIDDEN_ROLE);
    }
  });

  it('fails closed when a role-guarded route has no authenticated principal', () => {
    requireRoles([USER_ROLES.ADMIN]);

    try {
      guard.canActivate(contextFor(undefined));
      fail('expected the guard to refuse');
    } catch (error) {
      const response = (error as HttpException).getResponse() as {
        status: number;
      };
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  // The point of putting `role` in the token: role checks stop costing a
  // database round trip on every protected request.
  it('needs nothing but the Reflector — no user model, no database', () => {
    expect(RolesGuard.length).toBe(1);
    expect(() => new RolesGuard(new Reflector())).not.toThrow();
  });

  it('reads the role from the verified principal rather than reloading it', () => {
    requireRoles([USER_ROLES.ADMIN]);
    const request = { user: principal(USER_ROLES.ADMIN) };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
