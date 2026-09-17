# Swagger / OpenAPI

- Swagger UI is served at `/api-docs` with `persistAuthorization: true` and `docExpansion: 'none'`.
- Every controller must have `@ApiTags('FeatureName')`.
- Every protected endpoint must have `@ApiBearerAuth()`.
- Every DTO field must have `@ApiProperty()` (optionally with `{ description, example, required }` options).
- Group related endpoints under the same tag name.
