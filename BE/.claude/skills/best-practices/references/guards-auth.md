# Guards, Custom Decorators & Passport Strategies

> Full design and rationale: `docs/architecture/security/authentication.md`,
> and the ADR recording the authentication boundaries.
> The rules below are enforced by `nestjs/*` lint rules — a violation fails the
> commit, not review.

## Authentication is on by default

`JwtAccessGuard` is registered globally through `APP_GUARD` in `AuthModule`.
**Every route is authenticated unless it says otherwise.** Do not add
`@UseGuards(...)` for authentication — there is nothing to add.

```typescript
@Controller('reports')
@ApiTags('Reports')
@ApiBearerAuth()
export class ReportsController {
  @Get() // authenticated already
  list(@GetUser('id') userId: string) {}

  @Public() // opt out — visible in review
  @Get('health')
  health() {}
}
```

Use `@Public()` only for: endpoints reached before a credential exists (signup,
login, password reset), endpoints authenticated by something other than a
bearer token (provider webhooks verify a signature header), and health checks.

## Guards orchestrate, strategies authenticate

- **`JwtStrategy`** is the only place an access token is verified. It checks
  signature, expiry, algorithm, issuer, audience, token purpose, and claim
  shape — and reads no database.
- **`JwtAccessGuard`** decides whether a route needs authentication and
  normalizes the 401. It does not parse headers or verify tokens.
- **`RolesGuard`** authorizes from the verified principal's `role` claim.
  Pair it with `@Roles(...)`; it answers **403**, not 401.
- **`OrganizationAccessGuard`** turns the `x-organization-id` header into
  authorized tenant context. It is the only guard permitted a database read.
- **`TokenService`** is the only place an access token is signed.

### Never

| Don't                                               | Why                                               | Rule                                |
| --------------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| Call `JwtService.verify()`                          | A second verification path drifts from the first  | `nestjs/no-direct-jwt-verify`       |
| Call `JwtService.sign()` outside `TokenService`     | Claims and options drift from what is verified    | `nestjs/no-direct-jwt-sign`         |
| Inject a model into a strategy or access/role guard | Every request pays a database round trip          | `nestjs/no-db-in-access-auth`       |
| Reference `JwtAuthGuard`                            | Deleted — it verified by hand and loaded the user | `nestjs/no-legacy-auth-guard`       |
| Read `x-organization-id` yourself                   | It is caller input, not proof of membership       | `nestjs/no-raw-organization-header` |
| Parse the `Authorization` header                    | Passport does it, correctly                       | `nestjs/no-manual-bearer-parsing`   |
| Add a second Passport JWT strategy                  | Two answers to "is this token valid?"             | `nestjs/one-access-strategy`        |

A controller's module does **not** need to register the `User` model. The
authentication path performs no lookup, so there is nothing for it to resolve.

## Custom Decorators

```typescript
// Param decorator — typed against the principal the strategy produces
export const GetUser = createParamDecorator(
  <K extends keyof AuthenticatedPrincipal>(
    data: K | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedPrincipal }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);

// Metadata decorator
export const Roles = (...roles: USER_ROLES[]) => SetMetadata(ROLES_KEY, roles);
```

**Rules:**

- Custom param decorators use `createParamDecorator` and are named in **PascalCase** (`GetUser`, `GetOrganizationId`).
- Metadata decorators use `SetMetadata` and follow the same PascalCase naming (`Roles`, `Public`).
- The metadata key is a module constant (`ROLES_KEY`, `IS_PUBLIC_KEY`), not an inline string.
- `@GetUser()` yields an `AuthenticatedPrincipal` — `{ id, email, role, sessionId? }`.
- `@GetOrganizationId()` yields tenant context only after `OrganizationAccessGuard` has authorized it, and refuses otherwise.

## Passport Strategies

- Strategies live in `src/modules/auth/strategies/` and are provided by `AuthModule`, never globally.
- `validate()` returns the canonical principal attached to `request.user`, and validates claims at runtime — a TypeScript annotation on a decoded token proves nothing.
- There is exactly one access-token strategy. Adding a second is an architecture change, not a refactor: start with an ADR.
