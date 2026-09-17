import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { HttpException, HttpStatus } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationService } from 'src/modules/authorization/authorization.service';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import type { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { EmailService } from 'src/modules/email/services/email-service';
import { MediaService } from 'src/modules/media/media.service';
import { USER_SUBJECT } from 'src/modules/user/constants/user-subject.constant';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { CredentialRevocationService } from 'src/modules/auth/services/credential-revocation.service';
import { UserPolicy } from './policies/user.policy';
import { User } from './user.schema';
import { UserService } from './user.service';

const SELF = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';

/**
 * Built from the **real** policy rather than a hand-written fixture. A local
 * fixture drifts from production silently — round 5 of review found a test
 * asserting against an ability the same commit had edited, which stayed green
 * with the fix reverted.
 */
function abilityFor(role: USER_ROLES): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  new UserPolicy(new PolicyRegistry()).define(builder, {
    principal: { id: SELF, role },
  });
  return builder.build();
}

const selfOnlyAbility = () => abilityFor(USER_ROLES.VIEWER);
const elevatedAbility = () => abilityFor(USER_ROLES.ADMIN);

const userDoc = (id: string) => ({
  _id: id,
  toObject: () => ({ _id: id, name: 'someone' }),
});

describe('UserService — record-level authorization', () => {
  let service: UserService;
  let credentialRevocation: { onPasswordChanged: jest.Mock };
  let userModel: {
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };

  const statusOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { status: number }).status;

  beforeEach(async () => {
    credentialRevocation = {
      onPasswordChanged: jest.fn().mockResolvedValue(undefined),
    };
    userModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(OTHER)),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(userDoc(OTHER)),
      findByIdAndDelete: jest.fn().mockResolvedValue(userDoc(OTHER)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: MediaService, useValue: {} },
        {
          provide: CredentialRevocationService,
          useValue: credentialRevocation,
        },
        { provide: EmailService, useValue: {} },
        AuthorizationService,
      ],
    }).compile();

    service = module.get(UserService);
    // The write itself is not under test here; the refusal before it is.
    jest.spyOn(service, 'update').mockResolvedValue({} as never);
    jest.spyOn(service, 'remove').mockResolvedValue({} as never);
  });

  describe('updateAuthorized', () => {
    /**
     * The regression. `PATCH /users/:id` guards on the subject name, which
     * CASL answers without evaluating conditions — so this caller clears the
     * guard. Only this check stops them editing someone else.
     */
    it('refuses a self-only caller updating another user', async () => {
      try {
        await service.updateAuthorized(
          OTHER,
          { name: 'hijacked' },
          undefined as never,
          selfOnlyAbility(),
        );
        fail('expected a refusal');
      } catch (error) {
        expect(statusOf(error)).toBe(HttpStatus.FORBIDDEN);
      }
      expect(service.update).not.toHaveBeenCalled();
    });

    it('allows that caller to update themselves', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(SELF)),
      });

      await service.updateAuthorized(
        SELF,
        { name: 'fine' },
        undefined as never,
        selfOnlyAbility(),
      );

      expect(service.update).toHaveBeenCalledWith(
        SELF,
        { name: 'fine' },
        undefined,
      );
    });

    it('allows an elevated caller to update anyone', async () => {
      await service.updateAuthorized(
        OTHER,
        { name: 'fine' },
        undefined as never,
        elevatedAbility(),
      );

      expect(service.update).toHaveBeenCalled();
    });

    it('refuses when no ability was supplied', async () => {
      await expect(
        service.updateAuthorized(
          OTHER,
          { name: 'x' },
          undefined as never,
          undefined,
        ),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('reports a missing user without consulting the ability', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await service.updateAuthorized(
        OTHER,
        { name: 'x' },
        undefined as never,
        undefined,
      );

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('removeAuthorized', () => {
    it('refuses a self-only caller deleting another user', async () => {
      await expect(
        service.removeAuthorized(OTHER, selfOnlyAbility()),
      ).rejects.toBeInstanceOf(HttpException);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('allows an elevated caller to delete another user', async () => {
      await service.removeAuthorized(OTHER, elevatedAbility());

      expect(service.remove).toHaveBeenCalledWith(OTHER);
    });

    /**
     * The policy forbids self-delete through the admin route. That rule is
     * invisible to the route guard, so this is the only place it takes effect.
     */
    it('enforces the self-delete carve-out an elevated caller would otherwise pass', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(SELF)),
      });

      await expect(
        service.removeAuthorized(SELF, elevatedAbility()),
      ).rejects.toBeInstanceOf(HttpException);
      expect(service.remove).not.toHaveBeenCalled();
    });
  });

  describe('findOneAuthorized', () => {
    it('refuses a self-only caller reading another user', async () => {
      await expect(
        service.findOneAuthorized(OTHER, selfOnlyAbility()),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('allows that caller to read themselves', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(SELF)),
      });

      const result = await service.findOneAuthorized(SELF, selfOnlyAbility());

      expect(result.status).toBe(HttpStatus.OK);
    });
  });

  describe('self-service field limits', () => {
    beforeEach(() => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(SELF)),
      });
    });

    /**
     * The escalation from the second review round: the record check passes —
     * it is their own record — so only the field check stops a self-service
     * role change. `update()` spreads the DTO unfiltered.
     */
    it('refuses a caller changing their own role', async () => {
      await expect(
        service.updateAuthorized(
          SELF,
          { role: 'OWNER' } as never,
          undefined as never,
          selfOnlyAbility(),
        ),
      ).rejects.toBeInstanceOf(HttpException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('refuses a caller changing their own email directly', async () => {
      await expect(
        service.updateAuthorized(
          SELF,
          { email: 'new@example.com' },
          undefined as never,
          selfOnlyAbility(),
        ),
      ).rejects.toBeInstanceOf(HttpException);
    });

    it('allows the safe fields through', async () => {
      await service.updateAuthorized(
        SELF,
        { name: 'New Name', phone: '+44' },
        undefined as never,
        selfOnlyAbility(),
      );

      expect(service.update).toHaveBeenCalled();
    });

    it('refuses a caller setting their own password here', async () => {
      await expect(
        service.updateAuthorized(
          SELF,
          { password: 'new-password' },
          undefined as never,
          selfOnlyAbility(),
        ),
      ).rejects.toBeInstanceOf(HttpException);
    });

    /**
     * `avatar` is written from the uploaded file, not the DTO, so enumerating
     * the DTO alone would let it through unchecked. Regression pin: an ability
     * without `avatar` must refuse an upload.
     */
    it('checks avatar when a file is attached', async () => {
      const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
      can(Action.Update, USER_SUBJECT, ['name'], { _id: SELF });

      await expect(
        service.updateAuthorized(
          SELF,
          { name: 'ok' },
          { originalname: 'a.png' } as never,
          build(),
        ),
      ).rejects.toBeInstanceOf(HttpException);
    });

    /**
     * A key the caller did not really send is not a field they are attempting.
     * Pinned by asserting the enumerated list, not just that the call
     * succeeded — success alone also passes if the filter is removed and the
     * ability happens to permit the field.
     */
    it('does not treat a key set to undefined as an attempted field', async () => {
      const assertCan = jest.spyOn(
        service['authorizationService'],
        'assertCan',
      );

      await service.updateAuthorized(
        SELF,
        { name: 'New Name', role: undefined },
        undefined as never,
        selfOnlyAbility(),
      );

      const fields = assertCan.mock.calls[0][4];
      expect(fields).toEqual(['name']);
      expect(fields).not.toContain('role');
    });

    it('still lets an elevated caller change a role', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(OTHER)),
      });

      await service.updateAuthorized(
        OTHER,
        { role: 'ADMIN' } as never,
        undefined as never,
        elevatedAbility(),
      );

      expect(service.update).toHaveBeenCalled();
    });
  });

  describe('side effects that must travel with the field', () => {
    beforeEach(() => {
      // The outer beforeEach stubs `update` so the authorization tests can
      // assert on the refusal without running the write. These cases are
      // about what the real `update` does, so restore it.
      (service.update as jest.Mock).mockRestore();

      userModel.findById.mockResolvedValue({
        _id: OTHER,
        email: 'old@example.com',
      });
      userModel.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(userDoc(OTHER)),
      });
    });

    /**
     * A reset that leaves stolen credentials working is not a reset. Round 6
     * found `update()` hashing a new password while skipping the revocation
     * `AuthService.changePassword` has always done — so an admin remediating a
     * compromised account changed nothing an attacker cared about.
     */
    it('revokes every derived credential when a password is written', async () => {
      await service.update(
        OTHER,
        { password: 'new-password' },
        undefined as never,
      );

      expect(credentialRevocation.onPasswordChanged).toHaveBeenCalledWith(
        OTHER,
        'old@example.com',
      );
    });

    it('leaves credentials alone when no password is written', async () => {
      await service.update(OTHER, { name: 'New Name' }, undefined as never);

      expect(credentialRevocation.onPasswordChanged).not.toHaveBeenCalled();
    });

    /** Moving the address must not carry its verified status with it. */
    it('clears emailVerified when the address actually changes', async () => {
      userModel.findById.mockResolvedValue({
        _id: OTHER,
        email: 'old@example.com',
      });

      await service.update(
        OTHER,
        { email: 'new@example.com' },
        undefined as never,
      );

      const [, payload] = userModel.findByIdAndUpdate.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(payload.emailVerified).toBe(false);
    });

    it('leaves emailVerified alone when the address is unchanged', async () => {
      userModel.findById.mockResolvedValue({
        _id: OTHER,
        email: 'same@example.com',
      });

      await service.update(
        OTHER,
        { email: 'same@example.com' },
        undefined as never,
      );

      const [, payload] = userModel.findByIdAndUpdate.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(payload).not.toHaveProperty('emailVerified');
    });
  });
});
