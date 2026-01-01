# Backend TODO - Omar

## ✅ COMPLETED MODULES

### ✅ Major — Standard user management/authentication
- ✅ Auth fully production-grade: register/login/refresh/logout
- ✅ Hashed passwords + token storage/rotation
- ✅ Profile update endpoint: PATCH /users/me
- ✅ Avatar upload endpoint: PUT /users/me/avatar
- ✅ Online status: presence tracking ready (needs WebSocket integration)

### ✅ Minor — 2FA
- ✅ POST /auth/2fa/setup → returns QR/otpauth url + secret
- ✅ POST /auth/2fa/verify (during setup to enable)
- ✅ POST /auth/2fa/login (during login when requires2FA)
- ✅ POST /auth/2fa/disable
- ✅ Storage: user.twofaSecret encrypted, user.twofaEnabled
- ✅ Login flow: if enabled → returns requires2FA + userId, then /2fa/login issues full token

### ✅ Minor — Data export/import
- ✅ Export endpoints: GET /users/gdpr/export (JSON), /export/csv, /export/xml
- ✅ Import endpoint: POST /users/import with validation
- ✅ Security: export only your own data
- ✅ Includes: profile, settings, session history

### ✅ Minor — GDPR compliance
- ✅ DELETE /users/gdpr/delete (hard delete with cascade)
- ✅ Data handling: deletes user + settings + sessions + notifications
- ✅ Export in readable formats (JSON/CSV/XML)

### ✅ Minor — Notification system (backend)
- ✅ DB table: notifications
- ✅ REST GET /users/notifications with pagination
- ✅ REST GET /users/notifications/unread-count
- ✅ REST PUT /users/notifications/:id/read
- ✅ REST PUT /users/notifications/read-all
- ✅ REST DELETE /users/notifications/:id
- ✅ REST DELETE /users/notifications/all

### ✅ Minor — Game stats & match history
- ✅ DB schema: game results recording
- ✅ Endpoints: GET /game/pong/history, GET /game/breathe/history
- ✅ Pagination with cursor support

## 🚧 HIGH PRIORITY - NEXT MODULES

### 1. WebSocket Gateway (RECOMMENDED NEXT)
**Impact:** Enables real-time chat, presence, live games
- TODO: Authenticate WS connection (JWT)
- TODO: Implement rooms (per conversation, per game)
- TODO: Broadcast events to room members
- TODO: Presence tracking (ONLINE/OFFLINE/RECONNECTING) in Redis
- TODO: Heartbeat/ping + timeout
- TODO: Reconnect flow with resync
- TODO: Store chat messages to DB
- TODO: Store game events to event_logs

### 2. Friends System (EASY WIN)
**Impact:** Unlocks social features, enables chat
- TODO: POST /users/friends/request
- TODO: POST /users/friends/:id/accept
- TODO: POST /users/friends/:id/decline
- TODO: DELETE /users/friends/:id
- TODO: POST /users/friends/:id/block
- TODO: DELETE /users/friends/:id/unblock
- TODO: GET /users/friends (list with online status)
- TODO: Prevent duplicate friendships

### 3. Chat System
**Impact:** Major feature, builds on WebSocket + Friends
- TODO: DB: conversations + members + messages tables
- TODO: Endpoints for history pagination
- TODO: WS events for send/receive
- TODO: Block messaging enforcement
- TODO: Chat invites (POST /chat/invite)
- TODO: Typing indicators (WS)
- TODO: Read receipts

## 📋 BACKLOG

### Profile Enhancement
- TODO: GET /users/:id public profile endpoint (safe fields only)
- TODO: Role-based redaction (admin sees more)

### File Upload/Management
- TODO: Generic POST /files for documents/images
- TODO: GET /files/:id with access control
- TODO: DELETE /files/:id
- TODO: files table

### Game Customization
- TODO: game_settings table (theme, difficulty, controls)
- TODO: GET/PUT /users/me/game-settings
- TODO: Server-side validation

### Gamification
- TODO: XP/Level system
- TODO: Achievements system
- TODO: Leaderboard
- TODO: GET /users/me/progression, /achievements, /leaderboard

## 🎯 IMMEDIATE ACTION

**Build the WebSocket Gateway first** - it's the foundation for multiple major modules (chat, presence, real-time games).
