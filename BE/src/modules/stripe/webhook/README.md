# Stripe Webhook Module - API Usage

## Endpoint

### Handle Webhook Events

```http
POST /stripe/webhooks
Content-Type: application/json
Stripe-Signature: <signature>
```

**Note:** This endpoint is called by Stripe, not by your application directly.

**Handled Events:**

- `checkout.session.completed` - Payment or subscription checkout completed
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription updated
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Invoice payment succeeded
- `invoice.payment_failed` - Invoice payment failed

**Response:**

```json
{
  "received": true
}
```

**Error Response:**

```json
{
  "status": 400,
  "message": "Webhook signature verification failed"
}
```
