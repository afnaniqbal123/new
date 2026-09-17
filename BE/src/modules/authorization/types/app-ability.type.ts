import { MongoAbility, Subject as CaslSubject } from '@casl/ability';
import { Action } from 'src/modules/authorization/constants/authorization.constant';

/**
 * A subject is either a name (`'User'`) or a record tagged with one via CASL's
 * `subject()` helper.
 *
 * CASL's own `Subject` is reused rather than redeclared: a hand-written
 * `string | Record<string, unknown>` looks equivalent and is not — it rejects
 * what `subject()` actually returns, because the tag adds a branded property
 * an index signature will not accept.
 *
 * Left open rather than narrowed to a union of known names so a new module can
 * introduce a subject without editing this file. A closed union would make
 * every feature a change to the authorization module.
 */
export type Subject = CaslSubject;

/** The ability type used everywhere. One alias, so rules and checks agree. */
export type AppAbility = MongoAbility<[Action, Subject]>;

/**
 * What policies get to reason about.
 *
 * Note what is absent: no request, no database, no role *enum*. `role` is an
 * opaque string here because the mechanism does not own the role vocabulary —
 * domain policies do, and they narrow it themselves. That is what keeps this
 * module free of a dependency on `user`, and out of the module cycle that
 * would otherwise form.
 */
export type AuthorizationContext = {
  /** Authenticated caller. Absent means anonymous. */
  principal?: {
    id: string;
    role: string;
  };
  /**
   * Tenant the caller was *authorized* into by `OrganizationAccessGuard` —
   * never the raw `x-organization-id` header. See ADR 0001 §8.
   */
  organizationId?: string;
};
