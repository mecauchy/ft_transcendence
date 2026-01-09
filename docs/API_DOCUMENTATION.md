# Speak-Up Platform - Backend API Documentation

> **Base URL:** All endpoints are accessed through the API Gateway at `http://localhost:3000` (dev) or the production domain.

> **Authentication:** Most endpoints require a JWT Bearer token in the `Authorization` header:
> ```
> Authorization: Bearer <access_token>
> ```

---

## Table of Contents

1. [Authentication Service](#1-authentication-service)
2. [User Service](#2-user-service)
3. [Game Service](#3-game-service)
4. [Gamification Service](#4-gamification-service)
5. [WebSocket Connections](#5-websocket-connections)
6. [Error Responses](#6-error-responses)
7. [Data Types](#7-data-types)

---

## 1. Authentication Service

**Base Path:** `/api/auth`

### 1.1 Register (Username/Password)

Create a new user account with email and password.

```
POST /api/auth/register
```

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "dob": "1995-06-15"
}
```

|	Field		| Type	 | Required |								Validation									 |
|---------------|--------|----------|----------------------------------------------------------------------------|
| `username`	| string |	yes		| Unique 																	 |
| `email`		| string |	yes		| Valid email format, unique												 |
| `password`	| string |	yes		| Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char (`@$!%*?&`)|
| `dob`			| string |	yes		| ISO date format (YYYY-MM-DD)												 |

**Response (201 Created):**
```json
{
  "userId": "123",
  "message": "User registered successfully"
}
```

**Errors:**
- `400` - Missing required fields or invalid format
- `409` - Username or email already exists

---

### 1.2 Login (Username/Password)

Authenticate with email and password.

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK) - Without 2FA:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "userId": "123",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "PATIENT"
 }
}
```

**Response (200 OK) - With 2FA Enabled:**
```json
{
  "requires2FA": true,
  "userId": "123",
  "message": "2FA verification required"
}
```

> ⚠️ If `requires2FA: true`, you must call `/api/auth/2fa/verify` with a TOTP code before accessing protected endpoints.

**Errors:**
- `400` - Missing email or password
- `401` - Invalid credentials

---

### 1.3 OAuth Login (42 Intra)

Redirect user to 42 OAuth for authentication.

```
GET /api/auth/login/42
```

**Response:** Redirects to 42 OAuth consent page.

**Callback:** After authorization, user is redirected to:
```
GET /api/auth/callback/42?code=<auth_code>&state=<csrf_state>
```

**Callback Response (JSON if Accept: application/json):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "require2FA": false,
  "user": {
    "id": "123",
    "alias": "johndoe",
    "username": "johndoe",
    "email": "john@student.42.fr",
    "avatarUrl": "https://cdn.intra.42.fr/users/johndoe.jpg",
    "role": "PATIENT",
    "preferences": {
      "language": "en",
      "theme": "light",
      "accessibility": {
        "highContrast": false,
        "textToSpeech": false,
        "fontSize": "medium"
     }
   },
    "stats": {
      "sessionsCompleted": 0,
      "averageTrustScore": 0
   }
 }
}
```

---

### 1.4 Refresh Token

Get a new access token using a refresh token.

```
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `400` - Missing refresh token
- `401` - Invalid or expired refresh token

---

### 1.5 Logout

Invalidate the current session.

```
POST /api/auth/logout
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 1.6 2FA Setup

🔐 **Requires Authentication**

Generate a TOTP secret and QR code for 2FA setup.

```
POST /api/auth/2fa/setup
```

**Response (200 OK):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAAN...",
  "message": "Scan the QR code with your authenticator app, then verify with a code"
}
```

> 💡 Display the `qrCode` as an image (`<img src={qrCode} />`). The `secret` can be entered manually into authenticator apps.

**Errors:**
- `400` - 2FA already enabled
- `401` - Not authenticated

---

### 1.7 2FA Verify

🔐 **Requires Authentication**

Verify a TOTP code to enable 2FA or complete login.

```
POST /api/auth/2fa/verify
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA verification successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Errors:**
- `400` - Code is required / 2FA not configured
- `401` - Invalid verification code

---

### 1.8 2FA Disable

🔐 **Requires Authentication**

Disable 2FA for the account (requires current TOTP code).

```
POST /api/auth/2fa/disable
```

**Request Body:**
```json
{
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA has been disabled"
}
```

**Errors:**
- `400` - Code required / 2FA not enabled
- `401` - Invalid verification code

---

## 2. User Service

**Base Path:** `/api/users`

> 🔐 All endpoints require authentication.

### 2.1 Get Current User Profile

```
GET /api/users/profile/me
```

**Response (200 OK):**
```json
{
  "id": "123",
  "alias": "johndoe",
  "username": "johndoe",
  "email": "john@example.com",
  "avatarUrl": "/uploads/avatars/123_abc.png",
  "role": "PATIENT",
  "preferences": {
    "language": "en",
    "theme": "light",
    "accessibility": {
      "highContrast": false,
      "textToSpeech": false,
      "fontSize": "medium"
   }
 },
  "stats": {
    "sessionsCompleted": 5,
    "averageTrustScore": 78.5
 }
}
```

---

### 2.2 Update Current User Profile

```
PUT /api/users/profile/me
```

**Request Body:**
```json
{
  "username": "newusername",
  "email": "newemail@example.com",
  "preferences": {
    "language": "fr",
    "theme": "dark",
    "accessibility": {
      "highContrast": true,
      "textToSpeech": false,
      "fontSize": "large"
   }
 }
}
```

> All fields are optional. Only include fields you want to update.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

### 2.3 Upload Avatar

```
PUT /api/users/profile/me/avatar
```

**Request:** `multipart/form-data` with file field

| Field | Type | Allowed Types |
|-------|------|---------------|
| file | File | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

**Response (200 OK):**
```json
{
  "success": true,
  "url": "/uploads/avatars/123_abc123.png"
}
```

---

### 2.4 Get User Profile by ID

```
GET /api/users/profile/:id
```

**Response (200 OK):**
```json
{
  "id": "456",
  "username": "otheruser",
  "avatarUrl": "/uploads/avatars/456_def.png",
  "role": "PATIENT"
}
```

> ⚠️ Returns limited data for other users (no email, preferences, etc.)

---

### 2.5 Get User Settings

```
GET /api/users/settings
```

**Response (200 OK):**
```json
{
  "avatar": "/uploads/avatars/123_abc.png",
  "theme": "light",
  "language": "en",
  "accessibility": {
    "highContrast": false,
    "textToSpeech": false,
    "fontSize": "medium"
 },
  "notifications": {
    "email": true,
    "push": true,
    "friendRequests": true,
    "sessionInvites": true
 }
}
```

---

### 2.6 Update User Settings

```
PUT /api/users/settings
```

**Request Body:**
```json
{
  "theme": "dark",
  "language": "fr",
  "accessibility": {
    "highContrast": true,
    "fontSize": "large"
 },
  "notifications": {
    "email": false
 }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Settings updated"
}
```

---

### 2.7 List Friends

```
GET /api/users/friends
```

**Response (200 OK):**
```json
{
  "friends": [
    {
      "id": "456",
      "username": "frienduser",
      "status": "ONLINE",
      "lastSeen": 1703683200000
   },
    {
      "id": "789",
      "username": "anotherfriend",
      "status": "IN_SESSION",
      "lastSeen": 1703683200000
   }
  ],
  "pendingRequests": [
    {
      "id": "111",
      "username": "pendinguser",
      "avatarUrl": "/uploads/avatars/111_xyz.png",
      "requestedAt": "2024-12-27T10:00:00.000Z"
   }
  ],
  "sentRequests": [
    {
      "id": "222",
      "username": "requesteduser",
      "avatarUrl": null,
      "sentAt": "2024-12-27T09:00:00.000Z"
   }
  ]
}
```

| Status | Description |
|--------|-------------|
| `ONLINE` | User is connected |
| `OFFLINE` | User is not connected |
| `IN_SESSION` | User is in an active game session |

---

### 2.8 Send Friend Request

```
POST /api/users/friends
```

**Request Body:**
```json
{
  "targetId": "456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "status": "PENDING"
}
```

**Errors:**
- `400` - Cannot send request to yourself / Already friends / Request already pending
- `403` - User is blocked
- `404` - Target user not found

---

### 2.9 Accept/Reject Friend Request

```
PUT /api/users/friends/:id
```

**Request Body:**
```json
{
  "action": "accept"
}
```

| Action | Description |
|--------|-------------|
| `accept` | Accept the friend request |
| `reject` | Reject and delete the request |

**Response (200 OK):**
```json
{
  "success": true,
  "status": "ACCEPTED"
}
```

---

### 2.10 Remove Friend

```
DELETE /api/users/friends/:id
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Friend removed"
}
```

---

### 2.11 Block User

```
POST /api/users/friends/:id/block
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User blocked"
}
```

---

### 2.12 GDPR: Export User Data (JSON)

```
GET /api/users/gdpr/export
```

**Response:** Downloads a JSON file with all user data.

```json
{
  "exportedAt": "2024-12-27T12:00:00.000Z",
  "user": {
    "id": "123",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "PATIENT",
    "dateOfBirth": "1995-06-15T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastModified": "2024-12-27T10:00:00.000Z"
 },
  "settings": {
    "avatar": "/uploads/avatars/123_abc.png",
    "colour": "light",
    "locale": "en"
 },
  "sessions": [...],
  "friends": [...],
  "oauthConnections": [...]
}
```

---

### 2.13 GDPR: Export Sessions (CSV)

```
GET /api/users/gdpr/export/csv
```

**Response:** Downloads a CSV file with session history.

---

### 2.14 GDPR: Delete Account

```
DELETE /api/users/gdpr/delete
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Your account and personal data have been deleted. Some anonymized data may be retained for statistical purposes."
}
```

> ⚠️ This action is **irreversible**. All user data will be deleted.

---

### 2.15 GDPR: Submit Data Request

```
POST /api/users/gdpr/request
```

**Request Body:**
```json
{
  "type": "export",
  "details": "I need a full data export"
}
```

| Type | Description |
|------|-------------|
| `export` | Request full data export |
| `delete` | Request account deletion |
| `rectify` | Request data correction |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Your export request has been received. You will receive a confirmation email within 30 days as required by GDPR.",
  "requestId": "GDPR-1703683200000-123"
}
```

---

## 3. Game Service

**Base Path:** `/api/game`

> 🔐 All endpoints require authentication.

### 3.1 List Scenarios

```
GET /api/game/scenarios
```

**Response (200 OK):**
```json
{
  "scenarios": [
    {
      "id": "1",
      "title": "First Day at Work",
      "description": "Navigate your first day as a new employee...",
      "difficulty": "EASY",
      "estimatedDuration": 30,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
   },
    {
      "id": "2",
      "title": "Difficult Conversation",
      "description": "Practice having a difficult conversation...",
      "difficulty": "MEDIUM",
      "estimatedDuration": 45,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
   }
  ]
}
```

| Difficulty | Description |
|------------|-------------|
| `EASY` | Beginner-friendly scenarios |
| `MEDIUM` | Standard difficulty |
| `HARD` | Challenging scenarios |

---

### 3.2 Get Scenario Details

```
GET /api/game/scenarios/:id
```

**Response (200 OK):**
```json
{
  "id": "1",
  "title": "First Day at Work",
  "description": "Navigate your first day as a new employee...",
  "difficulty": "EASY",
  "estimatedDuration": 30,
  "graphData": {
    "nodes": [...],
    "edges": [...]
 },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 3.3 Get Scenario Statistics

```
GET /api/game/scenarios/:id/stats
```

**Response (200 OK):**
```json
{
  "scenarioId": "1",
  "totalSessions": 150,
  "completedSessions": 120,
  "completionRate": 80,
  "averageDuration": 1800,
  "averageMetrics": {
    "trust": "75.5",
    "compliance": "68.2"
 }
}
```

---

### 3.4 Get Scenario Leaderboard

```
GET /api/game/scenarios/:id/leaderboard?limit=10
```

**Query Parameters:**
| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `limit` | number | 10 | 100 |

**Response (200 OK):**
```json
{
  "scenarioId": "1",
  "leaderboard": [
    {
      "rank": 1,
      "userId": "456",
      "displayName": "topplayer",
      "avatarUrl": "/uploads/avatars/456_abc.png",
      "metrics": {
        "trust": 95,
        "stress": 10,
        "compliance": 90
     },
      "duration": 1200,
      "completedAt": "2024-12-20T15:00:00.000Z"
   }
  ]
}
```

---

### 3.5 Start Game Session

```
POST /api/game/session/start
```

**Request Body:**
```json
{
  "patientId": "123",
  "mode": "AI"
}
```

| Mode | Description |
|------|-------------|
| `AI` | Play against AI doctor |
| `P2P` | Play with a real doctor (matchmaking) |

**Response (200 OK):**
```json
{
  "sessionId": "abc123-def456-...",
  "wsUrl": "/ws/game?sessionId=abc123-def456-..."
}
```

> 💡 Use the `wsUrl` to connect via WebSocket for real-time gameplay.

---

### 3.6 Get Session State

```
GET /api/game/session/:id
```

**Response (200 OK) - Active Session:**
```json
{
  "state": {
    "sessionId": "abc123-def456-...",
    "sequenceId": 42,
    "lastUpdateTimestamp": 1703683200000,
    "status": "ACTIVE",
    "metrics": {
      "trust": 65,
      "stress": 30,
      "compliance": 70,
      "mood": "CALM"
   },
    "actionNodeId": "NODE_15",
    "narrativeFlags": {},
    "inventory": [],
    "participants": {
      "patient": {
        "userId": "123",
        "connectionStatus": "CONNECTED",
        "lastAckSequenceId": 41,
        "currentActivity": "CHOOSING"
     },
      "doctor": {
        "userId": "AI_DOCTOR",
        "connectionStatus": "CONNECTED",
        "lastAckSequenceId": 42,
        "currentActivity": "WAITING"
     }
   }
 }
}
```

**Response (200 OK) - Completed Session:**
```json
{
  "sessionId": "abc123-def456-...",
  "status": "COMPLETED",
  "mode": "AI",
  "createdAt": "2024-12-27T10:00:00.000Z",
  "endedAt": "2024-12-27T10:30:00.000Z",
  "finalMetrics": {
    "trust": 85,
    "stress": 20,
    "compliance": 80,
    "mood": "BREAKTHROUGH"
 }
}
```

---

### 3.7 Get Session History

```
GET /api/game/session/:id/history
```

**Response (200 OK):**
```json
{
  "sessionId": "abc123-def456-...",
  "events": [
    {
      "type": "DIALOGUE",
      "speaker": "DOCTOR",
      "text": "How are you feeling today?",
      "timestamp": 1703683200000
   },
    {
      "type": "CHOICE",
      "selectedOption": 2,
      "timestamp": 1703683205000
   }
  ],
  "finalState": {
    "sessionId": "abc123-def456-...",
    "status": "COMPLETED",
    "metrics": {...}
 }
}
```

---

### 3.8 Surrender Session

```
POST /api/game/session/:id/surrender
```

**Request Body:**
```json
{
  "reason": "I need to leave"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Session ended"
}
```

---

### 3.9 List Active Sessions

```
GET /api/game/session/active
```

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "sessionId": "abc123-def456-...",
      "mode": "AI",
      "status": "ACTIVE",
      "createdAt": "2024-12-27T10:00:00.000Z"
   }
  ]
}
```

---

## 4. Gamification Service

**Base Path:** `/api/gamification`

> 🔐 All endpoints require authentication.

### 4.1 Get User XP Summary

```
GET /api/gamification/xp/me
```

**Response (200 OK):**
```json
{
  "userId": "123",
  "totalXp": 2500,
  "currentLevel": 5,
  "xpToNextLevel": 500,
  "xpForCurrentLevel": 2000,
  "progressPercentage": 50
}
```

---

### 4.2 Get XP History

```
GET /api/gamification/xp/history?limit=50&offset=0
```

**Query Parameters:**
| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `limit` | number | 50 | 100 |
| `offset` | number | 0 | - |

**Response (200 OK):**
```json
{
  "history": [
    {
      "id": "log123",
      "amount": 100,
      "reason": "Session completed",
      "sessionId": "abc123-def456-...",
      "createdAt": "2024-12-27T10:30:00.000Z"
   }
  ]
}
```

---

### 4.3 Get Daily XP Breakdown

```
GET /api/gamification/xp/daily?days=30
```

**Query Parameters:**
| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `days` | number | 30 | 365 |

**Response (200 OK):**
```json
{
  "dailyXP": [
    {
      "date": "2024-12-27",
      "xp": 150
   },
    {
      "date": "2024-12-26",
      "xp": 200
   }
  ]
}
```

---

### 4.4 Award XP (Admin Only)

```
POST /api/gamification/xp/award
```

> 🔐 Requires `ADMIN` role.

**Request Body:**
```json
{
  "userId": "456",
  "amount": 100,
  "reason": "Community contribution",
  "sessionId": null
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "xpLog": {...},
  "levelUp": true,
  "newLevel": 6,
  "newAchievements": [
    {
      "id": "ach123",
      "name": "Level 5 Reached",
      "xpReward": 50
   }
  ]
}
```

---

### 4.5 Get XP Rewards Config

```
GET /api/gamification/xp/rewards
```

**Response (200 OK):**
```json
{
  "rewards": {
    "sessionComplete": 100,
    "perfectSession": 200,
    "dailyLogin": 10,
    "friendAdded": 25
 }
}
```

---

### 4.6 List All Achievements

```
GET /api/gamification/achievements
```

**Response (200 OK):**
```json
{
  "achievements": [
    {
      "id": "ach001",
      "code": "FIRST_SESSION",
      "name": "First Steps",
      "description": "Complete your first session",
      "iconUrl": "/assets/achievements/first_session.png",
      "xpReward": 50,
      "rarity": "COMMON",
      "category": "sessions",
      "isHidden": false
   }
  ]
}
```

| Rarity | Description |
|--------|-------------|
| `COMMON` | Easy to obtain |
| `UNCOMMON` | Moderate effort |
| `RARE` | Requires dedication |
| `EPIC` | Difficult to achieve |
| `LEGENDARY` | Extremely rare |

---

### 4.7 Get User's Achievements

```
GET /api/gamification/achievements/me
```

**Response (200 OK):**
```json
{
  "unlocked": [
    {
      "achievementId": "ach001",
      "unlockedAt": "2024-12-15T10:00:00.000Z"
   }
  ],
  "unlockedCount": 5,
  "totalCount": 20,
  "completionPercentage": 25
}
```

---

### 4.8 Get Achievement Details

```
GET /api/gamification/achievements/:id
```

**Response (200 OK):**
```json
{
  "achievement": {
    "id": "ach002",
    "code": "TEN_SESSIONS",
    "name": "Getting Started",
    "description": "Complete 10 sessions",
    "xpReward": 100,
    "rarity": "UNCOMMON",
    "category": "sessions"
 },
  "isUnlocked": false,
  "unlockedAt": null,
  "progress": {
    "progress": 7,
    "total": 10,
    "percentage": 70
 }
}
```

---

### 4.9 Get All Achievement Progress

```
GET /api/gamification/achievements/progress
```

**Response (200 OK):**
```json
{
  "progress": [
    {
      "achievementId": "ach001",
      "name": "First Steps",
      "isUnlocked": true,
      "progress": 100
   },
    {
      "achievementId": "ach002",
      "name": "Getting Started",
      "isUnlocked": false,
      "progress": 70
   }
  ]
}
```

---

### 4.10 Get Global Leaderboard

```
GET /api/gamification/leaderboard?type=XP&limit=100&offset=0
```

**Query Parameters:**
| Parameter | Type | Default | Options |
|-----------|------|---------|---------|
| `type` | string | XP | `XP`, `LEVEL`, `SESSIONS`, `ACHIEVEMENTS` |
| `limit` | number | 100 | Max 500 |
| `offset` | number | 0 | - |

**Response (200 OK):**
```json
{
  "type": "XP",
  "entries": [
    {
      "rank": 1,
      "userId": "456",
      "username": "topplayer",
      "avatarUrl": "/uploads/avatars/456_abc.png",
      "value": 15000
   }
  ],
  "total": 100,
  "userRank": 42
}
```

---

### 4.11 Get Scenario Leaderboard

```
GET /api/gamification/leaderboard/scenario/:scenarioId?limit=100&offset=0
```

**Response (200 OK):**
```json
{
  "scenarioId": "1",
  "entries": [
    {
      "rank": 1,
      "userId": "456",
      "username": "topplayer",
      "value": 95,
      "completedAt": "2024-12-20T15:00:00.000Z"
   }
  ],
  "total": 50
}
```

---

### 4.12 Get Friends Leaderboard

```
GET /api/gamification/leaderboard/friends?limit=50
```

**Response (200 OK):**
```json
{
  "entries": [
    {
      "rank": 1,
      "userId": "789",
      "username": "myfriend",
      "avatarUrl": "/uploads/avatars/789_def.png",
      "value": 8000
   }
  ],
  "total": 5
}
```

---

### 4.13 Get Current User's Rank

```
GET /api/gamification/leaderboard/me?type=XP
```

**Response (200 OK):**
```json
{
  "type": "XP",
  "userRank": 42,
  "surroundingPlayers": [
    {"rank": 38, "userId": "111", "username": "player38", "value": 2600},
    {"rank": 39, "userId": "112", "username": "player39", "value": 2550},
    {"rank": 40, "userId": "113", "username": "player40", "value": 2520},
    {"rank": 41, "userId": "114", "username": "player41", "value": 2510},
    {"rank": 42, "userId": "123", "username": "johndoe", "value": 2500},
    {"rank": 43, "userId": "115", "username": "player43", "value": 2480}
  ]
}
```

---

## 5. WebSocket Connections

### 5.1 Game WebSocket

**URL:** `ws://localhost:3000/ws/game?sessionId=<session_id>&token=<jwt_token>`

**Connection:**
```javascript
const ws = new WebSocket(`ws://localhost:3000/ws/game?sessionId=${sessionId}&token=${accessToken}`);
```

**Message Format:**
```json
{
  "type": "MESSAGE_TYPE",
  "payload": {...},
  "timestamp": 1703683200000
}
```

**Message Types (Client → Server):**

| Type | Description | Payload |
|------|-------------|---------|
| `CHOICE` | Player makes a choice | `{optionId: string}` |
| `ACTION` | Player performs an action | `{actionType: string, data: any}` |
| `HEARTBEAT` | Keep connection alive | `{}` |

**Message Types (Server → Client):**

| Type | Description |
|------|-------------|
| `STATE_UPDATE` | Game state changed |
| `DIALOGUE` | New dialogue from NPC/Doctor |
| `CHOICE_PROMPT` | Present choices to player |
| `METRICS_UPDATE` | Metrics (trust, stress, etc.) changed |
| `SESSION_END` | Session completed/terminated |
| `ERROR` | Error occurred |

---

### 5.2 Investigation WebSocket (Gateway)

**URL:** `ws://localhost:3000/investigation?token=<jwt_token>`

**Initial Response:**
```json
{
  "type": "CONNECTED",
  "message": "Welcome to Speak-Up Investigation Engine",q
  "timestamp": 1703683200000
}
```

**Error Responses:**
```json
{
  "type": "ERROR",
  "code": "AUTH_REQUIRED",
  "message": "Authentication token required. Pass ?token=<jwt> in query string."
}
```

---

## 6. Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Human-readable error description"
}
```

### Common Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| `400` | Bad Request | Invalid input, missing required fields |
| `401` | Unauthorized | Missing/invalid token, token expired |
| `403` | Forbidden | 2FA required, insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Duplicate entry (username, email) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Server-side error |

---

## 7. Data Types

### User Roles

```typescript
type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';
```

### Session Status

```typescript
type SessionStatus = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';
```

### Session Mode

```typescript
type SessionMode = 'AI' | 'P2P';
```

### Friend Status

```typescript
type FriendStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';
```

### Online Status

```typescript
type OnlineStatus = 'ONLINE' | 'OFFLINE' | 'IN_SESSION';
```

### Difficulty

```typescript
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
```

### Achievement Rarity

```typescript
type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
```

### Mood

```typescript
type Mood = 'CALM' | 'ANXIOUS' | 'DEFENSIVE' | 'BREAKTHROUGH';
```

### Leaderboard Type

```typescript
type LeaderboardType = 'XP' | 'LEVEL' | 'SESSIONS' | 'ACHIEVEMENTS';
```

---

## Quick Reference Card

### Authentication Flow

```
1. Register: POST /api/auth/register
2. Login: POST /api/auth/login
   └── If requires2FA: POST /api/auth/2fa/verify
3. Use accessToken in Authorization header
4. When token expires: POST /api/auth/refresh
5. Logout: POST /api/auth/logout
```

### OAuth Flow

```
1. Redirect to: GET /api/auth/login/42
2. User authorizes on 42 Intra
3. Callback: GET /api/auth/callback/42
4. Receive tokens and user data
```

### Game Flow

```
1. List scenarios: GET /api/game/scenarios
2. Start session: POST /api/game/session/start
3. Connect WebSocket: ws://.../ws/game?sessionId=...&token=...
4. Play game via WebSocket messages
5. View results: GET /api/game/session/:id
```

---

*Last updated: December 27, 2024*
