# Stripe Subscription Module - API Usage

## Endpoints

### Create Subscription Checkout

```http
POST /stripe/subscriptions/checkout
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "priceId": "price_1234567890abcdef",
  "successUrl": "https://yoursite.com/subscription/success",
  "cancelUrl": "https://yoursite.com/subscription/cancel",
  "metadata": {
    "source": "website"
  }
}
```

**Response:**

```json
{
  "id": "cs_test_1234567890",
  "url": "https://checkout.stripe.com/subscription/cs_test_...",
  "status": "open"
}
```

### Create Subscription Intent

```http
POST /stripe/subscriptions/intent
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "priceId": "price_1234567890abcdef",
  "metadata": {
    "source": "website"
  }
}
```

**Response:**

```json
{
  "id": "sub_1234567890",
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
```

### Get User Subscription

```http
GET /stripe/subscriptions
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "sub_1234567890",
  "status": "active",
  "current_period_start": 1733011200,
  "current_period_end": 1735689600,
  "cancel_at_period_end": false
}
```

### Get Subscription History

```http
GET /stripe/subscriptions/history
Authorization: Bearer <token>
```

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "sub_1234567890",
      "status": "active",
      "created": 1733011200
    }
  ]
}
```

### Get Available Plans

```http
GET /stripe/subscriptions/plans
Authorization: Bearer <token>
```

**Response:**

```json
{
  "plans": [
    {
      "id": "price_1234567890",
      "amount": 2000,
      "currency": "usd",
      "interval": "month",
      "product": {
        "name": "Premium Plan"
      }
    }
  ]
}
```

### Create Subscription Plan

Operators only — OWNER or ADMIN. Creates the Stripe Product and recurring
Price, then stores the plan so `GET /plans` serves it.

```http
POST /stripe/subscriptions/plans
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Pro",
  "amount": 2900,
  "interval": "month",
  "description": "For growing teams.",
  "currency": "usd",
  "features": ["Unlimited projects", "Priority support"]
}
```

`amount` is in the currency's smallest unit — `2900` is $29.00 — and must be at
least 50. `interval` is `month` or `year`. `description`, `currency` (defaults
to `usd`) and `features` are optional.

**Response:** `201`

```json
{
  "data": {
    "name": "Pro",
    "stripePriceId": "price_1234567890abcdef",
    "amount": 2900,
    "currency": "usd",
    "interval": "month",
    "isActive": true
  },
  "status": 201,
  "message": "Subscription plan created successfully"
}
```

**Failures:**

| Status | When                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| `403`  | Caller is not an OWNER or ADMIN                                                    |
| `409`  | A plan with that name already exists                                               |
| `500`  | The plan could not be stored; the Stripe product is archived rather than left live |

The `409` is checked before Stripe is called, so in the ordinary case nothing is
created. That check is a read, though, and cannot see a plan another request is
inserting at the same moment — so a unique index on `name` backs it. When two
requests race, the loser is rejected at the write, after its Stripe Product and
Price already exist; both are archived before the `409` is returned, exactly as
they are for a `500`.

> **Deploying this against an existing database:** the unique index cannot build
> if the collection already holds two plans with the same name. Mongoose reports
> that on the model's `index` event and the app boots anyway — with no index, and
> so without the guarantee above. Check for duplicate names before deploying.

### Upgrade Subscription

```http
PATCH /stripe/subscriptions/upgrade
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "priceId": "price_new_plan_id"
}
```

**Response:**

```json
{
  "id": "sub_1234567890",
  "status": "active",
  "items": {
    "data": [
      {
        "price": {
          "id": "price_new_plan_id"
        }
      }
    ]
  }
}
```

### Downgrade Subscription

```http
PATCH /stripe/subscriptions/downgrade
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "priceId": "price_lower_plan_id"
}
```

**Response:**

```json
{
  "id": "sub_1234567890",
  "status": "active",
  "cancel_at_period_end": false
}
```

### Cancel Subscription

```http
POST /stripe/subscriptions/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "cancelAtPeriodEnd": true
}
```

**Response:**

```json
{
  "id": "sub_1234567890",
  "status": "active",
  "cancel_at_period_end": true
}
```

### Resume Subscription

```http
POST /stripe/subscriptions/resume
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "sub_1234567890",
  "status": "active",
  "cancel_at_period_end": false
}
```

### Verify Checkout Session

```http
GET /stripe/subscriptions/verify/:sessionId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "cs_test_1234567890",
  "status": "complete",
  "subscription": "sub_1234567890"
}
```
