# Speak Up - Backend API Documentation

> **Version:** 1.0.0  
> **Last Updated:** December 25, 2025  
> **Base URL:** `https://localhost/api` (through WAF) or `http://localhost:3000/api` (direct)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication](#authentication)
3. [Auth Service (Port 3001)](#auth-service)
4. [User Service (Port 3002)](#user-service)
5. [Game Service (Port 3003)](#game-service)
6. [Gamification Service (Port 3004)](#gamification-service)
7. [WebSocket Protocol](#websocket-protocol)
8. [Error Handling](#error-handling)
9. [TypeScript Types](#typescript-types)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           WAF (Port 443)                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────┐
│                      API Gateway (Port 3000)                        │
│                   Routes requests to microservices                   │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼──────┐
│   Auth     │ │   User     │ │   Game     │ │Gamification │
│  Service   │ │  Service   │ │  Service   │ │   Service   │
│  :3001     │ │  :3002     │ │  :3003     │ │   :3004     │
└──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬──────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │ PostgreSQL│   │   Redis   │   │   Vault   │
        │  :5432    │   │   :6379   │   │   :8200   │
        └───────────┘   └───────────┘   └───────────┘
```

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Token Structure

```typescript
interface JWTPayload {
  userId: string;      // User's database ID
  email: string;       // User's email
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  timeIssued: number;         // Issued at timestamp
  timeExp: number;         // Expiration timestamp
}
```

### Token Lifecycle

| Token Type | Expiration | Storage Recommendation |
|------------|------------|------------------------|
| Access Token | 15 minutes | Memory only |
| Refresh Token | 7 days | HttpOnly cookie or secure storage |

---

## Auth Service

**Base Path:** `/api/auth`

### Endpoints

#### `GET /api/auth/42`
Initiates OAuth 2.0 flow with 42 Intra.

**Response:** Redirects to 42's authorization page.

**Frontend Usage:**
```typescript
// Redirect user to this URL
window.location.href = '/api/auth/42';
```

---

#### `GET /api/auth/42/callback`
OAuth callback handler. **Do not call directly** - 42 redirects here.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `code` | string | Authorization code from 42 |
| `state` | string | CSRF protection state |

**Success Response:** Redirects to frontend with tokens in URL hash.

---

#### `POST /api/auth/token/refresh`
Refresh access token using refresh token.

**Request Body:**
```typescript
{
  refreshToken: string;
}
```

**Response (200):**
```typescript
{
  accessToken: string;
  refreshToken: string;  // New refresh token (rotation)
  expiresIn: number;     // Seconds until expiration
}
```

**Errors:**
- `401` - Invalid or expired refresh token

---

#### `POST /api/auth/logout`
🔐 **Requires Authentication**

Invalidates current tokens.

**Request Body:**
```typescript
{
  refreshToken?: string;  // Optional: also revoke refresh token
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"Logged out successfully";
}
```

---

### 2FA Endpoints

#### `POST /api/auth/2fa/setup`
🔐 **Requires Authentication**

Generate TOTP secret and QR code for 2FA setup.

**Response (200):**
```typescript
{
  secret: string;      // Base32 encoded secret (for manual entry)
  qrCode: string;      // Data URL of QR code image
  backupCodes: string[]; // One-time backup codes (save these!)
}
```

---

#### `POST /api/auth/2fa/verify`
🔐 **Requires Authentication**

Verify TOTP code and enable 2FA.

**Request Body:**
```typescript
{
  code: string;  // 6-digit TOTP code
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"2FA enabled successfully";
}
```

**Errors:**
- `400` - Invalid code format
- `401` - Incorrect code

---

#### `POST /api/auth/2fa/validate`
Validate 2FA code during login.

**Request Body:**
```typescript
{
  userId: string;
  code: string;
}
```

**Response (200):**
```typescript
{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

---

#### `DELETE /api/auth/2fa/disable`
🔐 **Requires Authentication**

Disable 2FA for account.

**Request Body:**
```typescript
{
  code: string;  // Current valid TOTP code to confirm
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"2FA disabled";
}
```

---

## User Service

**Base Path:** `/api/user`

### Profile Endpoints

#### `GET /api/user/me`
🔐 **Requires Authentication**

Get current user's profile.

**Response (200):**
```typescript
{
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  level: number;
  totalXP: number;
  twoFactorEnabled: boolean;
  createdAt: string;  // ISO date
}
```

---

#### `PUT /api/user/me`
🔐 **Requires Authentication**

Update current user's profile.

**Request Body:**
```typescript
{
  displayName?: string;  // Max 64 chars
  avatarUrl?: string;    // Valid URL
}
```

**Response (200):**
```typescript
{
  success: true;
  user: {/* Updated user object */}
}
```

---

#### `GET /api/user/:userId`
🔐 **Requires Authentication**

Get another user's public profile.

**Response (200):**
```typescript
{
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  // Note: No email or sensitive data
}
```

---

### Friends Endpoints

#### `GET /api/user/friends`
🔐 **Requires Authentication**

Get current user's friends list.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | `ACCEPTED` | Filter: `PENDING`, `ACCEPTED`, `BLOCKED` |

**Response (200):**
```typescript
{
  friends: Array<{
    odId: string;
    odDisplayName: string;
    avatarUrl: string | null;
    level: number;
    status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
    isOnline: boolean;
    createdAt: string;
 }>;
}
```

---

#### `POST /api/user/friends/request`
🔐 **Requires Authentication**

Send friend request.

**Request Body:**
```typescript
{
  targetUserId: string;
}
```

**Response (201):**
```typescript
{
  success: true;
  message:	"Friend request sent";
}
```

**Errors:**
- `400` - Cannot add yourself
- `409` - Request already exists

---

#### `POST /api/user/friends/accept`
🔐 **Requires Authentication**

Accept pending friend request.

**Request Body:**
```typescript
{
  requesterId: string;  // User who sent the request
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"Friend request accepted";
}
```

---

#### `POST /api/user/friends/reject`
🔐 **Requires Authentication**

Reject/delete friend request or friendship.

**Request Body:**
```typescript
{
  targetUserId: string;
}
```

**Response (200):**
```typescript
{
  success: true;
}
```

---

#### `POST /api/user/friends/block`
🔐 **Requires Authentication**

Block a user.

**Request Body:**
```typescript
{
  targetUserId: string;
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"User blocked";
}
```

---

### Settings Endpoints

#### `GET /api/user/settings`
🔐 **Requires Authentication**

Get user settings.

**Response (200):**
```typescript
{
  avatar: string | null;
  colour: string | null;      // Theme color preference
  locale: string;             // e.g., 'en', 'fr'
  notifications: {
    email: boolean;
    push: boolean;
    friendRequests: boolean;
    sessionInvites: boolean;
 };
}
```

---

#### `PUT /api/user/settings`
🔐 **Requires Authentication**

Update user settings.

**Request Body:**
```typescript
{
  colour?: string;
  locale?: string;
  notifications?: {
    email?: boolean;
    push?: boolean;
    friendRequests?: boolean;
    sessionInvites?: boolean;
 };
}
```

**Response (200):**
```typescript
{
  success: true;
  settings: {/* Updated settings */}
}
```

---

### GDPR Endpoints

#### `GET /api/user/gdpr/export`
🔐 **Requires Authentication**

Export all user data (GDPR compliance).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | string | `json` | Export format: `json` or `csv` |

**Response (200):** File download with all user data.

---

#### `DELETE /api/user/gdpr/delete`
🔐 **Requires Authentication**

Permanently delete account and all data.

**Request Body:**
```typescript
{
  confirmation: "DELETE MY ACCOUNT";  // Must match exactly
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"Account scheduled for deletion";
}
```

---

## Game Service

**Base Path:** `/api/game`

### Session Endpoints

#### `POST /api/game/session/start`
🔐 **Requires Authentication**

Start a new game session.

**Request Body:**
```typescript
{
  patientId: string;      // Must be current user's ID
  mode: 'AI' | 'P2P';     // AI doctor or player vs player
  scenarioId?: string;    // Optional: specific scenario
}
```

**Response (200):**
```typescript
{
  sessionId: string;      // UUID for the session
  wsUrl: string;          // WebSocket URL to connect
}
```

**Example:**
```typescript
const response = await fetch('/api/game/session/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
 },
  body: JSON.stringify({
    patientId: userId,
    mode: 'AI'
 })
});
const {sessionId, wsUrl} = await response.json();
// Connect to WebSocket at wsUrl
```

---

#### `GET /api/game/session/:sessionId`
🔐 **Requires Authentication**

Get current session state.

**Response (200):**
```typescript
{
  state: IInvestigationState;  // See TypeScript Types section
}
```

---

#### `GET /api/game/session/:sessionId/history`
🔐 **Requires Authentication**

Get session event history (for replay).

**Response (200):**
```typescript
{
  sessionId: string;
  events: GameEvent[];      // All events in chronological order
  finalState: IInvestigationState;
}
```

---

#### `POST /api/game/session/:sessionId/surrender`
🔐 **Requires Authentication** 

End session early (patient gives up).

**Request Body:**
```typescript
{
  reason?: string;  // Optional reason
}
```

**Response (200):**
```typescript
{
  success: true;
  message:	"Session ended";
}
```

---

#### `GET /api/game/session/active`
🔐 **Requires Authentication**

List user's active sessions.

**Response (200):**
```typescript
{
  sessions: Array<{
    sessionId: string;
    mode: 'AI' | 'P2P';
    status: 'WAITING' | 'ACTIVE' | 'PAUSED';
    createdAt: string;
 }>;
}
```

---

### Scenario Endpoints

#### `GET /api/game/scenarios`
🔐 **Requires Authentication**

List all available scenarios.

**Response (200):**
```typescript
{
  scenarios: Array<{
    id: string;
    title: string;
    description: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
    estimatedDuration: number;  // Minutes
 }>;
}
```

---

#### `GET /api/game/scenarios/:id`
🔐 **Requires Authentication**

Get scenario details.

**Response (200):**
```typescript
{
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedDuration: number;
  graphData: IScenarioGraph;      // Narrative branching structure
  initialState: IScenarioInitialState;
}
```

---

#### `GET /api/game/scenarios/:id/stats`
🔐 **Requires Authentication**

Get scenario statistics.

**Response (200):**
```typescript
{
  scenarioId: string;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;        // Percentage
  averageDuration: number | null; // Seconds
  averageMetrics: {
    trust: string | null;
    compliance: string | null;
 };
}
```

---

#### `GET /api/game/scenarios/:id/leaderboard`
🔐 **Requires Authentication**

Get scenario leaderboard.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 10 | Max entries (max 100) |

**Response (200):**
```typescript
{
  scenarioId: string;
  leaderboard: Array<{
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    metrics: {trust, stress, compliance};
    duration: number;
    completedAt: string;
 }>;
}
```

---

## Gamification Service

**Base Path:** `/api/gamification`

### XP Endpoints

#### `GET /api/gamification/xp/me`
🔐 **Requires Authentication**

Get current user's XP summary.

**Response (200):**
```typescript
{
  userId: string;
  totalXP: number;
  level: number;
  xpToNextLevel: number;    // XP needed to level up
  xpProgress: number;       // 0-100 percentage
}
```

---

#### `GET /api/gamification/xp/history`
🔐 **Requires Authentication**

Get XP transaction history.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max entries (max 100) |
| `offset` | number | 0 | Pagination offset |

**Response (200):**
```typescript
{
  history: Array<{
    id: string;
    amount: number;
    reason: string;
    sessionId: string | null;
    createdAt: string;
 }>;
}
```

---

#### `GET /api/gamification/xp/daily`
🔐 **Requires Authentication**

Get daily XP breakdown for charts.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | number | 30 | Days to include (max 365) |

**Response (200):**
```typescript
{
  dailyXP: Array<{
    date: string;     // YYYY-MM-DD
    amount: number;
 }>;
}
```

---

### Achievement Endpoints

#### `GET /api/gamification/achievements`
🔐 **Requires Authentication**

List all achievements.

**Response (200):**
```typescript
{
  achievements: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    iconUrl: string | null;
    xpReward: number;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    category: string;
 }>;
}
```

---

#### `GET /api/gamification/achievements/me`
🔐 **Requires Authentication**

Get current user's unlocked achievements.

**Response (200):**
```typescript
{
  unlocked: Array<{
    achievementId: string;
    achievement: IAchievement;
    unlockedAt: string;
    progress: number;
 }>;
  unlockedCount: number;
  totalCount: number;
  completionPercentage: number;
}
```

---

#### `GET /api/gamification/achievements/:id`
🔐 **Requires Authentication**

Get specific achievement details with user progress.

**Response (200):**
```typescript
{
  achievement: IAchievement;
  isUnlocked: boolean;
  unlockedAt: string | null;
  progress: {
    progress: number;
    total: number;
    percentage: number;
 } | null;
}
```

---

#### `GET /api/gamification/achievements/progress`
🔐 **Requires Authentication**

Get progress for all achievements.

**Response (200):**
```typescript
{
  progress: Array<{
    achievementId: string;
    name: string;
    isUnlocked: boolean;
    progress: number | null;  // 0-100 or null if not trackable
 }>;
}
```

---

### Leaderboard Endpoints

#### `GET /api/gamification/leaderboard`
🔐 **Requires Authentication**

Get global leaderboard.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | `XP` | Type: `XP`, `LEVEL`, `SESSIONS`, `ACHIEVEMENTS` |
| `limit` | number | 100 | Max entries (max 500) |
| `offset` | number | 0 | Pagination offset |

**Response (200):**
```typescript
{
  type: string;
  entries: Array<{
    rank: number;
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
    totalXP: number;
    score: number;  // Value for the leaderboard type
 }>;
  total: number;
  userRank: number;  // Current user's rank
}
```

---

#### `GET /api/gamification/leaderboard/friends`
🔐 **Requires Authentication**

Get leaderboard among friends.

**Response (200):**
```typescript
{
  entries: Array<ILeaderboardEntry>;
  total: number;
}
```

---

#### `GET /api/gamification/leaderboard/me`
🔐 **Requires Authentication**

Get user's rank and surrounding players.

**Response (200):**
```typescript
{
  type: string;
  userRank: number;
  surroundingPlayers: Array<ILeaderboardEntry>;
}
```

---

## WebSocket Protocol

**Connection URL:** `wss://localhost/ws/game?token=<jwt>&sessionId=<uuid>`

### Connection Flow

```typescript
// 1. Start session via REST
const {sessionId, wsUrl} = await startSession();

// 2. Connect WebSocket
const ws = new WebSocket(`wss://localhost${wsUrl}&token=${accessToken}`);

// 3. Handle events
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleGameEvent(message);
};
```

### Message Types

#### Server → Client

```typescript
// State sync (sent periodically and after state changes)
{
  type: 'STATE_SYNC';
  payload: IInvestigationState;
}

// Player action acknowledgment
{
  type: 'ACK';
  payload: {
    sequenceId: number;
    success: boolean;
 };
}

// Error
{
  type: 'ERROR';
  payload: {
    code: string;
    message:	string;
 };
}

// Session ended
{
  type: 'SESSION_END';
  payload: {
    reason: string;
    finalState: IInvestigationState;
 };
}
```

#### Client → Server

```typescript
// Player action (dialogue choice, item interaction, etc.)
{
  type: 'ACTION';
  payload: {
    actionType: 'DIALOGUE_CHOICE' | 'ITEM_USE' | 'ITEM_EXAMINE';
    targetId: string;  // Choice ID or item ID
    data?: Record<string, unknown>;
 };
}

// Heartbeat (send every 5 seconds)
{
  type: 'PING';
}

// Activity update
{
  type: 'ACTIVITY';
  payload: {
    activity: 'IDLE' | 'TYPING' | 'READING' | 'INTERACTING';
 };
}
```

### Spectator Mode

Spectators connect with:
```
wss://localhost/ws/game?token=<jwt>&sessionId=<uuid>&spectate=true
```

Spectators receive `STATE_SYNC` messages but cannot send actions.

---

## Error Handling

All errors follow this format:

```typescript
{
  statusCode:	number;
  error:		string;      // Error type
  message:	string;    // Human-readable message
}
```

### Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request | Check request body/params |
| 401 | Unauthorized | Refresh token or re-login |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limited - wait and retry |
| 500 | Server Error | Report to backend team |

### Token Refresh Flow

```typescript
// Interceptor example
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const newTokens = await refreshToken();
      error.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
      return axios.request(error.config);
   }
    throw error;
 }
);
```

---

## TypeScript Types

Import from `@speak-up/shared`:

```typescript
import type {
  // Auth
  IAuthResponse,
  ITokenPayload,
  
  // User
  IUserProfile,
  IFriend,
  IUserSettings,
  
  // Game State
  IInvestigationState,
  IInventoryItem,
  IParticipantState,
  
  // Events
  GameEvent,
  EventType,
  
  // Scenarios
  IScenario,
  IScenarioGraph,
  IScenarioNode,
  IDialogueChoice,
  
  // Gamification
  IAchievement,
  IUserAchievement,
  IUserXP,
  ILeaderboardEntry,
  LeaderboardType,
} from '@speak-up/shared';
```

### Key Interfaces

```typescript
interface IInvestigationState {
  sessionId: string;
  sequenceId: number;
  lastUpdateTimestamp: number;
  status: 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED';
  
  metrics: {
    trust: number;      // 0-1, higher is better
    stress: number;     // 0-1, lower is better (>1 = loss)
    compliance: number; // 0-1, higher is better
    mood: 'CALM' | 'ANXIOUS' | 'DEFENSIVE' | 'BREAKTHROUGH';
 };
  
  actionNodeId: string;  // Current dialogue node
  narrativeFlags: Record<string, boolean>;
  inventory: IInventoryItem[];
  
  participants: {
    patient: IParticipantState;
    doctor: IParticipantState;
 };
}
```

---

## Quick Start Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {'Content-Type': 'application/json'}
});

// Set token after login
api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Get profile
const {data: profile} = await api.get('/user/me');

// Start game session
const {data: {sessionId, wsUrl}} = await api.post('/game/session/start', {
  patientId: profile.userId,
  mode: 'AI'
});

// Connect WebSocket
const ws = new WebSocket(`wss://${window.location.host}${wsUrl}&token=${token}`);

// Get achievements
const {data: achievements} = await api.get('/gamification/achievements/me');
```

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth | 10 requests | 1 minute |
| User | 100 requests | 1 minute |
| Game | 200 requests | 1 minute |
| Gamification | 100 requests | 1 minute |

---

## Health Checks

Each service exposes `/health`:

```bash
curl http://localhost:3001/health  # Auth
curl http://localhost:3002/health  # User
curl http://localhost:3003/health  # Game
curl http://localhost:3004/health  # Gamification
```

Response:
```json
{
  "status": "healthy",
  "service": "auth-service",
  "timestamp": "2025-12-25T12:00:00.000Z",
  "uptime": 3600
}
```
