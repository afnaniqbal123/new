import { subject as tagSubject } from '@casl/ability';
import { HttpStatus, Injectable } from '@nestjs/common';
import { SerializeHttpError } from 'src/utils/serializer';
import { AUTHORIZATION_ERRORS } from 'src/modules/authorization/constants/api-response/authorization.response';
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { AppAbility } from 'src/modules/authorization/types/app-ability.type';

/**
 * Resource-level authorization: the checks that cannot be made until the
 * record exists.
 *
 * `PermissionsGuard` answers "may this caller read users at all?" before the
 * handler runs. It cannot answer "may they read *this* user?", because
 * nothing has been loaded yet. That question belongs to the service that owns
 * the data, immediately after it loads the record and before it acts on it.
 *
 * Takes an `AppAbility` rather than a request, so the same call works from an
 * HTTP handler, a queue worker, or a socket — and from a test without a fake
 * request.
 */
@Injectable()
export class AuthorizationService {
  /**
   * Refuse unless the caller may perform `action` on this specific `resource`.
   *
   * The resource is tagged with its subject name before the check. Without the
   * tag CASL infers the type from the constructor, and a Mongoose document or
   * a `.lean()` result infers as something no rule mentions — which would then
   * match nothing and refuse everything.
   */
  assertCan(
    ability: AppAbility | undefined,
    action: Action,
    subjectName: string,
    resource: Record<string, unknown>,
    fields?: readonly string[],
  ): void {
    // No ability means `PermissionsGuard` never ran on this route. Treat that
    // as a refusal, not as permission: a missing guard must not read as a
    // granted check.
    if (!ability) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTHORIZATION_ERRORS.FORBIDDEN,
      );
    }

    const target = tagSubject(subjectName, resource);

    if (!ability.can(action, target)) {
      return SerializeHttpError(
        null,
        HttpStatus.FORBIDDEN,
        AUTHORIZATION_ERRORS.FORBIDDEN,
      );
    }

    // Field-level. "May you update this record" and "may you update *this
    // field* of it" are different questions, and conflating them is how a
    // self-service profile edit becomes a role change. Every field the caller
    // is attempting must be permitted; a rule granted without a field list
    // permits all of them, so this is a no-op unless a policy narrows it.
    for (const field of fields ?? []) {
      if (!ability.can(action, target, field)) {
        return SerializeHttpError(
          null,
          HttpStatus.FORBIDDEN,
          AUTHORIZATION_ERRORS.FORBIDDEN,
        );
      }
    }
  }
}
