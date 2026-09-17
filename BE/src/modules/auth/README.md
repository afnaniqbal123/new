# Auth Module - API Usage

Design and rationale: [`docs/architecture/security/authentication.md`](../../../docs/architecture/security/authentication.md)
and [`ADR 0001`](../../../docs/adr/0001-authentication-boundaries.md).
Building a client against these endpoints? See
[`docs/frontend-auth-integration.md`](../../../docs/frontend-auth-integration.md).

**Every route in the application is authenticated by default** — `JwtAccessGuard`
is registered globally. The endpoints below marked _(public)_ carry `@Public()`
because they are reached before a credential exists.

Access tokens are valid for **15 minutes**. Long-lived continuity comes from the
rotating refresh session, not from the access token.

## Endpoints

### Get Authenticated User

```http
GET /auth/get-authenticated-user
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "john@example.com"
}
```

### Signup _(public)_

```http
POST /auth/signup
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "password123"
}
```

**Response:** an OTP is emailed; no credentials are issued until it is verified.

```json
{ "data": true, "status": 201, "message": "..." }
```

### Login _(public)_

```http
POST /auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "accessToken": "jwt-token",
  "refreshToken": "opaque-refresh-token",
  "expiresIn": "15m",
  "refreshExpiresIn": "60d",
  "user": { ... }
}
```

### Forgot Password _(public)_

```http
POST /auth/forgot-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

### Verify Forgot Password OTP _(public)_

Returns a single-use `resetToken` bound to the account that owns the mailbox.

```http
POST /auth/verify-forgot-password-otp
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Verify Reset Password _(public)_

```http
POST /auth/verify-reset-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "single-use-reset-token",
  "password": "newpassword123"
}
```

There is deliberately **no `email` field**. The account is read from the
consumed token's own record, so a reset credential issued for one user cannot
be aimed at another. The token works exactly once, and a successful reset
revokes every session for that user.

### Verify Signup OTP _(public)_

Verifying activates the account and logs the user in — but only while the
account is still pending. An account an admin has suspended cannot be
reactivated this way. Returns the same
`{ accessToken, refreshToken, ... }` shape as login.

```http
POST /auth/verify-signup-otp
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Change Password

```http
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Apple Auth Callback _(public)_

```http
POST /auth/apple/callback
Content-Type: application/json
```

**Request Body:**

```json
{
  "idToken": "apple-id-token",
  "user": { ... }
}
```

### Refresh Token _(public — the refresh token in the body is the credential)_

Rotates the session: the presented refresh token is retired and a new one
issued. **Store the new `refreshToken` from every response** — presenting a
rotated token again is treated as theft and revokes every session for the user.

```http
POST /auth/refresh-token
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**

```json
{
  "accessToken": "new-jwt-token",
  "refreshToken": "new-refresh-token"
}
```

### Logout

Ends the session the caller is currently using. No body: the session id travels
in the access token, so logout cannot be aimed at somebody else's session.

```http
POST /auth/logout
Authorization: Bearer <token>
```

### Logout All Devices

```http
POST /auth/logout-all-devices
Authorization: Bearer <token>
```

### Get Active Sessions

```http
GET /auth/active-sessions
Authorization: Bearer <token>
```

**Response:**

```json
{
  "sessions": [
    {
      "deviceId": "device-id",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```
