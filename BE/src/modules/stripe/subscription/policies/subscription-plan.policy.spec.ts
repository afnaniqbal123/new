import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import { SUBSCRIPTION_PLAN_SUBJECT } from '../constants/subscription-plan-subject.constant';
import { SubscriptionPlanPolicy } from './subscription-plan.policy';

const CALLER = '507f1f77bcf86cd799439011';

/** Build the ability this policy produces for a given caller. */
function abilityFor(context: AuthorizationContext): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  new SubscriptionPlanPolicy(new PolicyRegistry()).define(builder, context);
  return builder.build();
}

const asRole = (role: USER_ROLES) =>
  abilityFor({ principal: { id: CALLER, role } });

describe('SubscriptionPlanPolicy', () => {
  describe('elevated roles', () => {
    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s may create a subscription plan',
      (role) => {
        expect(asRole(role).can(Action.Create, SUBSCRIPTION_PLAN_SUBJECT)).toBe(
          true,
        );
      },
    );
  });

  describe('everyone else', () => {
    it.each([[USER_ROLES.CASHIER], [USER_ROLES.VIEWER]])(
      '%s may not create a subscription plan',
      (role) => {
        expect(asRole(role).can(Action.Create, SUBSCRIPTION_PLAN_SUBJECT)).toBe(
          false,
        );
      },
    );

    it('grants an anonymous caller nothing', () => {
      expect(abilityFor({}).can(Action.Create, SUBSCRIPTION_PLAN_SUBJECT)).toBe(
        false,
      );
    });

    it('grants nothing for a role this policy does not know', () => {
      const ability = abilityFor({
        principal: { id: CALLER, role: 'AUDITOR' },
      });

      expect(ability.can(Action.Create, SUBSCRIPTION_PLAN_SUBJECT)).toBe(false);
    });
  });

  /**
   * The grant is `Create` alone, not `Manage`. If someone widens it, these
   * fail and the wider grant gets looked at rather than arriving silently.
   */
  describe('the breadth of the elevated grant', () => {
    it.each([[USER_ROLES.OWNER], [USER_ROLES.ADMIN]])(
      '%s holds no plan permission beyond creating one',
      (role) => {
        const ability = asRole(role);

        expect(ability.can(Action.Update, SUBSCRIPTION_PLAN_SUBJECT)).toBe(
          false,
        );
        expect(ability.can(Action.Delete, SUBSCRIPTION_PLAN_SUBJECT)).toBe(
          false,
        );
      },
    );
  });

  /**
   * The failure this catches is silent: an unregistered policy contributes no
   * rules, the ability comes back empty, and the route answers 403 to everyone
   * with nothing logged and nothing thrown.
   */
  describe('registration', () => {
    it('registers itself so the ability factory picks up its rules', () => {
      const registry = new PolicyRegistry();

      new SubscriptionPlanPolicy(registry).onModuleInit();

      expect(registry.all()).toHaveLength(1);
    });
  });
});
