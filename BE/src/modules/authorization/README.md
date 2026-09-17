# Authorization module

The permissions mechanism. It owns _how_ permissions are asked, never _what_
they are — rules live in the module that owns the data.

- Architecture contract: [`docs/architecture/security/authorization.md`](../../../docs/architecture/security/authorization.md)
- How to use it: [`docs/guides/permissions.md`](../../../docs/guides/permissions.md)
- Why CASL: [ADR 0003](../../../docs/adr/0003-casl-canonical-authorization-engine.md)

## Files

| File                                         | Does                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ability.factory.ts`                         | Composes every registered policy into one caller's ability                             |
| `policy.registry.ts`                         | Where domain policies collect. Nest has no multi-provider, so they register themselves |
| `guards/permissions.guard.ts`                | Enforces `@RequirePermissions()`; attaches `request.ability`                           |
| `authorization.service.ts`                   | `assertCan` for record- and field-level checks                                         |
| `decorator/require-permissions.decorator.ts` | Declares what a route needs                                                            |
| `decorator/get-ability.decorator.ts`         | Hands a controller the ability to pass to a service                                    |
| `constants/authorization.constant.ts`        | `Action` and metadata keys                                                             |
| `types/app-ability.type.ts`                  | `AppAbility`, `Subject`, `AuthorizationContext`                                        |
| `types/authorization-policy.type.ts`         | The interface domain policies implement                                                |

## Public surface

```ts
import { Action } from 'src/modules/authorization/constants/authorization.constant';
import { RequirePermissions } from 'src/modules/authorization/decorator/require-permissions.decorator';
import { GetAbility } from 'src/modules/authorization/decorator/get-ability.decorator';
import { PermissionsGuard } from 'src/modules/authorization/guards/permissions.guard';
import { AuthorizationService } from 'src/modules/authorization/authorization.service';
import { PolicyRegistry } from 'src/modules/authorization/policy.registry';
import type {
  AppAbility,
  AuthorizationContext,
} from 'src/modules/authorization/types/app-ability.type';
import type { AuthorizationPolicy } from 'src/modules/authorization/types/authorization-policy.type';
```

`@Global`, so the guard resolves anywhere without every module importing this
one. Nothing here holds state and nothing here imports a domain module, so
there is no boundary being skipped.

## What it deliberately does not do

**No database access.** Abilities come from token claims and already-authorized
tenant context. Same reasoning as authentication (ADR 0001 §5), same cost: a
role change lands within the access-token TTL, not immediately.

**No domain vocabulary.** `AuthorizationContext.principal.role` is a `string`,
not `USER_ROLES`. That is not laziness — it is what keeps this module free of
a dependency on `user`, and out of the module cycle that would otherwise form
(`user → authorization → auth → user`). Policies narrow it themselves.

**No subject registry.** Subject names are declared by the module that owns the
data. A central list would make every feature a change to this module.

## The sharp edge

CASL's name-only check ignores conditions:

```ts
can('read', 'User', { _id: 'me' });
ability.can('read', 'User'); // true
ability.can('read', subject('User', { _id: 'x' })); // false
```

So a route guard alone is **not sufficient** when a policy uses conditions —
the caller passes it on the strength of a grant that would not admit the
record. Every route reading a single record of a conditioned subject also
needs `AuthorizationService.assertCan`.

`assertCan` refuses when handed no ability, so a route missing the guard fails
closed rather than reading as permitted.

## Tests

```bash
npx jest src/modules/authorization        # guard and service
npx jest src/modules/user/policies        # the reference policy
pnpm run test:e2e -- test/authorization    # 401 / 403 / authorized, no database
```
