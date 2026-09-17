import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { USER_SUBJECT } from 'src/modules/user/constants/user-subject.constant';
import { UserPolicy } from './user.policy';

const SELF = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439022';

/** Build the ability this policy produces for a given caller. */
function abilityFor(context: AuthorizationContext): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  new UserPolicy(new PolicyRegistry()).define(builder, context);
  return builder.build();
}

const asRole = (role: USER_ROLES) =>
  abilityFor({ principal: { id: SELF, role } });

const userRecord = (id: string) => subject(USER_SUBJECT, { _id: id });

describe('UserPolicy', () => {
  describe('anonymous callers', () => {
    it('grants nothing at all', () => {
      const ability = abilityFor({});

      expect(ability.can(Action.Read, USER_SUBJECT)).toBe(false);
      expect(ability.can(Action.List, USER_SUBJECT)).toBe(false);
      expect(ability.can(Action.Update, USER_SUBJECT)).toBe(false);
    });
  });

  describe('elevated roles', () => {
    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s may manage users',
      (role) => {
        const ability = asRole(role);

        expect(ability.can(Action.List, USER_SUBJECT)).toBe(true);
        expect(ability.can(Action.Read, userRecord(OTHER))).toBe(true);
        expect(ability.can(Action.Update, userRecord(OTHER))).toBe(true);
        expect(ability.can(Action.Delete, userRecord(OTHER))).toBe(true);
      },
    );

    /**
     * Carved out of Manage on purpose: deleting yourself through the admin
     * route could strand an organization with no owner. Account closure needs
     * its own flow, not a side effect of a broad grant.
     */
    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s still may not delete themselves',
      (role) => {
        expect(asRole(role).can(Action.Delete, userRecord(SELF))).toBe(false);
      },
    );
  });

  describe('MEMBER', () => {
    it('may list the directory', () => {
      expect(asRole(USER_ROLES.CASHIER).can(Action.List, USER_SUBJECT)).toBe(
        true,
      );
    });

    // Preserves what @Roles(OWNER, ADMIN) allowed on GET /users/:id — a
    // member browsing the directory does not get to open an arbitrary entry.
    it('may not read another user’s record', () => {
      expect(
        asRole(USER_ROLES.CASHIER).can(Action.Read, userRecord(OTHER)),
      ).toBe(false);
    });

    it('may not update or delete another user', () => {
      const ability = asRole(USER_ROLES.CASHIER);

      expect(ability.can(Action.Update, userRecord(OTHER))).toBe(false);
      expect(ability.can(Action.Delete, userRecord(OTHER))).toBe(false);
    });
  });

  describe('VIEWER', () => {
    it('gets nothing beyond their own record', () => {
      const ability = asRole(USER_ROLES.VIEWER);

      expect(ability.can(Action.List, USER_SUBJECT)).toBe(false);
      expect(ability.can(Action.Read, userRecord(OTHER))).toBe(false);
      expect(ability.can(Action.Read, userRecord(SELF))).toBe(true);
    });
  });

  describe('ownership', () => {
    it.each([[USER_ROLES.CASHIER], [USER_ROLES.VIEWER]])(
      '%s may read and update their own record',
      (role) => {
        const ability = asRole(role);

        expect(ability.can(Action.Read, userRecord(SELF))).toBe(true);
        expect(ability.can(Action.Update, userRecord(SELF))).toBe(true);
      },
    );

    it('does not let ownership leak to another record', () => {
      const ability = asRole(USER_ROLES.VIEWER);

      expect(ability.can(Action.Update, userRecord(OTHER))).toBe(false);
    });
  });

  describe('the coarse-check trap', () => {
    /**
     * CASL's name-only check ignores conditions, so a caller holding only the
     * self-grant still passes `can(Read, 'User')`. This is why routes that
     * read one record also assert against the record itself — the behaviour
     * is asserted here so a future change to the policy cannot silently make
     * the route guard sufficient on its own.
     */
    it('passes a name-only Read for a caller who may only read themselves', () => {
      const ability = asRole(USER_ROLES.VIEWER);

      expect(ability.can(Action.Read, USER_SUBJECT)).toBe(true);
      expect(ability.can(Action.Read, userRecord(OTHER))).toBe(false);
    });

    /**
     * This is the one that shipped as a bug and was caught in review on #26:
     * `PATCH /users/:id` guarded on the name only, so a VIEWER cleared it and
     * `UserService.update()` did the edit. Fixed by `updateAuthorized`.
     */
    it('passes a name-only Update for a caller who may only update themselves', () => {
      const ability = asRole(USER_ROLES.VIEWER);

      expect(ability.can(Action.Update, USER_SUBJECT)).toBe(true);
      expect(ability.can(Action.Update, userRecord(OTHER))).toBe(false);
    });
  });

  describe('unknown roles', () => {
    it('grants nothing beyond the self-grant', () => {
      const ability = abilityFor({
        principal: { id: SELF, role: 'SOMETHING_ELSE' },
      });

      expect(ability.can(Action.List, USER_SUBJECT)).toBe(false);
      expect(ability.can(Action.Read, userRecord(OTHER))).toBe(false);
      expect(ability.can(Action.Read, userRecord(SELF))).toBe(true);
    });
  });

  describe('self-service field limits', () => {
    /**
     * The escalation found in the second review round on #26. A self-update
     * grant plus an unfiltered DTO meant `PATCH /users/<own id>` with
     * `{"role":"OWNER"}` cleared both the guard and the record check — it *is*
     * their record — and `update()` wrote the role. Worse than the
     * OWNER/ADMIN-only route it replaced.
     */
    it('does not let a caller change their own role', () => {
      for (const role of [USER_ROLES.VIEWER, USER_ROLES.CASHIER]) {
        expect(asRole(role).can(Action.Update, userRecord(SELF), 'role')).toBe(
          false,
        );
      }
    });

    it('does not let a caller change their own email directly', () => {
      // changeEmail has its own password-verified flow.
      expect(
        asRole(USER_ROLES.CASHIER).can(
          Action.Update,
          userRecord(SELF),
          'email',
        ),
      ).toBe(false);
    });

    /**
     * `password` is deliberately absent. `AuthService.changePassword` verifies
     * the current password and revokes every session; writing it through the
     * profile route does neither, which turns a stolen access token into
     * permanent takeover.
     */
    it('does not let a caller change their own password here', () => {
      expect(
        asRole(USER_ROLES.CASHIER).can(
          Action.Update,
          userRecord(SELF),
          'password',
        ),
      ).toBe(false);
    });

    it.each([['name'], ['phone'], ['languagePreference'], ['avatar']])(
      'lets a caller change their own %s',
      (field) => {
        expect(
          asRole(USER_ROLES.VIEWER).can(Action.Update, userRecord(SELF), field),
        ).toBe(true);
      },
    );

    it('still lets an elevated role change anyone’s role', () => {
      expect(
        asRole(USER_ROLES.ADMIN).can(Action.Update, userRecord(OTHER), 'role'),
      ).toBe(true);
    });
  });

  describe('protected fields on your own record', () => {
    /**
     * Round 5's finding. `Manage` is granted unconditioned to OWNER/ADMIN, and
     * an unconditioned grant matches the caller's own record too — so listing
     * fields in the self-grant did nothing for them. An admin could still
     * change their own password here, skipping the current-password check and
     * the session revocation, which is the exact takeover the field list was
     * added to prevent.
     */
    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s may not change their own password, email or role',
      (role) => {
        const ability = asRole(role);

        for (const field of ['password', 'email', 'role']) {
          expect(ability.can(Action.Update, userRecord(SELF), field)).toBe(
            false,
          );
        }
      },
    );

    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s keeps full control over other users',
      (role) => {
        const ability = asRole(role);

        for (const field of ['password', 'email', 'role']) {
          expect(ability.can(Action.Update, userRecord(OTHER), field)).toBe(
            true,
          );
        }
      },
    );

    it('leaves ordinary self-service fields alone for elevated roles', () => {
      expect(
        asRole(USER_ROLES.ADMIN).can(Action.Update, userRecord(SELF), 'name'),
      ).toBe(true);
    });
  });
});
