# BSTC1 API — Frontend Integration Guide

Complete endpoint reference for the `my-api` backend (NestJS). Every route, grouped by module, with auth requirements, headers, request/response payloads, and known error cases — extracted from the live OpenAPI spec (`/api-docs-json`) and cross-checked against the controller/service source so nothing here is guessed. A companion interactive app (`docs/fe-demo-app.html`) exercises the same endpoints through real screens (login, chat, billing, etc.) plus a full API Explorer.

## How auth works

Most routes are protected by the global `JwtAccessGuard` and expect a bearer token:

```
Authorization: Bearer <accessToken>
```

Get a token from **Auth → Login** (or **Auth → Signup** + **Verify signup OTP**, which logs you in as part of verification). Some `Users` routes additionally require a role (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) via `RolesGuard` — noted per-endpoint below.

> **Updated for the M1 auth rewrite.** Access tokens now expire in 15 minutes and login returns `{ accessToken, refreshToken, expiresIn, refreshExpiresIn, user }` rather than `{ token, user }`; refresh via `POST /auth/refresh-token`, storing the new refresh token each time. `POST /auth/verify-reset-password` no longer accepts `email`. Endpoint entries below that predate this have not all been regenerated — the wire contract is authoritative in [`docs/architecture/security/authentication.md`](architecture/security/authentication.md). The PayPal controllers previously flagged here as unauthenticated are now protected by default.

## Response envelope

Nearly every endpoint returns the same envelope (see `src/utils/serializer.ts`):

```json
{
  "data": {},
  "status": 200,
  "message": "Human-readable message"
}
```

Exceptions are called out explicitly per-endpoint below (e.g. `GET /`, the SSE streams, `platform-assistant` message/stream, webhook receivers, and the two 204-No-Content media-delete routes).

## Table of contents

