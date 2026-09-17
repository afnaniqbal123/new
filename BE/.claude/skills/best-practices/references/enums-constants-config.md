# Enums, Constants & Configuration

## Enums

```typescript
// src/modules/user/constants/user.constant.ts
export enum USER_ROLES {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}
```

- App-wide enums live in `src/constants/<topic>.constant.ts`.
- Module-scoped enums live in `<module>/enums/<entity>-<aspect>.enum.ts`.
- Enum names are `SCREAMING_SNAKE_CASE`; enum member values mirror the key name.

## API Response Messages

```typescript
// src/modules/auth/constants/api-response/auth.response.ts
export enum AUTH_SUCCESS {
  ACCOUNT_LOGIN = 'Your account has been logged in successfully.',
}

export enum AUTH_ERRORS {
  UNAUTHORIZED = 'You are not authorized to access this operation.',
  DUPLICATE_EMAIL = 'User with same email already exist.',
}
```

- All user-facing strings are stored in enums, never hard-coded inline.
- Success messages go in `AUTH_SUCCESS`, `NOTIFICATION_SUCCESS`, etc.
- Error messages go in `AUTH_ERRORS`, `NOTIFICATION_ERRORS`, etc.
- Module-local messages live in `<module>/constants/errors.ts` and `<module>/constants/success.ts`.

## Config Keys

```typescript
// src/constants/config.constant.ts
export enum CONFIG {
  MONGODB_URI = 'MONGODB_URI',
  JWT_SECRET = 'JWT_SECRET',
  // ...
}
```

- Access environment variables exclusively via `ConfigService.get<string>(CONFIG.KEY)` — never via `process.env.KEY` directly (except in `main.ts` for the port).

---

## Environment & Configuration

- All required environment keys are documented in `.env.example`.
- `ConfigModule.forRoot({ isGlobal: true, cache: true })` is registered once in `AppModule`.
- All config keys are defined as `enum CONFIG` in `src/constants/config.constant.ts`.
- Inject `ConfigService` anywhere you need an env value; never use `process.env` directly in services.
