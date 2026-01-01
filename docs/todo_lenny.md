# Frontend TODO - Lenny

## ✅ COMPLETED MODULES

### ✅ Minor — File upload/management (Avatar)
- ✅ Avatar upload UI with progress
- ✅ Preview before upload
- ✅ Client-side validation (size/type)
- ✅ Default avatar fallback

### ✅ Minor — 2FA UI
- ✅ Enable 2FA flow (QR display + code input)
- ✅ Login flow handles requires2FA
- ✅ Disable flow

### ✅ Minor — Data export/import UI
- ✅ Export buttons (JSON, CSV, XML) + download
- ✅ Import UI with file upload
- ✅ Validation error display
- ✅ Success summary

### ✅ Minor — GDPR compliance UI
- ✅ "Export my data" buttons
- ✅ "Delete my account" with confirmation modal
- ✅ Re-enter confirmation text + acknowledge checkbox

### ✅ Minor — Notification system UI
- ✅ Notification bell + unread count
- ✅ Notifications dropdown
- ✅ Mark as read UI
- ✅ Delete notifications
- ✅ Mark all as read

### ✅ Minor — Game stats & match history UI
- ✅ Match history list (Pong)
- ✅ Breathe history
- ✅ Stats display

## 🚧 HIGH PRIORITY - NEXT MODULES

### 1. Real-time Features (WebSockets) - RECOMMENDED NEXT
**Impact:** Unlocks chat, presence, live games
- TODO: Create WS client with token authentication
- TODO: Join relevant rooms (chat conv / game session)
- TODO: Listen for events (messages, state updates, notifications)
- TODO: Handle reconnect UI (show "reconnecting…" state)
- TODO: Trigger resync logic on reconnect

### 2. User Interaction (Chat/Profile/Friends)
**Impact:** Major social features
- TODO: Profile page consuming /users/me and /users/:id
- TODO: Friends list component
- TODO: Pending friend requests UI
- TODO: Add/remove/block actions
- TODO: Chat UI (list conversations + messages)
- TODO: WS hook for real-time messages

### 3. Advanced Chat Features
**Impact:** Enhances chat experience
- TODO: Typing indicator display
- TODO: Read receipts display
- TODO: Block user button
- TODO: Invite-to-play button from chat
- TODO: Profile quick view from chat
- TODO: Chat history scroll + pagination

## 📋 BACKLOG

### Profile Enhancement
- TODO: Avatar upload UI (DONE, but ensure it's integrated)
- TODO: Friends list + online badges
- TODO: Settings UI for profile edits (mostly done)

### Game Customization
- TODO: UI to change game settings + preview
- TODO: Send chosen settings to backend
- TODO: Apply in game rendering

### Gamification UI
- TODO: Progress bar / level display
- TODO: Achievements UI with unlock animations
- TODO: Leaderboard page

### Notification Enhancements
- TODO: Real-time toast/popups on WS events
- TODO: Notifications page/list (if not using dropdown)

## 🎯 IMMEDIATE ACTION

**Start with WebSocket client integration** - coordinate with backend (Omar) to ensure the WS gateway is ready. Once WebSocket is working:
1. Implement real-time notifications
2. Build chat UI with real-time messaging
3. Add friends system UI

## 🐛 KNOWN ISSUES TO FIX

After rebuilding containers (`make setup`), you need to:
1. Hard refresh browser (Ctrl+Shift+R) to clear JavaScript cache
2. All the recent fixes require container rebuild to take effect

The following issues are already FIXED in code but need rebuild:
- ✅ Avatar upload (changed to PUT /users/me/avatar)
- ✅ 2FA modal closing after enable
- ✅ Disable 2FA empty body error
- ✅ Delete account empty body error
- ✅ Notification actions empty body errors
