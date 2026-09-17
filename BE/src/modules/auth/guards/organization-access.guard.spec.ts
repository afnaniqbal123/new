import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { AUTH_ERRORS } from 'src/modules/auth/constants/api-response/auth.response';
import { ORGANIZATION_HEADER } from 'src/modules/auth/constants/auth.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { OrganizationAccessGuard } from './organization-access.guard';

type Request = {
  user?: { id: string; email: string; role: USER_ROLES };
  headers: Record<string, string | undefined>;
  organizationId?: string;
  requestedOrganizationId?: string;
};

const MEMBER_ORG = new Types.ObjectId();
const OTHER_ORG = new Types.ObjectId();

const principal = {
  id: new Types.ObjectId().toString(),
  email: 'user@example.com',
  role: USER_ROLES.ADMIN,
};

describe('OrganizationAccessGuard', () => {
  let request: Request;
  let guard: OrganizationAccessGuard;
  let userModel: { findById: jest.Mock };
  let reflector: Reflector;

  const buildGuard = (organization: Types.ObjectId | undefined) => {
    userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue(
            organization ? { organization } : { organization: undefined },
          ),
      }),
    };
    return new OrganizationAccessGuard(userModel as never, reflector);
  };

  const context = () =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const statusOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { status: number }).status;
  const messageOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { message: string }).message;

  beforeEach(() => {
    reflector = new Reflector();
    // Every existing case exercises a tenant-scoped route; the skip path has
    // its own test below.
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    request = {
      user: principal,
      headers: { [ORGANIZATION_HEADER]: MEMBER_ORG.toString() },
    };
    guard = buildGuard(MEMBER_ORG);
  });

  it('admits a caller into an organization they belong to', async () => {
    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(request.organizationId).toBe(MEMBER_ORG.toString());
  });

  // The heart of it: before this guard existed the header was copied straight
  // onto the request, so naming an organization was the same as belonging to it.
  it('denies a caller who names an organization they do not belong to', async () => {
    request.headers[ORGANIZATION_HEADER] = OTHER_ORG.toString();

    try {
      await guard.canActivate(context());
      fail('expected the guard to refuse');
    } catch (error) {
      expect(statusOf(error)).toBe(HttpStatus.FORBIDDEN);
      expect(messageOf(error)).toBe(AUTH_ERRORS.ORGANIZATION_ACCESS_DENIED);
    }
  });

  it('leaves no trusted tenant context behind when it denies', async () => {
    request.headers[ORGANIZATION_HEADER] = OTHER_ORG.toString();

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(request.organizationId).toBeUndefined();
  });

  it('denies a caller who belongs to no organization at all', async () => {
    guard = buildGuard(undefined);

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(request.organizationId).toBeUndefined();
  });

  it('keeps the caller-supplied value separate from the authorized one', async () => {
    await guard.canActivate(context());

    expect(request.requestedOrganizationId).toBe(MEMBER_ORG.toString());
    expect(request.organizationId).toBe(MEMBER_ORG.toString());
  });

  it('rejects a missing organization header', async () => {
    request.headers = {};

    try {
      await guard.canActivate(context());
      fail('expected the guard to refuse');
    } catch (error) {
      expect(statusOf(error)).toBe(HttpStatus.BAD_REQUEST);
      expect(messageOf(error)).toBe(AUTH_ERRORS.ORGANIZATION_REQUIRED);
    }
  });

  it('rejects a malformed organization header before it reaches the database', async () => {
    request.headers[ORGANIZATION_HEADER] = 'not-an-object-id';

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      HttpException,
    );
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated request', async () => {
    request.user = undefined;

    try {
      await guard.canActivate(context());
      fail('expected the guard to refuse');
    } catch (error) {
      expect(statusOf(error)).toBe(HttpStatus.UNAUTHORIZED);
    }
  });

  it('resolves membership for the authenticated caller, not for the id they sent', async () => {
    await guard.canActivate(context());

    expect(userModel.findById).toHaveBeenCalledWith(principal.id);
  });

  describe('routes that are not tenant-scoped', () => {
    /**
     * The guard sits at controller level so it runs before PermissionsGuard.
     * That only works if it stands aside on routes with no tenant dimension —
     * otherwise every route in the controller would demand an organization.
     */
    it('stands aside without touching the database', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      request.headers = {};

      await expect(guard.canActivate(context())).resolves.toBe(true);
      expect(userModel.findById).not.toHaveBeenCalled();
      expect(request.organizationId).toBeUndefined();
    });
  });
});
