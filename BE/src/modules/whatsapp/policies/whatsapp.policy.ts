import { AbilityBuilder } from '@casl/ability';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
import { AuthorizationPolicy } from 'src/modules/authorization/types/authorization-policy.type';
import { USER_ROLES } from 'src/modules/user/constants/user.constant';
import {
  CONVERSATION_SUBJECT,
  DRAFT_ORDER_SUBJECT,
} from 'src/modules/whatsapp/constants/whatsapp.constant';

/**
 * Who may read the inbox, reply, and turn a draft into a sale.
 *
 * Confirming a draft *is* selling — it creates a real invoice, moves real
 * stock and can put a customer on credit. So `Create` on
 * `DRAFT_ORDER_SUBJECT` is granted to exactly the roles that may create a
 * sale at the counter, and to no one else. An accountant can read the whole
 * inbox and cannot commit an order from it.
 */
@Injectable()
export class WhatsAppPolicy implements AuthorizationPolicy, OnModuleInit {
  constructor(private readonly registry: PolicyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  define(
    builder: AbilityBuilder<AppAbility>,
    context: AuthorizationContext,
  ): void {
    const { can } = builder;
    const principal = context.principal;

    if (!principal) {
      return;
    }

    const role = principal.role as USER_ROLES;

    // The inbox is readable by everyone: a customer's message is operational
    // information, and hiding it from the person at the counter is exactly
    // the silo this product exists to remove.
    can(Action.List, CONVERSATION_SUBJECT);
    can(Action.Read, CONVERSATION_SUBJECT);
    can(Action.List, DRAFT_ORDER_SUBJECT);
    can(Action.Read, DRAFT_ORDER_SUBJECT);

    switch (role) {
      case USER_ROLES.OWNER:
      case USER_ROLES.ADMIN:
      case USER_ROLES.MANAGER:
        can(Action.Manage, CONVERSATION_SUBJECT);
        can(Action.Manage, DRAFT_ORDER_SUBJECT);
        break;

      case USER_ROLES.CASHIER:
        // Replies to customers and commits orders — the same authority they
        // already have at the till, applied to a different channel.
        can(Action.Create, CONVERSATION_SUBJECT);
        can(Action.Update, CONVERSATION_SUBJECT);
        can(Action.Create, DRAFT_ORDER_SUBJECT);
        can(Action.Update, DRAFT_ORDER_SUBJECT);
        break;

      case USER_ROLES.ACCOUNTANT:
        // May reply — chasing a payment over WhatsApp is their job. May not
        // confirm a draft, because that creates a sale.
        can(Action.Create, CONVERSATION_SUBJECT);
        can(Action.Update, CONVERSATION_SUBJECT);
        break;

      case USER_ROLES.VIEWER:
        break;
    }
  }
}
