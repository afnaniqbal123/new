# Permissions — developer guide

How to do the four things you will actually do. The design is in
[`docs/architecture/security/authorization.md`](../architecture/security/authorization.md);
the reasoning is in [ADR 0003](../adr/0003-casl-canonical-authorization-engine.md).

Worked example throughout: `src/modules/user/`.

## Protect a route

```ts
@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  @Get()
  @RequirePermissions({ action: Action.List, subject: REPORT_SUBJECT })
  list() {}
}
```

Declare what the caller is _doing_, never which role they hold. Multiple
permissions are ANDed.

## Add a subject

One constant, in the module that owns the data:

```ts
// src/modules/report/constants/report-subject.constant.ts
export const REPORT_SUBJECT = 'Report';
```

Not in the authorization module — if every subject lived there, adding a
feature would mean editing it.

## Write a policy

```ts
@Injectable()
export class ReportPolicy implements AuthorizationPolicy, OnModuleInit {
  constructor(private readonly registry: PolicyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  define(builder: AbilityBuilder<AppAbility>, context: AuthorizationContext) {
    const { can, cannot } = builder;
    const principal = context.principal;
    if (!principal) return; // anonymous gets nothing

    can(Action.Read, REPORT_SUBJECT, { authorId: principal.id });

    if ((principal.role as USER_ROLES) === USER_ROLES.ADMIN) {
      can(Action.Manage, REPORT_SUBJECT);
    }

    cannot(Action.Delete, REPORT_SUBJECT, { locked: true });
  }
}
```

Register it as a provider in the module. It registers itself with the
`PolicyRegistry` on init.

Three rules:

- **Pure.** No database, no HTTP, no `await`. It runs on every guarded request.
- **`cannot` last.** CASL applies it after every `can`, wherever declared — use
  it to carve exceptions out of a broad grant.
- **Narrow `role` here.** The mechanism keeps it an opaque `string` so it need
  not depend on your module's vocabulary. Narrowing it is the policy's job.

## Scope a route to one organization

```ts
@UseGuards(OrganizationAccessGuard, PermissionsGuard) // order is load-bearing
export class ReportsController {
  @Get()
  @TenantScoped()
  @RequirePermissions({ action: Action.List, subject: REPORT_SUBJECT })
  list(@GetOrganizationId() organizationId: string) {}
}
```

Both guards go at controller level because Nest runs controller guards before
route guards — declared per route, the tenant guard would run _after_
`PermissionsGuard` and `context.organizationId` would be `undefined`. The
tenant guard stands aside on routes without `@TenantScoped()`, so the others
cost nothing.

A tenant condition only decides something when it is checked against a
**record**. `can(Action.List, X, { organization: ctx.organizationId })` does
nothing at the route guard, which asks by name only.

## Limit which fields a rule covers

"May you update this record" and "may you update _this field_ of it" are
different questions. Conflating them is how a self-service profile edit becomes
a role change — the record check passes, because it really is their record.

```ts
can(Action.Update, USER_SUBJECT, ['name', 'phone'], { _id: principal.id });
can(Action.Manage, USER_SUBJECT); // elevated: all fields
```

Pass the fields being written to `assertCan`, and it refuses if any of them is
outside the grant:

```ts
this.authorizationService.assertCan(
  ability,
  Action.Update,
  USER_SUBJECT,
  record,
  Object.keys(dto).filter((k) => dto[k] !== undefined),
);
```

A grant with no field list permits every field, so this costs nothing until a
policy narrows one. `src/modules/user/policies/user.policy.ts` is the worked
example.

## Protect a record

**Read this if your policy uses conditions.** The route guard cannot evaluate
them — nothing is loaded when it runs — so a caller holding a conditional
grant passes it. Assert against the record once you have it:

```ts
// controller — hand the ability down
@Get(':id')
@RequirePermissions({ action: Action.Read, subject: REPORT_SUBJECT })
findOne(@Param('id') id: string, @GetAbility() ability: AppAbility) {
  return this.reportService.findOneAuthorized(id, ability);
}

// service — takes an ability, never a request
async findOneAuthorized(id: string, ability: AppAbility | undefined) {
  const report = await this.reportModel.findById(id);
  if (!report) return SerializeHttpResponse(null, HttpStatus.NOT_FOUND, ...);

  this.authorizationService.assertCan(
    ability, Action.Read, REPORT_SUBJECT,
    report.toObject() as unknown as Record<string, unknown>,
  );

  return SerializeHttpResponse(report, HttpStatus.OK, ...);
}
```

Services take an `AppAbility`, not a request — that is what keeps them usable
from a queue, a socket, or a test.

Do not add an _optional_ ability to an existing method: forgetting to pass it
would then read as permission granted. Add a separate `…Authorized` method, as
`UserService` does.

## Test it

```ts
function abilityFor(context: AuthorizationContext): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  new ReportPolicy(new PolicyRegistry()).define(builder, context);
  return builder.build();
}
```

Cover: anonymous gets nothing, each role's grants, ownership allows own and
denies others, elevated role, unknown role. If your policy uses conditions,
also pin the coarse-check behaviour — see _the coarse-check trap_ in
`user.policy.spec.ts` — so a later change cannot silently make the guard
sufficient alone.

## Migrate a route off `@Roles`

1. Name the action and subject; move the role logic into that module's policy.
2. Swap `@Roles(...)` → `@RequirePermissions(...)`, `RolesGuard` →
   `PermissionsGuard`.
3. If the rule depends on the record, add `assertCan` after the service loads it.
4. Check you did not widen access. `@Roles(OWNER, ADMIN)` on a detail route is
   narrower than a blanket `Read` grant that other roles also hold.

Step 4 is the one that bites. When `user` was migrated, `MEMBER` held
`@Roles(OWNER, ADMIN, MEMBER)` on the directory but not on the detail route —
which is why `List` exists as an action separate from `Read`.

## Quick reference

| Situation                          | Do                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Route needs a permission           | `@RequirePermissions` + `PermissionsGuard`                                 |
| Rule depends on the record         | `assertCan` in the service                                                 |
| Rule depends on the tenant         | `OrganizationAccessGuard`, then `context.organizationId`                   |
| Caller may act on their own record | Condition on the subject, plus `assertCan`                                 |
| Branch rather than refuse          | Catch the refusal, or add a policy rule — there is no non-throwing variant |
| Need a role check in a service     | You do not — take an `AppAbility`                                          |
