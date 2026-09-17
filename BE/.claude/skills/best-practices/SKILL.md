---
name: best-practices
description: Conventions, patterns, and standards for this NestJS backend — Nest modules, controllers, services, providers, DTOs, guards, and Mongoose schemas. Use when writing, reviewing, refactoring, or scaffolding any NestJS backend code.
---

# NestJS Best Practices

Conventions, patterns, and standards used throughout this codebase. Follow these
when adding new features or extending existing ones.

## Golden Rules (apply to almost every file)

- **Thin controllers.** Controllers delegate all business logic to services — no
  database calls in a controller. Use custom param decorators (`@GetUser`)
  instead of raw `@Req()`.
- **Serialize every response.** Never return a raw object or throw a raw
  `HttpException` — always use `SerializeHttpResponse` (success) or
  `SerializeHttpError` (error). Envelope is `{ data, status, message }`.
- **No hard-coded user-facing strings.** All messages come from enums in
  `src/constants/api-response/` or a module-local `constants/` file.
- **Validate in DTOs, not controllers.** Every DTO field uses `class-validator`
  decorators and `@ApiProperty()`; no manual `if` checks in controllers. DTO
  class names end with `Dto`.
- **Env via `ConfigService`.** Read env values with
  `ConfigService.get<string>(CONFIG.KEY)` — never `process.env` directly in
  services (except `main.ts` for the port). All keys live in `enum CONFIG`.
- **Absolute imports across modules.** Use `src/...` paths for anything outside
  the current module folder; `./` / `../` only within a module. No barrel
  (`index.ts`) files.
- **Swagger on everything.** Every controller has `@ApiTags`, every protected
  endpoint `@ApiBearerAuth()`, every DTO field `@ApiProperty()`.
- **Explicit types.** Always type function parameters, return types, and injected
  dependencies (`Model<UserDocument>`). Rely on inference only for obvious
  local variables.
- **Formatting.** Single quotes (`singleQuote: true`) and trailing commas
  (`trailingComma: 'all'`); auto-fixed by Prettier/ESLint on commit.

## When to read which reference

- For project structure, module architecture, import paths, and shared types,
  see [references/architecture.md](references/architecture.md).
- For file, folder, class, and variable naming, see
  [references/naming.md](references/naming.md).
- For controller/service layout and decorator ordering, see
  [references/controllers-services.md](references/controllers-services.md).
- For DTO validation and Mongoose schema conventions, see
  [references/dtos-schemas.md](references/dtos-schemas.md).
- For enums, API-response message enums, and config/env, see
  [references/enums-constants-config.md](references/enums-constants-config.md).
- For guards, custom decorators, and Passport strategies, see
  [references/guards-auth.md](references/guards-auth.md).
- For the HTTP response serialization envelope, see
  [references/responses.md](references/responses.md).
- For Swagger / OpenAPI setup, see [references/swagger.md](references/swagger.md).
- For unit/E2E testing and ESLint/Prettier/Husky tooling, see
  [references/testing-tooling.md](references/testing-tooling.md).
