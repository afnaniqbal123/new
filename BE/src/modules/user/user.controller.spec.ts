import 'reflect-metadata';
import { OrganizationAccessGuard } from 'src/modules/auth/guards/organization-access.guard';
import { TENANT_SCOPED_KEY } from 'src/modules/auth/decorator/tenant-scoped.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserController } from './user.controller';

const controllerGuards = () =>
  (Reflect.getMetadata('__guards__', UserController) ?? []) as unknown[];

const handler = (name: string) =>
  (UserController.prototype as unknown as Record<string, object>)[name];

/**
 * Wiring, not behaviour — asserted because the wiring is load-bearing and
 * invisible. Nest runs controller-level guards before route-level ones, so
 * moving either of these guards, or reordering them, silently changes what
 * the authorization layer can see. Nothing else in the suite would notice.
 */
describe('UserController — guard wiring', () => {
  it('runs the tenant guard before the permissions guard', () => {
    const guards = controllerGuards();
    const tenant = guards.indexOf(OrganizationAccessGuard);
    const permissions = guards.indexOf(PermissionsGuard);

    expect(tenant).toBeGreaterThanOrEqual(0);
    expect(permissions).toBeGreaterThanOrEqual(0);
    // Reversed, the ability is built with organizationId: undefined and every
    // tenant-conditioned rule evaluates against nothing.
    expect(tenant).toBeLessThan(permissions);
  });

  it('declares both guards at controller level, not per route', () => {
    // Route-level placement is what caused the ordering bug: Nest cannot
    // interleave levels, so a route-level tenant guard always runs last.
    for (const route of ['findAllUsers', 'findOne', 'update', 'remove']) {
      const routeGuards = (Reflect.getMetadata('__guards__', handler(route)) ??
        []) as unknown[];
      expect(routeGuards).not.toContain(OrganizationAccessGuard);
      expect(routeGuards).not.toContain(PermissionsGuard);
    }
  });

  it('marks exactly the tenant-scoped route', () => {
    expect(
      Reflect.getMetadata(TENANT_SCOPED_KEY, handler('findAllUsers')),
    ).toBe(true);

    // The tenant guard stands aside without the marker, so a stray one would
    // demand an organization on a route that has no tenant dimension.
    for (const route of [
      'findOne',
      'update',
      'remove',
      'updateMe',
      'findAll',
    ]) {
      expect(
        Reflect.getMetadata(TENANT_SCOPED_KEY, handler(route)),
      ).toBeUndefined();
    }
  });
});

/**
 * `updateMe` forwards a hand-picked subset rather than the whole DTO, and
 * reaches the *unchecked* `UserService.update` — so nothing in the
 * authorization layer covers it. Round 5 found the whitelist untested:
 * re-adding `password` broke nothing.
 */
describe('UserController — self-service whitelist', () => {
  let controller: UserController;
  let userService: { update: jest.Mock };

  beforeEach(async () => {
    userService = { update: jest.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    })
      .overrideGuard(OrganizationAccessGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UserController);
  });

  it('forwards only the fields a user may change about themselves', async () => {
    await controller.updateMe(
      'user-1',
      {
        name: 'New Name',
        phone: '+44',
        languagePreference: 'de',
        // Everything below has its own verified flow, or is self-elevation.
        password: 'hijack',
        email: 'attacker@example.com',
        role: 'OWNER',
      } as never,
      undefined as never,
    );

    const [, forwarded] = userService.update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(Object.keys(forwarded).sort()).toEqual([
      'languagePreference',
      'name',
      'phone',
    ]);
  });

  it('targets the caller, never an id from the request', async () => {
    await controller.updateMe('user-1', { name: 'x' }, undefined as never);

    expect(userService.update).toHaveBeenCalledWith(
      'user-1',
      expect.anything(),
      undefined,
    );
  });
});
