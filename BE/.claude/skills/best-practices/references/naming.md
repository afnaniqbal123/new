# Naming Conventions

## Files & Folders

| Artifact            | Pattern                                           | Example                                    |
| ------------------- | ------------------------------------------------- | ------------------------------------------ |
| Folder              | `kebab-case`, lowercase, plural where appropriate | `modules/`, `api-response/`, `chat/`       |
| NestJS module       | `<feature>.module.ts`                             | `auth.module.ts`                           |
| Controller          | `<feature>.controller.ts`                         | `auth.controller.ts`                       |
| Service             | `<feature>.service.ts`                            | `auth.service.ts`                          |
| Gateway (WebSocket) | `<feature>.gateway.ts`                            | `chat.gateway.ts`                          |
| DTO                 | `<action>.dto.ts`                                 | `signin.dto.ts`, `create-room.dto.ts`      |
| Schema              | `<entity>.schema.ts`                              | `user.schema.ts`, `chat-message.schema.ts` |
| Enum file           | `<entity>-<aspect>.enum.ts` under `enums/`        | `subscription-status.enum.ts`              |
| Guard               | `<name>.guard.ts`                                 | `jwt-access.guard.ts`, `roles.guard.ts`    |
| Strategy            | `<name>.strategy.ts`                              | `jwt.strategy.ts`                          |
| Decorator           | `<name>.decorator.ts`                             | `user.decorator.ts`                        |
| Constant file       | `<topic>.constant.ts` or `<topic>.ts`             | `config.constant.ts`, `notification.ts`    |
| Response messages   | `<topic>.response.ts`                             | `auth.response.ts`                         |
| Type file           | `<topic>.type.ts`                                 | `email.type.ts`, `otp.type.ts`             |
| Util file           | `<topic>.util.ts`                                 | `auth.util.ts`                             |
| Unit test           | `<subject>.spec.ts`                               | `notifications.service.spec.ts`            |
| E2E test            | `<subject>.e2e-spec.ts`                           | `app.e2e-spec.ts`                          |

## Classes

| Kind         | Casing                       | Suffix                 | Example                        |
| ------------ | ---------------------------- | ---------------------- | ------------------------------ |
| Module       | PascalCase                   | `Module`               | `AuthModule`                   |
| Controller   | PascalCase                   | `Controller`           | `AuthController`               |
| Service      | PascalCase                   | `Service`              | `AuthService`                  |
| DTO          | PascalCase                   | `Dto`                  | `SignInDto`, `CreateRoomDto`   |
| Schema class | PascalCase                   | none                   | `User`, `ChatMessage`          |
| Guard        | PascalCase                   | `Guard`                | `JwtAccessGuard`, `RolesGuard` |
| Strategy     | PascalCase                   | `Strategy`             | `JwtStrategy`                  |
| Enum         | SCREAMING_SNAKE_CASE members | `Enum` suffix on class | `SubscriptionStatusEnum`       |
| Interface    | PascalCase                   | none                   | `Serialized`                   |

## Variables, Functions & Parameters

- **Local variables and function parameters**: `camelCase`
- **Injected services in constructor**: `camelCase`, no leading underscore — `private authService: AuthService`
- **Boolean variables**: prefix with `is`, `has`, or `can` — `isVerified`, `hasExpired`
- **Async functions**: always `await` returned promises; never mix callbacks with `async/await`
