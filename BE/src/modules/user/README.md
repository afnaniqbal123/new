# User Module - API Usage

## Endpoints

### Create User

```http
POST /users
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `name`: string (required)
- `email`: string (required)
- `phone`: string (required)
- `role`: enum (required) - OWNER | ADMIN | MANAGER | CASHIER | ACCOUNTANT | VIEWER
- `organization`: string (optional)
- `avatar`: file (optional)

**Response:**

```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "CASHIER"
}
```

### Get All Users

```http
GET /users
Authorization: Bearer <token>
```

**Response:**

```json
{
  "users": [
    {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

### Get All Users (Organization)

```http
GET /users/all
Authorization: Bearer <token>
```

**Response:**

```json
{
  "users": [
    {
      "id": "user-id",
      "name": "John Doe",
      "email": "john@example.com",
      "organization": "org-id"
    }
  ]
}
```

### Get User By ID

```http
GET /users/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "role": "CASHIER"
}
```

### Change Email

```http
PATCH /users/change-email
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "newemail@example.com",
  "password": "currentpassword"
}
```

### Update Own Profile

```http
PATCH /users/me
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `name`: string (optional)
- `phone`: string (optional)
- `languagePreference`: string (optional)
- `avatar`: file (optional)

Any other field sent is ignored — the handler forwards only the four above.
`role` would be self-elevation; `email` and `password` have their own
password-verified flows (`PATCH /users/change-email` and
`POST /auth/change-password`).

### Update User

```http
PATCH /users/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**

- `name`: string (optional)
- `email`: string (optional) — elevated roles only
- `phone`: string (optional)
- `role`: enum (optional) — elevated roles only
- `password`: string (optional, min 6 chars) — elevated roles only
- `avatar`: file (optional)

**Authorization.** Requires `Update` on `User`. A caller editing **their own**
record may change only `name`, `phone`, `languagePreference` and `avatar`;
attempting `role`, `email` or `password` returns **403**.

`role` is excluded to prevent self-elevation. `email` and `password` each have
their own password-verified flow — `PATCH /users/change-email` and
`POST /auth/change-password` — and the second also revokes every session, which
writing the field here would skip.

See [`docs/architecture/security/authorization.md`](../../../docs/architecture/security/authorization.md).

**Response:**

```json
{
  "id": "user-id",
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

### Delete User

```http
DELETE /users/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "User deleted successfully"
}
```
