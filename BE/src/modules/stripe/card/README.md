# Stripe Card Module - API Usage

## Endpoints

### Add Card

```http
POST /stripe/cards
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "paymentMethodId": "pm_1234567890abcdef"
}
```

**Response:**

```json
{
  "id": "card-id",
  "paymentMethodId": "pm_1234567890abcdef",
  "last4": "4242",
  "brand": "visa",
  "expMonth": 12,
  "expYear": 2025,
  "isDefault": false
}
```

### Get User Cards

```http
GET /stripe/cards
Authorization: Bearer <token>
```

**Response:**

```json
{
  "cards": [
    {
      "id": "card-id",
      "last4": "4242",
      "brand": "visa",
      "expMonth": 12,
      "expYear": 2025,
      "isDefault": true
    }
  ]
}
```

### Get All Cards (Admin)

```http
GET /stripe/cards/all
Authorization: Bearer <token>
```

**Response:**

```json
{
  "cards": [
    {
      "id": "card-id",
      "userId": "user-id",
      "last4": "4242",
      "brand": "visa"
    }
  ]
}
```

### Delete Card

```http
DELETE /stripe/cards/:id
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "Card deleted successfully"
}
```

### Set Default Card

```http
PATCH /stripe/cards/:id/default
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{}
```

**Response:**

```json
{
  "id": "card-id",
  "last4": "4242",
  "isDefault": true
}
```
