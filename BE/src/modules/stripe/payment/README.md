# Stripe Payment Module - API Usage

## Endpoints

### Create Payment Intent

```http
POST /stripe/payments/intent
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "amount": 2000,
  "currency": "usd",
  "description": "Product purchase",
  "metadata": {
    "orderId": "ORD-123",
    "productId": "PROD-456"
  },
  "guestEmail": "customer@example.com"
}
```

**Response:**

```json
{
  "id": "pi_1234567890",
  "client_secret": "pi_1234567890_secret_...",
  "amount": 2000,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

### Get Payment Intent

```http
GET /stripe/payments/intent/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "pi_1234567890",
  "amount": 2000,
  "currency": "usd",
  "status": "succeeded",
  "payment_method": "pm_1234567890"
}
```

### Create Checkout Session

```http
POST /stripe/payments/checkout
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "amount": 2000,
  "currency": "usd",
  "description": "Product purchase",
  "successUrl": "https://yoursite.com/payment/success",
  "cancelUrl": "https://yoursite.com/payment/cancel",
  "metadata": {
    "orderId": "ORD-123"
  },
  "guestEmail": "customer@example.com"
}
```

**Response:**

```json
{
  "id": "cs_test_1234567890",
  "url": "https://checkout.stripe.com/pay/cs_test_...",
  "status": "open"
}
```

### Verify Checkout Session

```http
GET /stripe/payments/verify-session/:sessionId
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "cs_test_1234567890",
  "payment_status": "paid",
  "status": "complete",
  "amount_total": 2000
}
```
