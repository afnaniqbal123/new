import { Injectable } from '@nestjs/common';
import { AuthorizationPolicy } from 'src/modules/authorization/types/authorization-policy.type';

/**
 * Where domain policies collect.
 *
 * Nest has no Angular-style multi-provider, so policies register themselves
 * rather than being injected as a list. Each policy is a provider in its own
 * module and calls `register` from `onModuleInit`, which keeps the direction
 * of knowledge right: the authorization module never learns which domain
 * modules exist, and a module can add rules without editing anything here.
 *
 * Registration order is module initialisation order. It does not matter:
 * CASL evaluates every `can` rule and applies `cannot` last regardless of
 * where each was declared.
 */
@Injectable()
export class PolicyRegistry {
  private readonly policies: AuthorizationPolicy[] = [];

  register(policy: AuthorizationPolicy): void {
    this.policies.push(policy);
  }

  all(): readonly AuthorizationPolicy[] {
    return this.policies;
  }
}
