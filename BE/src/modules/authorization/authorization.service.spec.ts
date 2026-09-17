import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';
import { AuthorizationService } from './authorization.service';

const SUBJECT = 'Widget';
const OWNED = { _id: 'me', name: 'mine' };
const FOREIGN = { _id: 'someone-else', name: 'theirs' };

/** Grants read on records the caller owns, and nothing else. */
function ownerOnlyAbility(): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  can(Action.Read, SUBJECT, { _id: 'me' });
  return build();
}

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  const statusOf = (error: unknown) =>
    ((error as HttpException).getResponse() as { status: number }).status;

  describe('assertCan', () => {
    it('permits an action on a record the ability admits', () => {
      expect(() =>
        service.assertCan(ownerOnlyAbility(), Action.Read, SUBJECT, OWNED),
      ).not.toThrow();
    });

    it('refuses with 403 on a record the ability excludes', () => {
      try {
        service.assertCan(ownerOnlyAbility(), Action.Read, SUBJECT, FOREIGN);
        fail('expected a refusal');
      } catch (error) {
        expect(statusOf(error)).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('refuses an action the ability never grants', () => {
      expect(() =>
        service.assertCan(ownerOnlyAbility(), Action.Delete, SUBJECT, OWNED),
      ).toThrow(HttpException);
    });

    /**
     * A missing ability means PermissionsGuard never ran. Treating that as
     * permission would make a forgotten guard indistinguishable from a passed
     * check — the failure mode this method exists to prevent.
     */
    it('refuses when no ability was supplied', () => {
      expect(() =>
        service.assertCan(undefined, Action.Read, SUBJECT, OWNED),
      ).toThrow(HttpException);
    });

    // Without the subject tag CASL infers the type from the constructor, which
    // for a plain object or a Mongoose document matches no rule.
    it('tags the record so conditions are evaluated against it', () => {
      const ability = ownerOnlyAbility();
      const spy = jest.spyOn(ability, 'can');

      service.assertCan(ability, Action.Read, SUBJECT, OWNED);

      const [, tagged] = spy.mock.calls[0] as [Action, Record<string, unknown>];
      expect(tagged).toMatchObject({ _id: 'me' });
    });
  });

  describe('field-level checks', () => {
    /** Grants two fields on records the caller owns, and nothing else. */
    function fieldLimitedAbility(): AppAbility {
      const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
      can(Action.Update, SUBJECT, ['name', 'phone'], { _id: 'me' });
      return build();
    }

    it('permits an update touching only granted fields', () => {
      expect(() =>
        service.assertCan(
          fieldLimitedAbility(),
          Action.Update,
          SUBJECT,
          OWNED,
          ['name', 'phone'],
        ),
      ).not.toThrow();
    });

    /**
     * The record check passes — it is their record — so only the field check
     * separates "edit your profile" from "change your role".
     */
    it('refuses when any single field falls outside the grant', () => {
      expect(() =>
        service.assertCan(
          fieldLimitedAbility(),
          Action.Update,
          SUBJECT,
          OWNED,
          ['name', 'role'],
        ),
      ).toThrow(HttpException);
    });

    it('refuses a field the grant never mentions', () => {
      expect(() =>
        service.assertCan(
          fieldLimitedAbility(),
          Action.Update,
          SUBJECT,
          OWNED,
          ['role'],
        ),
      ).toThrow(HttpException);
    });

    // Field checks must be inert until a policy narrows something, or every
    // existing grant would start refusing.
    it('permits every field when the grant names none', () => {
      const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
      can(Action.Update, SUBJECT, { _id: 'me' });

      expect(() =>
        service.assertCan(build(), Action.Update, SUBJECT, OWNED, [
          'name',
          'role',
          'anything',
        ]),
      ).not.toThrow();
    });

    it('ignores fields entirely when none are supplied', () => {
      expect(() =>
        service.assertCan(fieldLimitedAbility(), Action.Update, SUBJECT, OWNED),
      ).not.toThrow();
    });
  });
});
