# Stripe Invoice Module - API Usage

## Endpoints

### Create Invoice

```http
POST /stripe/invoices
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "customerId": "507f1f77bcf86cd799439011",
  "amount": 2000,
  "currency": "usd",
  "description": "Service fee",
  "metadata": {
    "orderId": "12345"
  }
}
```

**Response:**

```json
{
  "id": "in_1234567890abcdef",
  "amount_due": 2000,
  "currency": "usd",
  "status": "draft",
  "customer": "cus_1234567890"
}
```

### Get Invoice By ID

```http
GET /stripe/invoices/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "id": "in_1234567890abcdef",
  "amount_due": 2000,
  "amount_paid": 0,
  "currency": "usd",
  "status": "open",
  "customer": "cus_1234567890",
  "created": 1733011200
}
```

### Pay Invoice

```http
POST /stripe/invoices/pay/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "payWithCard": true
}
```

**Response:**

```json
{
  "id": "in_1234567890abcdef",
  "status": "paid",
  "amount_paid": 2000,
  "paid": true
}
```
