# Notifications Module - API Usage

## Public API

Three focused services, replacing a single `NotificationsService`.

| Service                     | Owns                                                                            |
| --------------------------- | ------------------------------------------------------------------------------- |
| `NotificationService`       | Notification records: raising them, reading them back with read state merged in |
| `NotificationReadService`   | Per-recipient read state: seeding, marking read, unread counts                  |
| `NotificationStreamService` | SSE connection lifecycle and live delivery                                      |

To raise a notification from another module, inject `NotificationService` and
call `sendToUser(userId, { type, message, title?, data? })`. It stores the
record, seeds unread state, and pushes to the recipient if they are connected.

**Delivery is process-local.** `NotificationStreamService` holds its client map
in memory, so a second instance has its own connections. That constraint is
contained to that one file — moving to Redis pub/sub means replacing that
service, not unpicking delivery from persistence. See
[`docs/architecture/module-architecture.md`](../../../docs/architecture/module-architecture.md).

## Endpoints

### Stream Notifications (SSE)

```http
GET /notifications/stream/:userId
Authorization: Bearer <token>
```

**Response:** Server-Sent Events stream

### Get User Notifications

```http
GET /notifications/user?page=1&limit=10
Authorization: Bearer <token>
```

**Query Parameters:**

- `page`: number (optional, default: 1)
- `limit`: number (optional, default: 10, max: 100)

**Response:**

```json
{
  "notifications": [
    {
      "id": "notification-id",
      "title": "New Message",
      "body": "You have a new message",
      "read": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### Mark All Notifications as Read

```http
PATCH /notifications/mark-all-read
Authorization: Bearer <token>
```

**Response:**

```json
{
  "message": "All notifications marked as read",
  "updatedCount": 10
}
```

### Get Unread Count

```http
GET /notifications/unread-count
Authorization: Bearer <token>
```

**Response:**

```json
{
  "unreadCount": 5
}
```
