
WebSocket gateway (chat + game):
-Authenticate WS connection (JWT in header or query token).
-Implement rooms (per conversation, per session/game).
-Broadcast events to room members only.
-Connection lifecycle
-Presence tracking (ONLINE/OFFLINE/RECONNECTING) in Redis (or memory if single instance, but microservices usually needs Redis).
-Heartbeat/ping + timeout.
-Reconnect: client resync flow (send last known sequence id → server sends missed events or full state).
-Ordering / concurrency
-For narrative/game sessions: enforce sequence_id monotonic insert in event_logs (transaction + unique constraint).
-Persistence hooks
-Store chat messages to DB.
-Store relevant game/session events to event_logs.


-Profile
-GET /users/:id public profile endpoint (safe fields only).
-GET /users/me full profile.
-Ensure role-based redaction (admin sees more).
-Friends
-Fix your schema FKs (users(id) → users(user_id)).
-Implement endpoints:
-request friend
-accept/decline
-remove
-block/unblock
-list friends (+ status)
-Prevent duplicates + inverse duplicates (enforce in code or schema).
-Chat
-DB: conversations + members + messages (unless already present).
-Endpoints for history pagination.
-WS events for send/receive.



DB table notifications:
-id, user_id, type, payload, created_at, read_at
-Trigger notifications on all create/update/delete that matter:
-friend request created/accepted/removed/blocked
-message created/deleted/edited
-org created/updated/member added/removed
-admin actions (role change, ban, etc.)
-Deliver via:
-REST GET /notifications
-REST POST /notifications/:id/read
-WS push notification:new


-Decide storage:
-local volume (docker) or object storage (S3-compatible) — either is fine
-Implement endpoints:
-POST/PUT /users/me/avatar (multipart)
-optional generic: POST /files for other documents/images
-GET /files/:id with access control
-DELETE /files/:id
-Validation:
-server-side MIME whitelist, size limit, file signature check if you want extra safety
-Security:
-only owner (or admin) can access/delete
-don’t allow path traversal
-DB:
-files table (id, owner_id, type, size, mime, url/path, created_at)


-Persist user locale (you already have settings_locale)
-Ensure backend returns locale in /users/me
-If you generate any server text (notification titles, system messages):
-return message keys + params (recommended), not hardcoded French


-Auth fully production-grade:
-register/login/refresh/logout
-hashed passwords + token storage/rotation
-Profile update endpoint:
-PATCH /users/me
-Avatar upload endpoint (ties into file upload module)
-Friends endpoints (ties into friends module)
-Online status:
-presence tracking in Redis
-friends list returns statuses


-DB schema + writes:
-record each match result
-update wins/losses/ranking/level/xp
-achievements unlocking logic
-Endpoints:
-GET /users/:id/stats
-GET /users/:id/matches?cursor=
-GET /leaderboard
-GET /users/:id/achievements
-Ensure integrity (no client-side cheating): server writes results.


-Endpoints:
-POST /auth/2fa/setup → returns QR/otpauth url + secret (store encrypted)
-POST /auth/2fa/enable (verify code then enable)
-POST /auth/2fa/verify (during login when requires2FA)
-POST /auth/2fa/disable (verify code/password)
-Storage:
-user_twofa_secret encrypted (Vault key), user_twofa_enabled
-Login flow:
-if enabled → issue partial token (requires2FA=true)
-then verify → issue full token


-Block messaging:
-reuse friends status BLOCKED or create blocks table
-enforce at send-time
-Invites:
-POST /chat/invite → creates notification + WS event
-“Game/tournament notifications in chat”:
-notification types + delivery
-Chat history persistence:
-ensure message DB + pagination exists
-Typing indicators:
-WS event typing:start/stop broadcast to room
-Read receipts:
-store last read message id per user in conversation_members
-WS event read:update


-Store customization per user or per match:
-game_settings table (theme, difficulty, controls, etc.)
-Validate + enforce server-side:
-prevent invalid/unfair settings in multiplayer
-Endpoint:
-GET/PUT /users/me/game-settings
-or attach settings during matchmaking/session start


-Implement three with clean rules:
-XP/Level system
-Achievements
-Leaderboard
-DB tables:
-user_xp, achievements, user_achievements, leaderboard_snapshots (optional)
-Events:
-on match completion or key actions update XP + unlock achievements
-Endpoints:
-GET /users/me/progression
-GET /users/me/achievements
-GET /leaderboard


-Export endpoints:
-GET /export/user-data.json
-GET /export/user-data.csv
-GET /export/user-data.xml
-Import endpoint:
-POST /import accepts JSON/CSV with schema validation
-Bulk insert/update with transactions
-Security:
-export only your own data (or admin)
-rate limit exports
-Include at least: profile, friends, messages, match history (whatever your project stores)


-Export buttons + download handling
-Import UI:
-upload file
-show validation errors
-success summary (rows imported)
-Minor — GDPR compliance ⬜
-Requirements: request data, delete data w/ confirmation, export readable data, confirmation emails.


-Endpoints:
-POST /gdpr/request-export (or immediate export)
-DELETE /users/me (hard delete user + cascade where appropriate)
-POST /gdpr/request-deletion + confirm token flow (recommended)
-Data handling rules:
-delete/anonymize linked records (sessions/event_logs can be anonymized)
-keep aggregate analytics without personal identifiers
-Confirmation email:
-send email on export request + deletion request + deletion completion
-store gdpr_requests table (type, status, created_at)
-Implement “readable export” (zip with JSON + CSV summary works great)


-Real-time WS layer + presence + rooms + reconnection + ordering
-Friends + chat persistence + notification triggers
-File upload endpoints + storage + ACL
-Full standard auth completion (refresh rotation + online status)
-2FA backend flow
-Advanced chat backend features (block/invite/read receipts)
-Game customization storage + validation
-Gamification logic + endpoints
-Export/import endpoints + validation
-GDPR deletion/anonymization + email confirmations

