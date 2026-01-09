# ft_transcendence API Documentation

> **Base URL:** `https://localhost:8443/api`  
> **Auth:** Bearer token in `Authorization` header for protected endpoints

---

## Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Create account (username, email, password, dob) |
| POST | `/login` | ❌ | Login with email/password → returns tokens or `require2FA: true` |
| GET | `/login/42` | ❌ | Redirect to 42 OAuth |
| GET | `/callback/42` | ❌ | OAuth callback → redirects with tokens |
| POST | `/refresh` | ❌ | Refresh access token |
| POST | `/logout` | ✅ | Invalidate session |

### 2FA (`/api/auth/2fa`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/setup` | ✅ | Generate QR code for TOTP setup |
| POST | `/verify` | ✅ | Verify code & enable 2FA |
| POST | `/verify-login` | ❌ | Verify 2FA during login (needs `userId` + `code`) |
| POST | `/disable` | ✅ | Disable 2FA (needs current `code`) |

---

## Users (`/api/users`)

### Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/profile/me` | ✅ | Get own profile |
| PUT | `/profile/me` | ✅ | Update profile (username, displayName, bio) |
| PUT | `/profile/me/avatar` | ✅ | Upload avatar (multipart/form-data) |
| GET | `/profile/:userId` | ✅ | Get user by ID |
| GET | `/profile/search?q=` | ✅ | Search users by username |

### Friends

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/friends` | ✅ | List friends |
| POST | `/friends/:userId` | ✅ | Send friend request |
| PUT | `/friends/:requestId/accept` | ✅ | Accept request |
| PUT | `/friends/:requestId/reject` | ✅ | Reject request |
| DELETE | `/friends/:userId` | ✅ | Remove friend |
| POST | `/friends/:userId/block` | ✅ | Block user |
| DELETE | `/friends/:userId/block` | ✅ | Unblock user |
| GET | `/friends/blocked` | ✅ | List blocked users |
| GET | `/friends/pending` | ✅ | List pending requests |

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/chat/conversations` | ✅ | List conversations |
| GET | `/chat/conversations/:id` | ✅ | Get conversation messages |
| POST | `/chat/conversations` | ✅ | Create/get conversation with user |
| POST | `/chat/messages` | ✅ | Send message |
| PUT | `/chat/messages/:id/read` | ✅ | Mark message as read |
| GET | `/chat/unread` | ✅ | Get unread message count |

### Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | List notifications (query: `limit`, `offset`) |
| GET | `/notifications/unread-count` | ✅ | Get unread count |
| PUT | `/notifications/:id/read` | ✅ | Mark as read |
| PUT | `/notifications/read-all` | ✅ | Mark all as read |
| DELETE | `/notifications/:id` | ✅ | Delete notification |
| DELETE | `/notifications` | ✅ | Delete all notifications |

### Settings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/settings` | ✅ | Get user settings |
| PUT | `/settings` | ✅ | Update settings (locale, theme, etc.) |

### GDPR

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/gdpr/export` | ✅ | Export data as JSON |
| GET | `/gdpr/export/csv` | ✅ | Export data as CSV |
| GET | `/gdpr/export/xml` | ✅ | Export data as XML |
| DELETE | `/gdpr/delete` | ✅ | Delete account & all data |

---

## Game (`/api/game`)

### Sessions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/sessions` | ✅ | Create game session |
| GET | `/sessions/active` | ✅ | Get active session |
| GET | `/sessions/:id` | ✅ | Get session by ID |
| PUT | `/sessions/:id/complete` | ✅ | Complete session with results |
| DELETE | `/sessions/:id` | ✅ | Cancel session |

### Leaderboard & History

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/leaderboard` | ✅ | Global leaderboard |
| GET | `/history` | ✅ | User's match history |
| GET | `/stats` | ✅ | User's game statistics |

### Scenarios

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/scenarios` | ✅ | List game scenarios |
| GET | `/scenarios/:id` | ✅ | Get scenario details |
| GET | `/scenarios/:id/leaderboard` | ✅ | Scenario leaderboard |

---

## Gamification (`/api/gamification`)

### XP & Levels

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/xp/me` | ✅ | Get user's XP, level, progress |
| POST | `/xp/award` | 🔒 | Award XP (internal use) |
| GET | `/xp/rewards` | ✅ | List level-up rewards |

### Achievements

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/achievements` | ✅ | List all achievements |
| GET | `/achievements/me` | ✅ | Get user's unlocked achievements |
| GET | `/achievements/progress` | ✅ | Get achievement progress |

### Shop

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/shop/items` | ✅ | List shop items |
| POST | `/shop/purchase/:itemId` | ✅ | Purchase item |
| GET | `/shop/inventory` | ✅ | Get user's inventory |

---

## WebSocket (`/api/ws`)

Connect to `/api/ws/realtime` with Bearer token for real-time events.

### Event Types Received

| Event | Description |
|-------|-------------|
| `NOTIFICATION` | New notification |
| `MESSAGE` | New chat message |
| `FRIEND_REQUEST` | Friend request received |
| `FRIEND_ACCEPTED` | Friend request accepted |
| `PRESENCE_UPDATE` | User online/offline status |
| `GAME_INVITE` | Game invitation |
| `TYPING` | User typing indicator |

### Events to Send

```json
{"type": "PING"}
{"type": "SUBSCRIBE", "channel": "user:123:notifications"}
```

---

## Notification Types

| Type | Description |
|------|-------------|
| `ACHIEVEMENT` | Achievement unlocked |
| `LEVEL_UP` | Level increased |
| `FRIEND_REQUEST` | Friend request received |
| `FRIEND_ACCEPTED` | Friend request accepted |
| `MESSAGE` | New chat message |
| `GAME_INVITE` | Game invitation |
| `SYSTEM` | System notification |

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limits

- **Authentication:** 5 requests/minute per IP
- **General API:** 100 requests/minute per user
- **WebSocket:** 50 messages/minute per connection

---

## Quick Examples

### Login Flow

```bash
# 1. Login
curl -X POST https://localhost:8443/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login": "user@example.com", "password": "Pass123!"}'

# 2. Use token
curl https://localhost:8443/api/users/profile/me \
  -H "Authorization: Bearer <accessToken>"
```

### OAuth Flow

1. Redirect user to `GET /api/auth/login/42`
2. User authorizes on 42 Intra
3. Callback redirects to frontend with tokens in URL

### Refresh Token

```bash
curl -X POST https://localhost:8443/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'
```