- [App](#app) — 1 endpoint
- [Auth](#auth) — 15 endpoints
- [Users](#users) — 8 endpoints
- [Chat](#chat) — 10 endpoints
- [Media Bucket](#media-bucket) — 6 endpoints
- [Notifications](#notifications) — 5 endpoints
- [Platform Assistant](#platform-assistant) — 3 endpoints
- [Stripe Cards](#stripe-cards) — 5 endpoints
- [Stripe Invoices](#stripe-invoices) — 3 endpoints
- [Stripe Payments](#stripe-payments) — 4 endpoints
- [Stripe Subscriptions](#stripe-subscriptions) — 12 endpoints
- [Stripe Webhooks](#stripe-webhooks) — 1 endpoint
- [PayPal Invoices](#paypal-invoices) — 3 endpoints
- [PayPal Payments](#paypal-payments) — 4 endpoints
- [PayPal Subscriptions](#paypal-subscriptions) — 9 endpoints
- [PayPal Webhooks](#paypal-webhooks) — 1 endpoint

**Total: 16 modules, 90 endpoints.**

---

## App

[↑ Back to top](#table-of-contents)

| Endpoint                          | Method & Path | Auth |
| --------------------------------- | ------------- | ---- |
| [Health check](#app-health-check) | `GET /`       | —    |

### Health check

`GET /`

Basic liveness check. Returns a plain greeting string (not the {data,status,message} envelope used elsewhere).

**Auth required:** No

**Success response** (`200`):

```
Hello World!
```

> **Note:** Response is a raw string, not JSON — most clients will need to read it as text.

---

## Auth

[↑ Back to top](#table-of-contents)

| Endpoint                                                       | Method & Path                           | Auth |
| -------------------------------------------------------------- | --------------------------------------- | ---- |
| [Sign up](#auth-sign-up)                                       | `POST /auth/signup`                     | —    |
| [Login](#auth-login)                                           | `POST /auth/login`                      | —    |
| [Forgot password (OTP)](#auth-forgot-password-otp)             | `POST /auth/forgot-password`            | —    |
| [Forgot password (link)](#auth-forgot-password-link)           | `POST /auth/forgot-password-link`       | —    |
| [Get authenticated user](#auth-get-authenticated-user)         | `GET /auth/get-authenticated-user`      | 🔒   |
| [Logout](#auth-logout)                                         | `POST /auth/logout`                     | 🔒   |
| [Refresh access token](#auth-refresh-access-token)             | `POST /auth/refresh-token`              | —    |
| [Resend signup OTP](#auth-resend-signup-otp)                   | `POST /auth/resend-signup-otp`          | —    |
| [Verify signup OTP](#auth-verify-signup-otp)                   | `POST /auth/verify-signup-otp`          | —    |
| [Verify forgot-password OTP](#auth-verify-forgot-password-otp) | `POST /auth/verify-forgot-password-otp` | —    |
| [Reset password](#auth-reset-password)                         | `POST /auth/verify-reset-password`      | —    |
| [Change password](#auth-change-password)                       | `POST /auth/change-password`            | 🔒   |
| [Apple sign-in callback](#auth-apple-sign-in-callback)         | `POST /auth/apple/callback`             | —    |
| [Logout all devices](#auth-logout-all-devices)                 | `POST /auth/logout-all-devices`         | 🔒   |
| [Active sessions](#auth-active-sessions)                       | `GET /auth/active-sessions`             | 🔒   |

### Sign up

`POST /auth/signup`

Creates a new account (role forced to MEMBER) and emails a signup OTP. Account starts in PENDING status until the OTP is verified.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+15551234567",
  "password": "Str0ngPassword!"
}
```

**Success response** (`201`):

```json
{
  "data": true,
  "status": 201,
  "message": "Your account has been successfully created. Please check your email address for the otp."
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "User with same email already exist."
}
```

---

### Login

`POST /auth/login`

Authenticates with email + password. Blocked for UNAPPROVED/INACTIVE accounts. Response shape depends on the USE_REFRESH_TOKEN flag in src/constants/config.constant.ts (currently false).

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com",
  "password": "Str0ngPassword!"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "status": 200,
  "message": "Your account has been logged in successfully."
}
```

**Error responses:**

`401`:

```json
{
  "data": null,
  "status": 401,
  "message": "Incorrect email or password."
}
```

> **Note:** If USE_REFRESH_TOKEN is set to true, the success payload becomes { accessToken, refreshToken, expiresIn, refreshExpiresIn, user } instead of { token, user }.

---

### Forgot password (OTP)

`POST /auth/forgot-password`

Emails a password-reset OTP to the given address.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com"
}
```

**Success response** (`200`):

```json
{
  "data": true,
  "status": 200,
  "message": "OTP has been sent to your email."
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Unable to find the user."
}
```

---

### Forgot password (link)

`POST /auth/forgot-password-link`

Emails a password-reset link (JWT token embedded in the URL) instead of an OTP.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com"
}
```

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "The password reset link has been sent successfully."
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Unable to find the user."
}
```

---

### Get authenticated user

`GET /auth/get-authenticated-user`

Returns the profile of the currently authenticated user (resolved from the JWT).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 200,
  "message": "User retrieved successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "User not found"
}
```

---

### Logout

`POST /auth/logout`

Revokes a single refresh token (logs out the current device).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "Refresh token revoked successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Refresh token not found"
}
```

---

### Refresh access token

`POST /auth/refresh-token`

Exchanges a valid refresh token for a new access token.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "refreshToken": "a1b2c3d4e5f6..."
}
```

**Success response** (`200`):

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "15m",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "status": 200,
  "message": "Access token refreshed successfully"
}
```

**Error responses:**

`401`:

```json
{
  "data": null,
  "status": 401,
  "message": "Your token is not validate."
}
```

---

### Resend signup OTP

`POST /auth/resend-signup-otp`

Resends the signup verification OTP. Fails if the account is already verified.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com"
}
```

**Success response** (`200`):

```json
{
  "data": true,
  "status": 200,
  "message": "OTP has been resent to your email."
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Your account is already verified."
}
```

---

### Verify signup OTP

`POST /auth/verify-signup-otp`

Verifies the signup OTP, activates the account (status -> ACTIVE, emailVerified -> true), and logs the user in immediately.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com",
  "otp": "482913"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "status": 200,
  "message": "Your account has been logged in successfully."
}
```

**Error responses:**

`403`:

```json
{
  "data": null,
  "status": 403,
  "message": "This OTP has expired."
}
```

`403`:

```json
{
  "data": null,
  "status": 403,
  "message": "Invalid OTP. 2 attempt(s) remaining."
}
```

---

### Verify forgot-password OTP

`POST /auth/verify-forgot-password-otp`

Verifies a forgot-password OTP and returns a short-lived reset token to use with verify-reset-password.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com",
  "otp": "482913"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "resetToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "status": 200,
  "message": "OTP has been verified successfully."
}
```

**Error responses:**

`403`:

```json
{
  "data": null,
  "status": 403,
  "message": "This OTP has expired."
}
```

---

### Reset password

`POST /auth/verify-reset-password`

Sets a new password using the resetToken obtained from verify-forgot-password-otp (or the link from forgot-password-link).

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "email": "jane@example.com",
  "password": "NewStr0ngPassword!",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "The password has been successfully reset."
}
```

**Error responses:**

`403`:

```json
{
  "data": null,
  "status": 403,
  "message": "Your token is not validate."
}
```

---

### Change password

`POST /auth/change-password`

Changes the authenticated user's password after verifying their current password.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "currentPassword": "currentPassword123",
  "newPassword": "newPassword123"
}
```

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "Your password has been successfully changed."
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Incorrect current password."
}
```

---

### Apple sign-in callback

`POST /auth/apple/callback`

Verifies an Apple identity token and signs the user in (creating the account on first login).

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Success response** (`200`):

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "status": 200,
  "message": "Your account has been successfully created with Apple."
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Invalid Apple token."
}
```

> **Note:** idToken must be a real Apple-issued identity token — cannot be mocked meaningfully.

---

### Logout all devices

`POST /auth/logout-all-devices`

Revokes every refresh token issued to the authenticated user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "All refresh tokens revoked successfully"
}
```

---

### Active sessions

`GET /auth/active-sessions`

Lists the authenticated user's active (non-revoked, non-expired) refresh tokens/devices.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "deviceInfo": "iPhone 15 / Safari",
      "ipAddress": "203.0.113.4",
      "createdAt": "2026-08-01T10:00:00.000Z",
      "expiresAt": "2026-09-30T10:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Active sessions retrieved successfully"
}
```

---

## Users

[↑ Back to top](#table-of-contents)

| Endpoint                                                              | Method & Path               | Auth |
| --------------------------------------------------------------------- | --------------------------- | ---- |
| [Create user (admin)](#users-create-user-admin)                       | `POST /users`               | 🔒   |
| [List users (search)](#users-list-users-search)                       | `GET /users`                | 🔒   |
| [List users in my organization](#users-list-users-in-my-organization) | `GET /users/all`            | 🔒   |
| [Get user by ID](#users-get-user-by-id)                               | `GET /users/{id}`           | 🔒   |
| [Change my email](#users-change-my-email)                             | `PATCH /users/change-email` | 🔒   |
| [Update my profile](#users-update-my-profile)                         | `PATCH /users/me`           | 🔒   |
| [Update user (admin)](#users-update-user-admin)                       | `PATCH /users/{id}`         | 🔒   |
| [Delete user (admin)](#users-delete-user-admin)                       | `DELETE /users/{id}`        | 🔒   |

### Create user (admin)

`POST /users`

Admin-only user creation. multipart/form-data — send fields alongside an optional 'avatar' file part. A random password is generated and emailed to the new user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `multipart/form-data`  |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+15551234567",
  "role": "MEMBER",
  "organization": "665f1a2b3c4d5e6f7a8b9c0d"
}
```

**Success response** (`201`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 201,
  "message": "User created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "User with this email already exists"
}
```

> **Note:** multipart/form-data endpoint (FileInterceptor('avatar')) — the JSON body above only covers the non-file fields; 'Try it' sends it as JSON, which will not include a file part.

---

### List users (search)

`GET /users`

Lists users, optionally filtered by a case-insensitive name/email search term.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Query params:**

| Name     | Required | Description                                  |
| -------- | -------- | -------------------------------------------- |
| `search` | No       | Case-insensitive match against name or email |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Users retrieved successfully"
}
```

---

### List users in my organization

`GET /users/all`

Lists all users belonging to the caller's organization. Requires OWNER, ADMIN, or MEMBER role.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0d",
      "name": "jane doe",
      "email": "jane@example.com",
      "phone": "+15551234567",
      "role": "MEMBER",
      "emailVerified": true,
      "status": "ACTIVE",
      "avatar": "",
      "languagePreference": "en",
      "provider": "CUSTOM",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Users retrieved successfully"
}
```

---

### Get user by ID

`GET /users/{id}`

Fetches a single user by ID. Requires OWNER or ADMIN role.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description                  |
| ---- | ---------------------------- |
| `id` | MongoDB ObjectId of the user |

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 200,
  "message": "User retrieved successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "User not found"
}
```

---

### Change my email

`PATCH /users/change-email`

Changes the authenticated user's email after verifying their password. Sets emailVerified back to false.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "email": "jane.new@example.com",
  "password": "Str0ngPassword!"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 200,
  "message": "Email updated successfully"
}
```

**Error responses:**

`401`:

```json
{
  "data": null,
  "status": 401,
  "message": "Invalid password"
}
```

---

### Update my profile

`PATCH /users/me`

Self-service profile update — any authenticated user may edit their own name/phone/password/languagePreference and avatar. multipart/form-data.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `multipart/form-data`  |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "name": "Jane Doe",
  "phone": "+15551234567",
  "languagePreference": "en"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 200,
  "message": "User updated successfully"
}
```

> **Note:** multipart/form-data endpoint (FileInterceptor('avatar')) — role and email cannot be changed here by design (privilege-escalation guard; email has its own change-email flow).

---

### Update user (admin)

`PATCH /users/{id}`

Admin update of any user's profile, including role. Requires OWNER or ADMIN role. multipart/form-data.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `multipart/form-data`  |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description                  |
| ---- | ---------------------------- |
| `id` | MongoDB ObjectId of the user |

**Request body:**

```json
{
  "name": "Jane Doe",
  "role": "ADMIN"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f1a2b3c4d5e6f7a8b9c0d",
    "name": "jane doe",
    "email": "jane@example.com",
    "phone": "+15551234567",
    "role": "MEMBER",
    "emailVerified": true,
    "status": "ACTIVE",
    "avatar": "",
    "languagePreference": "en",
    "provider": "CUSTOM",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "status": 200,
  "message": "User updated successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "User not found"
}
```

---

### Delete user (admin)

`DELETE /users/{id}`

Deletes a user. Requires OWNER or ADMIN role.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description                  |
| ---- | ---------------------------- |
| `id` | MongoDB ObjectId of the user |

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "User deleted successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "User not found"
}
```

---

## Chat

[↑ Back to top](#table-of-contents)

| Endpoint                                                             | Method & Path                                           | Auth |
| -------------------------------------------------------------------- | ------------------------------------------------------- | ---- |
| [List my chat rooms](#chat-list-my-chat-rooms)                       | `GET /chat/rooms`                                       | 🔒   |
| [Total unread message count](#chat-total-unread-message-count)       | `GET /chat/unread-count`                                | 🔒   |
| [Get room by ID](#chat-get-room-by-id)                               | `GET /chat/rooms/{roomId}`                              | 🔒   |
| [Delete room](#chat-delete-room)                                     | `DELETE /chat/rooms/{roomId}`                           | 🔒   |
| [Get or create room with user](#chat-get-or-create-room-with-user)   | `GET /chat/rooms/user/{otherUserId}`                    | 🔒   |
| [Get room messages](#chat-get-room-messages)                         | `GET /chat/rooms/{roomId}/messages`                     | 🔒   |
| [Send a message](#chat-send-a-message)                               | `POST /chat/rooms/{roomId}/messages`                    | 🔒   |
| [Mark messages as read](#chat-mark-messages-as-read)                 | `PATCH /chat/rooms/{roomId}/mark-read`                  | 🔒   |
| [Mark all read if last is read](#chat-mark-all-read-if-last-is-read) | `PATCH /chat/rooms/{roomId}/mark-all-read-if-last-read` | 🔒   |
| [Unread count for a room](#chat-unread-count-for-a-room)             | `GET /chat/rooms/{roomId}/unread-count`                 | 🔒   |

### List my chat rooms

`GET /chat/rooms`

Returns all 1-on-1 chat rooms for the current user, sorted by last message time. Supports pagination, unread-only filter, and search by the other participant.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Query params:**

| Name     | Required | Description                               |
| -------- | -------- | ----------------------------------------- |
| `page`   | No       | Page number, default 1                    |
| `limit`  | No       | Page size, default 20                     |
| `filter` | No       | 'all' (default) or 'unread'               |
| `search` | No       | Search the other participant's name/email |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f2b3c4d5e6f7a8b9c0d1e",
      "participants": ["665f1a2b3c4d5e6f7a8b9c0d", "665f1a2b3c4d5e6f7a8b9c0e"],
      "lastMessage": "665f2c3c4d5e6f7a8b9c0d2f",
      "lastMessageAt": "2026-08-10T12:00:00.000Z",
      "isDeleted": false,
      "createdAt": "2026-08-01T09:00:00.000Z",
      "updatedAt": "2026-08-10T12:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Chat rooms retrieved successfully"
}
```

---

### Total unread message count

`GET /chat/unread-count`

Returns the current user's total unread message count across all rooms.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "unreadCount": 3
  },
  "status": 200,
  "message": "Unread count retrieved successfully"
}
```

---

### Get room by ID

`GET /chat/rooms/{roomId}`

Returns details of a specific chat room.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f2b3c4d5e6f7a8b9c0d1e",
    "participants": ["665f1a2b3c4d5e6f7a8b9c0d", "665f1a2b3c4d5e6f7a8b9c0e"],
    "lastMessage": "665f2c3c4d5e6f7a8b9c0d2f",
    "lastMessageAt": "2026-08-10T12:00:00.000Z",
    "isDeleted": false,
    "createdAt": "2026-08-01T09:00:00.000Z",
    "updatedAt": "2026-08-10T12:00:00.000Z"
  },
  "status": 200,
  "message": "Chat room retrieved successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Chat room not found"
}
```

---

### Delete room

`DELETE /chat/rooms/{roomId}`

Soft-deletes a chat room (marks as deleted but preserves data).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "Chat room deleted successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Chat room not found"
}
```

---

### Get or create room with user

`GET /chat/rooms/user/{otherUserId}`

Returns the existing 1-on-1 room with otherUserId, or creates a new one.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name          | Description                     |
| ------------- | ------------------------------- |
| `otherUserId` | The other participant's user ID |

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f2b3c4d5e6f7a8b9c0d1e",
    "participants": ["665f1a2b3c4d5e6f7a8b9c0d", "665f1a2b3c4d5e6f7a8b9c0e"],
    "lastMessage": "665f2c3c4d5e6f7a8b9c0d2f",
    "lastMessageAt": "2026-08-10T12:00:00.000Z",
    "isDeleted": false,
    "createdAt": "2026-08-01T09:00:00.000Z",
    "updatedAt": "2026-08-10T12:00:00.000Z"
  },
  "status": 200,
  "message": "Chat room retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Invalid user ID"
}
```

---

### Get room messages

`GET /chat/rooms/{roomId}/messages`

Returns messages from a room, oldest first, with pagination.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Query params:**

| Name    | Required | Description |
| ------- | -------- | ----------- |
| `page`  | No       | default 1   |
| `limit` | No       | default 20  |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f2c3c4d5e6f7a8b9c0d2f",
      "roomId": "665f2b3c4d5e6f7a8b9c0d1e",
      "senderId": "665f1a2b3c4d5e6f7a8b9c0d",
      "content": "Hello! How are you?",
      "messageType": "text",
      "readBy": ["665f1a2b3c4d5e6f7a8b9c0d"],
      "isDeleted": false,
      "createdAt": "2026-08-10T12:00:00.000Z",
      "updatedAt": "2026-08-10T12:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Messages retrieved successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Chat room not found"
}
```

---

### Send a message

`POST /chat/rooms/{roomId}/messages`

Sends a message to a room (persists to DB). For real-time delivery, use the Socket.IO gateway instead.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Request body:**

```json
{
  "content": "Hello! How are you?"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f2c3c4d5e6f7a8b9c0d2f",
    "roomId": "665f2b3c4d5e6f7a8b9c0d1e",
    "senderId": "665f1a2b3c4d5e6f7a8b9c0d",
    "content": "Hello! How are you?",
    "messageType": "text",
    "readBy": ["665f1a2b3c4d5e6f7a8b9c0d"],
    "isDeleted": false,
    "createdAt": "2026-08-10T12:00:00.000Z",
    "updatedAt": "2026-08-10T12:00:00.000Z"
  },
  "status": 200,
  "message": "Message sent successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Chat room not found"
}
```

---

### Mark messages as read

`PATCH /chat/rooms/{roomId}/mark-read`

Marks messages in a room as read by the current user. Omit messageIds to mark all unread messages in the room.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Request body:**

```json
{
  "messageIds": ["665f2c3c4d5e6f7a8b9c0d2f"]
}
```

**Success response** (`200`):

```json
{
  "data": {
    "markedCount": 1
  },
  "status": 200,
  "message": "Messages marked as read successfully"
}
```

---

### Mark all read if last is read

`PATCH /chat/rooms/{roomId}/mark-all-read-if-last-read`

If the last message in the room is already read by the user, marks all previous unread messages as read too. Useful when opening a chat thread.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Success response** (`200`):

```json
{
  "data": {
    "markedCount": 4
  },
  "status": 200,
  "message": "Messages marked as read successfully"
}
```

---

### Unread count for a room

`GET /chat/rooms/{roomId}/unread-count`

Returns the unread message count for the current user in a specific room.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name     | Description  |
| -------- | ------------ |
| `roomId` | Chat room ID |

**Success response** (`200`):

```json
{
  "data": {
    "unreadCount": 2
  },
  "status": 200,
  "message": "Unread count retrieved successfully"
}
```

---

## Media Bucket

[↑ Back to top](#table-of-contents)

| Endpoint                                                                 | Method & Path                             | Auth |
| ------------------------------------------------------------------------ | ----------------------------------------- | ---- |
| [Presign upload URL](#media-bucket-presign-upload-url)                   | `POST /mediabucket/presign-upload`        | 🔒   |
| [Presign upload URLs (bulk)](#media-bucket-presign-upload-urls-bulk)     | `POST /mediabucket/presign-upload/bulk`   | 🔒   |
| [Presign download URL](#media-bucket-presign-download-url)               | `POST /mediabucket/presign-download`      | 🔒   |
| [Presign download URLs (bulk)](#media-bucket-presign-download-urls-bulk) | `POST /mediabucket/presign-download/bulk` | 🔒   |
| [Delete file](#media-bucket-delete-file)                                 | `DELETE /mediabucket`                     | 🔒   |
| [Delete files (bulk)](#media-bucket-delete-files-bulk)                   | `DELETE /mediabucket/bulk`                | 🔒   |

### Presign upload URL

`POST /mediabucket/presign-upload`

Returns a presigned S3 PUT URL so the client can upload a single file directly to S3.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileName": "avatar.png",
  "folderName": "profile",
  "contentType": "image/png"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "fileName": "avatar.png",
    "key": "profile/avatar.png",
    "url": "https://carnection-bucket.s3.us-east-1.amazonaws.com/profile/avatar.png?X-Amz-...",
    "expiresIn": 3600,
    "method": "PUT"
  },
  "status": 200,
  "message": "Operation completed successfully"
}
```

> **Note:** folderName is one of: profile, workspace, workspace-base, icons, email-assets

---

### Presign upload URLs (bulk)

`POST /mediabucket/presign-upload/bulk`

Returns presigned S3 PUT URLs for multiple files.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileNames": ["avatar1.png", "avatar2.png"],
  "folderName": "profile",
  "contentType": "image/png"
}
```

**Success response** (`200`):

```json
{
  "data": [
    {
      "fileName": "avatar1.png",
      "key": "profile/avatar1.png",
      "url": "https://carnection-bucket.s3.us-east-1.amazonaws.com/profile/avatar1.png?X-Amz-...",
      "expiresIn": 3600,
      "method": "PUT"
    }
  ],
  "status": 200,
  "message": "Operation completed successfully"
}
```

> **Note:** folderName is one of: profile, workspace, workspace-base, icons, email-assets

---

### Presign download URL

`POST /mediabucket/presign-download`

Returns a presigned S3 GET URL so the client can download a file directly from S3.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileName": "avatar.png",
  "folderName": "profile"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "fileName": "avatar.png",
    "key": "profile/avatar.png",
    "url": "https://carnection-bucket.s3.us-east-1.amazonaws.com/profile/avatar.png?X-Amz-...",
    "expiresIn": 3600,
    "method": "GET"
  },
  "status": 200,
  "message": "Operation completed successfully"
}
```

> **Note:** folderName is one of: profile, workspace, workspace-base, icons, email-assets

---

### Presign download URLs (bulk)

`POST /mediabucket/presign-download/bulk`

Returns presigned S3 GET URLs for multiple files. Always looks under the 'profile' folder (hardcoded in the controller).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileNames": ["avatar1.png", "avatar2.png"]
}
```

**Success response** (`200`):

```json
{
  "data": [
    {
      "fileName": "avatar1.png",
      "key": "profile/avatar1.png",
      "url": "https://carnection-bucket.s3.us-east-1.amazonaws.com/profile/avatar1.png?X-Amz-...",
      "expiresIn": 3600,
      "method": "GET"
    }
  ],
  "status": 200,
  "message": "Operation completed successfully"
}
```

> **Note:** folderName in the request is ignored server-side — this route hardcodes FOLDER_NAME.PROFILE.

---

### Delete file

`DELETE /mediabucket`

Deletes a single object from S3 by file name and optional folder.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileName": "avatar.png",
  "folderName": "profile"
}
```

**Success response** (`204`):

```json
null
```

**Error responses:**

`500`:

```json
{
  "data": null,
  "status": 500,
  "message": "An error occurred while deleting the file."
}
```

> **Note:** folderName is one of: profile, workspace, workspace-base, icons, email-assets. Success response is HTTP 204 with no body.

---

### Delete files (bulk)

`DELETE /mediabucket/bulk`

Deletes multiple objects from S3 by file name. Always looks under the 'profile' folder (hardcoded in the controller).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "fileNames": ["avatar1.png", "avatar2.png"]
}
```

**Success response** (`204`):

```json
null
```

> **Note:** folderName is ignored — this route hardcodes FOLDER_NAME.PROFILE. Success response is HTTP 204 with no body.

---

## Notifications

[↑ Back to top](#table-of-contents)

| Endpoint                                                                      | Method & Path                                | Auth |
| ----------------------------------------------------------------------------- | -------------------------------------------- | ---- |
| [Live notification stream (SSE)](#notifications-live-notification-stream-sse) | `GET /notifications/stream/{userId}`         | —    |
| [List my notifications](#notifications-list-my-notifications)                 | `GET /notifications/user`                    | 🔒   |
| [Mark all notifications read](#notifications-mark-all-notifications-read)     | `PATCH /notifications/mark-all-read`         | 🔒   |
| [Mark one notification read](#notifications-mark-one-notification-read)       | `PATCH /notifications/{notificationId}/read` | 🔒   |
| [Unread notifications count](#notifications-unread-notifications-count)       | `GET /notifications/unread-count`            | 🔒   |

### Live notification stream (SSE)

`GET /notifications/stream/{userId}`

Server-Sent Events stream of live notifications for a user. Intentionally marked `@Public()` (native EventSource can't send an Authorization header) — relies on the userId path param instead. Note this means the stream is readable by anyone who can guess a user id.

**Auth required:** No

**Path params:**

| Name     | Description                         |
| -------- | ----------------------------------- |
| `userId` | User ID to stream notifications for |

**Success response** (`200`):

```
event: message\ndata: {\"type\":\"chat_message\",...}\n\n
```

> **Note:** SSE endpoint — 'Try it' will show the raw fetch() response rather than a live stream; use an EventSource client for real usage. No auth guard by design.

---

### List my notifications

`GET /notifications/user`

Paginated list of the authenticated user's notifications.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Query params:**

| Name    | Required | Description         |
| ------- | -------- | ------------------- |
| `page`  | No       | default 1           |
| `limit` | No       | default 10, max 100 |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f3a3c4d5e6f7a8b9c0d3a",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "type": "chat_message",
      "title": "New message",
      "message": "Jane sent you a message",
      "data": {
        "roomId": "665f2b3c4d5e6f7a8b9c0d1e"
      },
      "isDeleted": false,
      "createdAt": "2026-08-10T12:00:00.000Z",
      "updatedAt": "2026-08-10T12:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Data retrieved successfully"
}
```

---

### Mark all notifications read

`PATCH /notifications/mark-all-read`

Marks every notification for the current user as read.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "markedCount": 5
  },
  "status": 200,
  "message": "Data updated successfully"
}
```

---

### Mark one notification read

`PATCH /notifications/{notificationId}/read`

Marks a single notification as read.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name             | Description     |
| ---------------- | --------------- |
| `notificationId` | Notification ID |

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f3a3c4d5e6f7a8b9c0d3a",
    "userId": "665f1a2b3c4d5e6f7a8b9c0d",
    "type": "chat_message",
    "title": "New message",
    "message": "Jane sent you a message",
    "data": {
      "roomId": "665f2b3c4d5e6f7a8b9c0d1e"
    },
    "isDeleted": false,
    "createdAt": "2026-08-10T12:00:00.000Z",
    "updatedAt": "2026-08-10T12:00:00.000Z"
  },
  "status": 200,
  "message": "Data updated successfully"
}
```

---

### Unread notifications count

`GET /notifications/unread-count`

Returns the count of unread notifications for the authenticated user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "unreadCount": 5
  },
  "status": 200,
  "message": "Data retrieved successfully"
}
```

---

## Platform Assistant

[↑ Back to top](#table-of-contents)

| Endpoint                                                                       | Method & Path                             | Auth |
| ------------------------------------------------------------------------------ | ----------------------------------------- | ---- |
| [Ask the assistant](#platform-assistant-ask-the-assistant)                     | `POST /platform-assistant/message`        | —    |
| [Ask the assistant (streamed)](#platform-assistant-ask-the-assistant-streamed) | `GET /platform-assistant/stream`          | —    |
| [Reload assistant context](#platform-assistant-reload-assistant-context)       | `POST /platform-assistant/reload-context` | —    |

### Ask the assistant

`POST /platform-assistant/message`

Non-streaming chat with the platform assistant (LLM-backed). Pass sessionId to continue an existing conversation, or omit it to start a new one. Guest-facing by default (auth only if the host enables requireAuthGuard).

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Request body:**

```json
{
  "message": "How does the free preview work?"
}
```

**Success response** (`200`):

```json
{
  "sessionId": "a1b2c3d4-...",
  "answer": "The free preview lets you try core features for 14 days, no card required."
}
```

> **Note:** Not wrapped in the usual {data,status,message} envelope — returns { sessionId, answer } directly.

---

### Ask the assistant (streamed)

`GET /platform-assistant/stream`

Streamed (SSE) answer, token by token. Same guardrails as /message.

**Auth required:** No

**Query params:**

| Name        | Required | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `sessionId` | No       | Existing session id to continue a conversation |
| `message`   | Yes      | The question to ask                            |

**Success response** (`200`):

```
event: message\ndata: \"The free\"\n\nevent: message\ndata: \" preview lets...\"\n\n
```

> **Note:** SSE endpoint — 'Try it' will show the raw fetch() response rather than a live token stream.

---

### Reload assistant context

`POST /platform-assistant/reload-context`

Reloads the assistant's context files from disk. Admin-gated only if the host enables requireAuthGuard.

**Auth required:** No

**Headers:**

| Name           | Value              |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

**Success response** (`200`):

```json
{
  "reloaded": true
}
```

---

## Stripe Cards

[↑ Back to top](#table-of-contents)

| Endpoint                                                     | Method & Path                      | Auth |
| ------------------------------------------------------------ | ---------------------------------- | ---- |
| [Add a card](#stripe-cards-add-a-card)                       | `POST /stripe/cards`               | 🔒   |
| [List my cards](#stripe-cards-list-my-cards)                 | `GET /stripe/cards`                | 🔒   |
| [List all cards (admin)](#stripe-cards-list-all-cards-admin) | `GET /stripe/cards/all`            | 🔒   |
| [Delete a card](#stripe-cards-delete-a-card)                 | `DELETE /stripe/cards/{id}`        | 🔒   |
| [Set default card](#stripe-cards-set-default-card)           | `PATCH /stripe/cards/{id}/default` | 🔒   |

### Add a card

`POST /stripe/cards`

Attaches a Stripe payment method (created client-side via Stripe Elements) as a saved card for the current user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "paymentMethodId": "pm_1234567890abcdef"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f4a3c4d5e6f7a8b9c0d4a",
    "userId": "665f1a2b3c4d5e6f7a8b9c0d",
    "stripePaymentMethodId": "pm_1234567890abcdef",
    "brand": "visa",
    "last4": "4242",
    "expMonth": 12,
    "expYear": 2030,
    "isDefault": true,
    "createdAt": "2026-08-01T09:00:00.000Z"
  },
  "status": 200,
  "message": "Card added successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "A card with the same fingerprint already exists"
}
```

---

### List my cards

`GET /stripe/cards`

Returns saved cards belonging to the authenticated user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f4a3c4d5e6f7a8b9c0d4a",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "stripePaymentMethodId": "pm_1234567890abcdef",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2030,
      "isDefault": true,
      "createdAt": "2026-08-01T09:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "Cards retrieved successfully"
}
```

---

### List all cards (admin)

`GET /stripe/cards/all`

Returns saved cards for every user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "_id": "665f4a3c4d5e6f7a8b9c0d4a",
      "userId": "665f1a2b3c4d5e6f7a8b9c0d",
      "stripePaymentMethodId": "pm_1234567890abcdef",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2030,
      "isDefault": true,
      "createdAt": "2026-08-01T09:00:00.000Z"
    }
  ],
  "status": 200,
  "message": "All cards retrieved successfully"
}
```

---

### Delete a card

`DELETE /stripe/cards/{id}`

Deletes one of the authenticated user's saved cards.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description      |
| ---- | ---------------- |
| `id` | Internal card ID |

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "Card deleted successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Card not found"
}
```

---

### Set default card

`PATCH /stripe/cards/{id}/default`

Marks one of the authenticated user's saved cards as the default.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description      |
| ---- | ---------------- |
| `id` | Internal card ID |

**Request body:**

```json
{
  "cardId": 1
}
```

**Success response** (`200`):

```json
{
  "data": {
    "_id": "665f4a3c4d5e6f7a8b9c0d4a",
    "userId": "665f1a2b3c4d5e6f7a8b9c0d",
    "stripePaymentMethodId": "pm_1234567890abcdef",
    "brand": "visa",
    "last4": "4242",
    "expMonth": 12,
    "expYear": 2030,
    "isDefault": true,
    "createdAt": "2026-08-01T09:00:00.000Z"
  },
  "status": 200,
  "message": "Card set as default successfully"
}
```

**Error responses:**

`404`:

```json
{
  "data": null,
  "status": 404,
  "message": "Card not found"
}
```

---

## Stripe Invoices

[↑ Back to top](#table-of-contents)

| Endpoint                                                      | Method & Path                    | Auth |
| ------------------------------------------------------------- | -------------------------------- | ---- |
| [Create invoice](#stripe-invoices-create-invoice)             | `POST /stripe/invoices`          | 🔒   |
| [Get invoice by ID](#stripe-invoices-get-invoice-by-id)       | `GET /stripe/invoices/{id}`      | 🔒   |
| [Pay invoice manually](#stripe-invoices-pay-invoice-manually) | `POST /stripe/invoices/pay/{id}` | 🔒   |

### Create invoice

`POST /stripe/invoices`

Creates a Stripe invoice for a customer.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "customerId": "507f1f77bcf86cd799439011",
  "amount": 2000,
  "currency": "usd",
  "description": "Service fee",
  "metadata": {
    "orderId": "12345",
    "source": "website"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "in_1234567890abcdef",
    "object": "invoice",
    "status": "open",
    "amount_due": 2000,
    "currency": "usd",
    "customer": "cus_1234567890"
  },
  "status": 200,
  "message": "Invoice created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Failed to create invoice"
}
```

> **Note:** response_success.data is the raw Stripe.Invoice object returned by the Stripe SDK — fields shown here are a representative subset, not the full object.

---

### Get invoice by ID

`GET /stripe/invoices/{id}`

Retrieves a Stripe invoice by ID.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description       |
| ---- | ----------------- |
| `id` | Stripe invoice ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "in_1234567890abcdef",
    "object": "invoice",
    "status": "open",
    "amount_due": 2000,
    "currency": "usd",
    "customer": "cus_1234567890"
  },
  "status": 200,
  "message": "Invoice retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Invoice not found"
}
```

> **Note:** response_success.data is the raw Stripe.Invoice object — fields shown are a representative subset.

---

### Pay invoice manually

`POST /stripe/invoices/pay/{id}`

Triggers Stripe to attempt payment for a finalized invoice (e.g. via saved card), or marks it paid if handled outside Stripe.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description              |
| ---- | ------------------------ |
| `id` | Stripe invoice ID to pay |

**Request body:**

```json
{
  "payOffline": true,
  "note": "Paid via bank transfer TXN-123"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "in_1234567890abcdef",
    "object": "invoice",
    "status": "paid",
    "amount_due": 2000,
    "currency": "usd",
    "customer": "cus_1234567890"
  },
  "status": 200,
  "message": "Invoice paid successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Invoice is already paid"
}
```

> **Note:** response_success.data is the raw Stripe.Invoice object — fields shown are a representative subset.

---

## Stripe Payments

[↑ Back to top](#table-of-contents)

| Endpoint                                                            | Method & Path                                     | Auth |
| ------------------------------------------------------------------- | ------------------------------------------------- | ---- |
| [Create Payment Intent](#stripe-payments-create-payment-intent)     | `POST /stripe/payments/intent`                    | 🔒   |
| [Get Payment Intent](#stripe-payments-get-payment-intent)           | `GET /stripe/payments/intent/{id}`                | 🔒   |
| [Create Checkout Session](#stripe-payments-create-checkout-session) | `POST /stripe/payments/checkout`                  | 🔒   |
| [Verify Checkout Session](#stripe-payments-verify-checkout-session) | `GET /stripe/payments/verify-session/{sessionId}` | 🔒   |

### Create Payment Intent

`POST /stripe/payments/intent`

Creates a Stripe Payment Intent for a custom UI flow (Stripe Elements). Returns client_secret.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "amount": 2000,
  "currency": "usd",
  "description": "Product purchase",
  "metadata": {
    "orderId": "ORD-123",
    "productId": "PROD-456"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "pi_1234567890abcdef",
    "object": "payment_intent",
    "status": "requires_payment_method",
    "amount": 2000,
    "currency": "usd",
    "client_secret": "pi_1234567890abcdef_secret_..."
  },
  "status": 200,
  "message": "Payment intent created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Guest email is required for unauthenticated payments"
}
```

> **Note:** response_success.data is the raw Stripe.PaymentIntent object — fields shown are a representative subset. guestEmail is only required if the caller is unauthenticated.

---

### Get Payment Intent

`GET /stripe/payments/intent/{id}`

Retrieves a Stripe Payment Intent by ID — used to verify payment after frontend confirmation.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description              |
| ---- | ------------------------ |
| `id` | Stripe Payment Intent ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "pi_1234567890abcdef",
    "object": "payment_intent",
    "status": "requires_payment_method",
    "amount": 2000,
    "currency": "usd",
    "client_secret": "pi_1234567890abcdef_secret_..."
  },
  "status": 200,
  "message": "Payment intent retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Payment intent not found"
}
```

> **Note:** response_success.data is the raw Stripe.PaymentIntent object.

---

### Create Checkout Session

`POST /stripe/payments/checkout`

Creates a Stripe Checkout Session for the redirect flow. Returns a session URL to redirect the user to.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "amount": 2000,
  "currency": "usd",
  "description": "Product purchase",
  "successUrl": "https://yoursite.com/payment/success",
  "cancelUrl": "https://yoursite.com/payment/cancel",
  "metadata": {
    "orderId": "ORD-123",
    "productId": "PROD-456"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "cs_test_a1234567890abcdef",
    "object": "checkout.session",
    "status": "open",
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount_total": 2000,
    "currency": "usd"
  },
  "status": 200,
  "message": "Checkout session created successfully"
}
```

> **Note:** response_success.data is the raw Stripe.Checkout.Session object.

---

### Verify Checkout Session

`GET /stripe/payments/verify-session/{sessionId}`

Called after the user returns from Stripe, for immediate UX feedback. The webhook is the source of truth for reliable processing.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name        | Description                |
| ----------- | -------------------------- |
| `sessionId` | Stripe Checkout Session ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "cs_test_a1234567890abcdef",
    "object": "checkout.session",
    "status": "complete",
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount_total": 2000,
    "currency": "usd",
    "payment_status": "paid"
  },
  "status": 200,
  "message": "Session verified successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Checkout session not found"
}
```

> **Note:** response_success.data is the raw Stripe.Checkout.Session object.

---

## Stripe Subscriptions

[↑ Back to top](#table-of-contents)

| Endpoint                                                                               | Method & Path                                  | Auth |
| -------------------------------------------------------------------------------------- | ---------------------------------------------- | ---- |
| [Prepare PaymentSheet (mobile)](#stripe-subscriptions-prepare-paymentsheet-mobile)     | `POST /stripe/subscriptions/payment-sheet`     | 🔒   |
| [Create subscription (mobile)](#stripe-subscriptions-create-subscription-mobile)       | `POST /stripe/subscriptions/subscribe-mobile`  | 🔒   |
| [Create subscription (Checkout)](#stripe-subscriptions-create-subscription-checkout)   | `POST /stripe/subscriptions/checkout`          | 🔒   |
| [Create subscription (custom UI)](#stripe-subscriptions-create-subscription-custom-ui) | `POST /stripe/subscriptions/intent`            | 🔒   |
| [Get my active subscription](#stripe-subscriptions-get-my-active-subscription)         | `GET /stripe/subscriptions`                    | 🔒   |
| [Subscription history](#stripe-subscriptions-subscription-history)                     | `GET /stripe/subscriptions/history`            | 🔒   |
| [List available plans](#stripe-subscriptions-list-available-plans)                     | `GET /stripe/subscriptions/plans`              | 🔒   |
| [Upgrade subscription](#stripe-subscriptions-upgrade-subscription)                     | `PATCH /stripe/subscriptions/upgrade`          | 🔒   |
| [Downgrade subscription](#stripe-subscriptions-downgrade-subscription)                 | `PATCH /stripe/subscriptions/downgrade`        | 🔒   |
| [Cancel subscription](#stripe-subscriptions-cancel-subscription)                       | `POST /stripe/subscriptions/cancel`            | 🔒   |
| [Resume subscription](#stripe-subscriptions-resume-subscription)                       | `POST /stripe/subscriptions/resume`            | 🔒   |
| [Verify checkout session](#stripe-subscriptions-verify-checkout-session)               | `GET /stripe/subscriptions/verify/{sessionId}` | 🔒   |

### Prepare PaymentSheet (mobile)

`POST /stripe/subscriptions/payment-sheet`

Mobile (stripe-react-native PaymentSheet) flow, step 1. Returns { paymentIntent, ephemeralKey, customer, publishableKey } for initPaymentSheet().

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "paymentIntent": "pi_1234567890abcdef_secret_...",
    "ephemeralKey": "ek_test_...",
    "customer": "cus_1234567890",
    "publishableKey": "pk_test_..."
  },
  "status": 200,
  "message": "Operation completed successfully"
}
```

---

### Create subscription (mobile)

`POST /stripe/subscriptions/subscribe-mobile`

Mobile flow, step 2 — creates the subscription using the PaymentSheet's confirmed payment method.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "priceId": "price_1234567890abcdef",
  "setupIntentId": "seti_1234567890abcdef"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "User already has an active subscription"
}
```

> **Note:** response_success.data is the raw Stripe.Subscription object.

---

### Create subscription (Checkout)

`POST /stripe/subscriptions/checkout`

Creates a subscription via Stripe's hosted Checkout UI (Stripe collects the card).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "priceId": "price_1234567890abcdef",
  "successUrl": "https://yoursite.com/subscription/success",
  "cancelUrl": "https://yoursite.com/subscription/cancel",
  "metadata": {
    "source": "website",
    "campaign": "spring-sale"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "cs_test_a1234567890abcdef",
    "object": "checkout.session",
    "status": "open",
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount_total": 2000,
    "currency": "usd"
  },
  "status": 200,
  "message": "Checkout session created successfully"
}
```

> **Note:** response_success.data is the raw Stripe.Checkout.Session object.

---

### Create subscription (custom UI)

`POST /stripe/subscriptions/intent`

Creates a subscription using a saved card (custom UI flow, not hosted Checkout).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "priceId": "price_1234567890abcdef",
  "paymentMethodId": "pm_1234567890abcdef",
  "metadata": {
    "source": "mobile-app",
    "campaign": "spring-sale"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Payment method is required for subscription"
}
```

> **Note:** response_success.data is the raw Stripe.Subscription object.

---

### Get my active subscription

`GET /stripe/subscriptions`

Returns the authenticated user's current active subscription.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "No active subscription found"
}
```

---

### Subscription history

`GET /stripe/subscriptions/history`

Returns all subscription history (past and present) for the authenticated user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "id": "sub_1234567890abcdef",
      "object": "subscription",
      "status": "active",
      "current_period_end": 1735689600,
      "items": {
        "data": [
          {
            "price": {
              "id": "price_1234567890abcdef"
            }
          }
        ]
      }
    }
  ],
  "status": 200,
  "message": "Subscriptions retrieved successfully"
}
```

---

### List available plans

`GET /stripe/subscriptions/plans`

Returns all available Stripe subscription plans/prices.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "id": "price_1234567890abcdef",
      "nickname": "Pro Monthly",
      "unit_amount": 2900,
      "currency": "usd",
      "interval": "month"
    }
  ],
  "status": 200,
  "message": "Subscription plans retrieved successfully"
}
```

---

### Upgrade subscription

`PATCH /stripe/subscriptions/upgrade`

Upgrades the subscription to newPriceId immediately, with prorated charge.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "newPriceId": "price_1234567890abcdef"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription upgraded successfully"
}
```

---

### Downgrade subscription

`PATCH /stripe/subscriptions/downgrade`

Downgrades the subscription to newPriceId, effective next billing cycle (no immediate charge).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "newPriceId": "price_1234567890abcdef"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription downgraded successfully"
}
```

---

### Cancel subscription

`POST /stripe/subscriptions/cancel`

Cancels the subscription — at period end by default, or immediately if cancelAtPeriodEnd is false.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "cancelAtPeriodEnd": true
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    },
    "cancel_at_period_end": true
  },
  "status": 200,
  "message": "Subscription canceled successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "No active subscription found"
}
```

---

### Resume subscription

`POST /stripe/subscriptions/resume`

Undoes a pending cancellation before the period ends. No request body.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "id": "sub_1234567890abcdef",
    "object": "subscription",
    "status": "active",
    "current_period_end": 1735689600,
    "items": {
      "data": [
        {
          "price": {
            "id": "price_1234567890abcdef"
          }
        }
      ]
    }
  },
  "status": 200,
  "message": "Subscription resumed successfully"
}
```

---

### Verify checkout session

`GET /stripe/subscriptions/verify/{sessionId}`

Called after the user returns from Stripe Checkout for a subscription — immediate UX feedback (webhook handles reliable processing).

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name        | Description                |
| ----------- | -------------------------- |
| `sessionId` | Stripe Checkout Session ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "cs_test_a1234567890abcdef",
    "object": "checkout.session",
    "status": "complete",
    "url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amount_total": 2000,
    "currency": "usd"
  },
  "status": 200,
  "message": "Session verified successfully"
}
```

---

## Stripe Webhooks

[↑ Back to top](#table-of-contents)

| Endpoint                                                            | Method & Path           | Auth |
| ------------------------------------------------------------------- | ----------------------- | ---- |
| [Stripe webhook receiver](#stripe-webhooks-stripe-webhook-receiver) | `POST /stripe/webhooks` | —    |

### Stripe webhook receiver

`POST /stripe/webhooks`

Receives and verifies Stripe webhook events (checkout.session.completed, customer.subscription.*, invoice.payment_succeeded/failed, etc.) via the stripe-signature header.

**Auth required:** No

**Headers:**

| Name               | Value              |
| ------------------ | ------------------ |
| `stripe-signature` | `t=...,v1=...`     |
| `Content-Type`     | `application/json` |

**Request body:**

```json
{
  "id": "evt_1234567890abcdef",
  "object": "event",
  "type": "checkout.session.completed",
  "data": {
    "object": {}
  }
}
```

**Success response** (`200`):

```json
{
  "received": true
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Webhook signature verification failed"
}
```

> **Note:** Not callable meaningfully from this playground — Stripe computes the stripe-signature header from the exact raw request body using your webhook signing secret. Use the Stripe CLI (stripe trigger / stripe listen) to exercise this endpoint for real.

---

## PayPal Invoices

[↑ Back to top](#table-of-contents)

| Endpoint                                                        | Method & Path                    | Auth |
| --------------------------------------------------------------- | -------------------------------- | ---- |
| [Create invoice](#paypal-invoices-create-invoice)               | `POST /paypal/invoices`          | 🔒   |
| [Get invoice by ID](#paypal-invoices-get-invoice-by-id)         | `GET /paypal/invoices/{id}`      | 🔒   |
| [Record manual payment](#paypal-invoices-record-manual-payment) | `POST /paypal/invoices/pay/{id}` | 🔒   |

### Create invoice

`POST /paypal/invoices`

Creates a PayPal invoice. Mirrors the Stripe invoice endpoint where possible.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "customerId": "507f1f77bcf86cd799439011",
  "amount": 2000,
  "currency": "USD",
  "description": "Consulting services",
  "metadata": {
    "orderId": "12345",
    "project": "alpha"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "INV2-5R7J-GM8A-4N9Q-2V4Q",
    "status": "SENT",
    "detail": {
      "currency_code": "USD"
    }
  },
  "status": 200,
  "message": "PayPal invoice created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Failed to create PayPal invoice"
}
```

> **Note:** This route is now authenticated by the global access guard (the previously commented-out guard has been removed). The handler still resolves the user from the request payload rather than the token — see `src/modules/paypal/README.md`. response_success.data is a representative subset of PayPal's invoice object.

---

### Get invoice by ID

`GET /paypal/invoices/{id}`

Retrieves a PayPal invoice by ID.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description       |
| ---- | ----------------- |
| `id` | PayPal invoice ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "INV2-5R7J-GM8A-4N9Q-2V4Q",
    "status": "SENT",
    "detail": {
      "currency_code": "USD"
    }
  },
  "status": 200,
  "message": "PayPal invoice retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Failed to retrieve PayPal invoice"
}
```

> **Note:** Auth guard currently disabled (see notes on Create invoice).

---

### Record manual payment

`POST /paypal/invoices/pay/{id}`

Records a manual payment against a PayPal invoice.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description       |
| ---- | ----------------- |
| `id` | PayPal invoice ID |

**Request body:**

```json
{
  "payOffline": true,
  "note": "Paid via bank transfer TXN-123"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "INV2-5R7J-GM8A-4N9Q-2V4Q",
    "status": "PAID",
    "detail": {
      "currency_code": "USD"
    }
  },
  "status": 200,
  "message": "PayPal invoice payment recorded successfully"
}
```

> **Note:** Auth guard currently disabled (see notes on Create invoice).

---

## PayPal Payments

[↑ Back to top](#table-of-contents)

| Endpoint                                                                        | Method & Path                                   | Auth |
| ------------------------------------------------------------------------------- | ----------------------------------------------- | ---- |
| [Create order (custom UI)](#paypal-payments-create-order-custom-ui)             | `POST /paypal/payments/intent`                  | 🔒   |
| [Get order by ID](#paypal-payments-get-order-by-id)                             | `GET /paypal/payments/intent/{id}`              | 🔒   |
| [Create order (hosted approval)](#paypal-payments-create-order-hosted-approval) | `POST /paypal/payments/checkout`                | 🔒   |
| [Verify order after approval](#paypal-payments-verify-order-after-approval)     | `GET /paypal/payments/verify-session/{orderId}` | 🔒   |

### Create order (custom UI)

`POST /paypal/payments/intent`

Creates a PayPal order for a custom UI flow. Returns order info including approval links if any.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "amount": 2000,
  "currency": "USD",
  "description": "Order #1234",
  "metadata": {
    "orderId": "ORD-123",
    "source": "website"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "5O190127TN364715T",
    "status": "CREATED",
    "links": [
      {
        "href": "https://www.paypal.com/checkoutnow?token=5O190127TN364715T",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal order created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "PayPal payer not found"
}
```

> **Note:** Controller currently hardcodes userId = 1 for testing (see TODO in source) and its auth guard is commented out — auth_required here reflects intended behavior, not current enforcement. response_success.data is a representative subset of PayPal's order object.

---

### Get order by ID

`GET /paypal/payments/intent/{id}`

Retrieves a PayPal order by ID.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name | Description     |
| ---- | --------------- |
| `id` | PayPal Order ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "5O190127TN364715T",
    "status": "CREATED",
    "links": [
      {
        "href": "https://www.paypal.com/checkoutnow?token=5O190127TN364715T",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal order retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Failed to retrieve PayPal order"
}
```

> **Note:** Auth guard currently disabled (see notes on Create order).

---

### Create order (hosted approval)

`POST /paypal/payments/checkout`

Creates a PayPal order for the hosted approval flow. Redirect the buyer to links[] where rel === 'approve'.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "amount": 2000,
  "currency": "USD",
  "description": "Product purchase",
  "successUrl": "https://yoursite.com/paypal/success",
  "cancelUrl": "https://yoursite.com/paypal/cancel",
  "metadata": {
    "orderId": "ORD-123",
    "source": "website"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "5O190127TN364715T",
    "status": "CREATED",
    "links": [
      {
        "href": "https://www.paypal.com/checkoutnow?token=5O190127TN364715T",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal order created successfully"
}
```

> **Note:** Auth guard currently disabled and userId hardcoded (see notes on Create order).

---

### Verify order after approval

`GET /paypal/payments/verify-session/{orderId}`

Confirms whether a PayPal order is approved/completed after the buyer returns from approval. Capture is handled separately.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name      | Description     |
| --------- | --------------- |
| `orderId` | PayPal Order ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "5O190127TN364715T",
    "status": "APPROVED",
    "links": [
      {
        "href": "https://www.paypal.com/checkoutnow?token=5O190127TN364715T",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal checkout session verified successfully"
}
```

> **Note:** Auth guard currently disabled (see notes on Create order).

---

## PayPal Subscriptions

[↑ Back to top](#table-of-contents)

| Endpoint                                                                                                         | Method & Path                                       | Auth |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---- |
| [Create subscription (hosted approval)](#paypal-subscriptions-create-subscription-hosted-approval)               | `POST /paypal/subscriptions/checkout`               | 🔒   |
| [Create subscription (custom UI — unsupported)](#paypal-subscriptions-create-subscription-custom-ui-unsupported) | `POST /paypal/subscriptions/intent`                 | 🔒   |
| [Get my subscription](#paypal-subscriptions-get-my-subscription)                                                 | `GET /paypal/subscriptions`                         | 🔒   |
| [Subscription history](#paypal-subscriptions-subscription-history)                                               | `GET /paypal/subscriptions/history`                 | 🔒   |
| [List available plans](#paypal-subscriptions-list-available-plans)                                               | `GET /paypal/subscriptions/plans`                   | 🔒   |
| [Revise subscription plan](#paypal-subscriptions-revise-subscription-plan)                                       | `PATCH /paypal/subscriptions/revise`                | 🔒   |
| [Cancel subscription](#paypal-subscriptions-cancel-subscription)                                                 | `POST /paypal/subscriptions/cancel`                 | 🔒   |
| [Resume subscription](#paypal-subscriptions-resume-subscription)                                                 | `POST /paypal/subscriptions/resume`                 | 🔒   |
| [Verify subscription after approval](#paypal-subscriptions-verify-subscription-after-approval)                   | `GET /paypal/subscriptions/verify/{subscriptionId}` | 🔒   |

### Create subscription (hosted approval)

`POST /paypal/subscriptions/checkout`

Creates a PayPal subscription using the hosted approval flow. The buyer must approve on PayPal via the returned approval link.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "planId": "P-5ML4271244454362WXNWU5NQ",
  "successUrl": "https://yoursite.com/paypal/subscription/success",
  "cancelUrl": "https://yoursite.com/paypal/subscription/cancel",
  "metadata": {
    "source": "website",
    "campaign": "spring-sale"
  }
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "APPROVAL_PENDING",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal subscription created successfully"
}
```

> **Note:** Controller currently hardcodes userId = '1' for testing (see TODO in source) and its auth guard is commented out.

---

### Create subscription (custom UI — unsupported)

`POST /paypal/subscriptions/intent`

PayPal requires buyer approval for subscriptions; this endpoint returns a 'not supported' error by design.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "planId": "P-5ML4271244454362WXNWU5NQ",
  "paymentSourceToken": "CARD-1234567890",
  "metadata": {
    "source": "mobile-app",
    "campaign": "spring-sale"
  }
}
```

**Success response** (`200`):

```json
{
  "data": null,
  "status": 200,
  "message": "PayPal subscription created successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "This PayPal feature is not supported"
}
```

> **Note:** Expect the FEATURE_NOT_SUPPORTED error in normal use — PayPal subscriptions cannot be created without buyer approval.

---

### Get my subscription

`GET /paypal/subscriptions`

Returns the current PayPal subscription for the user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "APPROVAL_PENDING",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal subscription retrieved successfully"
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "PayPal subscription not found"
}
```

---

### Subscription history

`GET /paypal/subscriptions/history`

Returns PayPal subscription history for the user.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "id": "I-BW452GLLEP1G",
      "status": "APPROVAL_PENDING",
      "plan_id": "P-5ML4271244454362WXNWU5NQ",
      "links": [
        {
          "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
          "rel": "approve",
          "method": "GET"
        }
      ]
    }
  ],
  "status": 200,
  "message": "PayPal subscriptions retrieved successfully"
}
```

---

### List available plans

`GET /paypal/subscriptions/plans`

Returns available PayPal subscription plans.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Success response** (`200`):

```json
{
  "data": [
    {
      "id": "P-5ML4271244454362WXNWU5NQ",
      "name": "Pro Monthly",
      "status": "ACTIVE"
    }
  ],
  "status": 200,
  "message": "Operation completed successfully"
}
```

---

### Revise subscription plan

`PATCH /paypal/subscriptions/revise`

Revises the PayPal subscription to a new plan. PayPal applies the change on the next billing cycle; buyer approval may be required.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "newPlanId": "P-5ML4271244454362WXNWU5NQ"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "APPROVAL_PENDING",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal subscription updated successfully"
}
```

---

### Cancel subscription

`POST /paypal/subscriptions/cancel`

Cancels the PayPal subscription.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{
  "cancelImmediately": true,
  "reason": "Customer requested cancellation"
}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "CANCELLED",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal subscription canceled successfully"
}
```

---

### Resume subscription

`POST /paypal/subscriptions/resume`

Resumes a suspended/cancelled PayPal subscription.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Content-Type`  | `application/json`     |
| `Authorization` | `Bearer <accessToken>` |

**Request body:**

```json
{}
```

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "APPROVAL_PENDING",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal subscription resumed successfully"
}
```

> **Note:** ResumeSubscriptionDto has no real fields — send an empty JSON object {}.

---

### Verify subscription after approval

`GET /paypal/subscriptions/verify/{subscriptionId}`

Verifies a PayPal subscription after the buyer returns from the approval redirect.

**Auth required:** Yes — Bearer token

**Headers:**

| Name            | Value                  |
| --------------- | ---------------------- |
| `Authorization` | `Bearer <accessToken>` |

**Path params:**

| Name             | Description            |
| ---------------- | ---------------------- |
| `subscriptionId` | PayPal subscription ID |

**Success response** (`200`):

```json
{
  "data": {
    "id": "I-BW452GLLEP1G",
    "status": "ACTIVE",
    "plan_id": "P-5ML4271244454362WXNWU5NQ",
    "links": [
      {
        "href": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
        "rel": "approve",
        "method": "GET"
      }
    ]
  },
  "status": 200,
  "message": "PayPal checkout session verified successfully"
}
```

---

## PayPal Webhooks

[↑ Back to top](#table-of-contents)

| Endpoint                                                            | Method & Path           | Auth |
| ------------------------------------------------------------------- | ----------------------- | ---- |
| [PayPal webhook receiver](#paypal-webhooks-paypal-webhook-receiver) | `POST /paypal/webhooks` | —    |

### PayPal webhook receiver

`POST /paypal/webhooks`

Receives and verifies PayPal webhook events (CHECKOUT.ORDER.APPROVED, BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED, INVOICING.INVOICE.PAID, etc.) via PayPal transmission headers.

**Auth required:** No

**Headers:**

| Name                       | Value              |
| -------------------------- | ------------------ |
| `paypal-transmission-id`   | `...`              |
| `paypal-transmission-time` | `...`              |
| `paypal-transmission-sig`  | `...`              |
| `paypal-cert-url`          | `...`              |
| `paypal-auth-algo`         | `...`              |
| `Content-Type`             | `application/json` |

**Request body:**

```json
{
  "id": "WH-1234567890",
  "event_type": "CHECKOUT.ORDER.APPROVED",
  "resource": {}
}
```

**Success response** (`200`):

```json
{
  "received": true
}
```

**Error responses:**

`400`:

```json
{
  "data": null,
  "status": 400,
  "message": "Failed to verify PayPal webhook signature"
}
```

> **Note:** Not callable meaningfully from this playground — PayPal computes the transmission signature headers server-side. Use PayPal's webhook simulator or a real sandbox event to exercise this endpoint. PAYPAL_WEBHOOK_ID must also be configured or verification always fails.

---
