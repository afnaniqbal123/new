import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
/**
 * Builds the ability for one caller by composing every registered policy.
 *
 * The factory knows nothing about roles, users, or any domain noun. It
 * collects whatever policies were registered and runs them in order, which is
 * what lets a module add permissions without this file changing.
 *
 * Rules are composed, not merged: CASL evaluates `cannot` after `can`, so a
 * policy can carve an exception out of a broader grant made elsewhere.
 */
@Injectable()
export class AbilityFactory {
  constructor(private readonly registry: PolicyRegistry) {}

  createFor(context: AuthorizationContext): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

    // An empty registry yields an ability that permits nothing. That is the
    // right default: an application with no rules should refuse, not wave
    // callers through.
    for (const policy of this.registry.all()) {
      policy.define(builder, context);
    }

    return builder.build({
      // Subjects arrive either as a name or as an instance tagged by CASL's
      // `subject()` helper. Mongoose documents have no usable constructor
      // name, so the tag is the only reliable signal — an untagged object is
      // reported as its own type and matches no rule, which fails closed.
      detectSubjectType: (item) =>
        typeof item === 'string'
          ? item
          : ((item as { __caslSubjectType__?: string }).__caslSubjectType__ ??
            item.constructor?.name),
    });
  }
}
