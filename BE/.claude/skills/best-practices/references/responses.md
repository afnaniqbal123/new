# HTTP Response Serialization

All HTTP responses use a consistent envelope shape defined in `src/utils/serializer.ts`:

```typescript
{ data: T, status: number, message: string }
```

**Usage:**

```typescript
// Success
return SerializeHttpResponse(user, HttpStatus.OK, AUTH_SUCCESS.ACCOUNT_LOGIN);

// Error (throws HttpException)
return SerializeHttpError(
  null,
  HttpStatus.NOT_FOUND,
  AUTH_ERRORS.USER_NOT_FOUND,
);
```

**Rules:**

- Never return a raw object or throw a raw `HttpException` — always use `SerializeHttpResponse` or `SerializeHttpError`.
- The `message` argument must always be a value from an enum in `src/constants/api-response/` or a module-local `constants/` file.
- **Always `return SerializeHttpError(...)`.** It throws, so the `return` is
  redundant to the compiler — and required for the reader. A bare call reads
  like a branch that falls through, and telling the difference means knowing
  the serializer's internals. Returning it makes the exit visible at the point
  it happens. Enforced by `nestjs/return-serialize-http-error` (auto-fixable).
