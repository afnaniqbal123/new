# Controllers & Services

## Controllers

```typescript
@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  // No authentication guard: JwtAccessGuard is global, so this route is
  // already protected. See references/guards-auth.md.
  @ApiBearerAuth()
  @Get('get-authenticated-user')
  getAuthenticatedUser(@GetUser('id') userId: string) {
    return this.userService.findOne(userId);
  }
}
```

**Rules:**

- `@Controller` path is **lowercase kebab-case**.
- Always add `@ApiTags('FeatureName')` on the class.
- Add `@ApiBearerAuth()` on every protected endpoint **before** the HTTP method decorator.
- Do **not** add an authentication guard — `JwtAccessGuard` is global. Mark intentionally anonymous routes with `@Public()`.
- Place authorization guards (`RolesGuard`, `OrganizationAccessGuard`) **after** `@ApiBearerAuth()` and the HTTP verb decorator.
- Order of decorators on a method: `@Public()`/`@ApiBearerAuth()` → `@Get/@Post/...` → `@Roles(...)` → `@UseGuards(...)`.
- Controllers are thin — delegate all business logic to services. No database calls in a controller.
- Use custom param decorators (`@GetUser`, `@GetOrganizationId`) instead of raw `@Req()`.

---

## Services

- One service class per responsibility; split large services (e.g. `OtpService`, `RefreshTokenService` inside `auth/`).
- Inject models with `@InjectModel(Entity.name)`.
- Always type the injected model: `Model<UserDocument>`.
- Throw errors via `SerializeHttpError` (see `responses.md`); never throw raw `Error` or generic `HttpException`.
- Mark async methods with `async` and `await` every promise.
