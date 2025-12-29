# IV.1 Web
## Major — Real-time features (WebSockets, etc.)
### Requirements: real-time updates, graceful connect/disconnect, efficient broadcasting.
#### Create WS client:
- Connect with token.
- Join relevant rooms (chat conv / game session).
- Listen for events: message/new state updates/notifications.
#### Handle reconnect UI:
- show “reconnecting…” state.
- trigger resync logic.


## Major — User interaction (chat/profile/friends)
### Requirements: chat + profile view + friends system.\
#### Build pages/components:
- Profile page consumes /users/me and /users/:id
- Friends list + pending requests + add/remove/block actions
- Chat UI (list convs + messages) + WS hook


## Minor — Notification system
### Requirement: notifications for all create/update/delete actions.
- Notification bell + unread count
- Notifications page/list
- Mark as read UI
- Real-time toast/popups on WS events


## Minor — File upload/management
### Requirements: multiple file types, validation, secure storage/access control, preview, progress, delete.
#### Upload UI with:
- file picker
- progress bar (XHR/axios or fetch streams)
- preview (image preview, doc icon)
- delete button
- Client-side validation to match server rules (size/type)


# IV.2 Accessibility & i18n
## Minor — Multiple languages (3+)
### Requirements: i18n system, 3 translations, switcher, all text translatable.
- Implement i18n library (react-i18next or similar)
- Provide full translations for FR/EN/ES
- Add language switcher
Replace hardcoded strings in UI with translation keys


# IV.3 User Management
## Major — Standard user management/authentication
### Requirements: profile update, avatar, friends + online status, profile page.
- Profile page displays real data (/users/me, /users/:id)
- Avatar upload UI + default avatar fallback
- Friends list + online badges
- Settings UI for profile edits


## Minor — Game stats & match history
### Requirements: stats, match history, achievements/progression, leaderboard integration.
#### Build pages:
- match history list
- stats summary
- leaderboard page
- achievements/progression visuals


## Minor — 2FA
### Requirement: complete 2FA system.
- enable 2FA flow (QR display + code input)
- login flow handles requires2FA
- disable flow


## Minor — Advanced chat features
### Requirements: block users, invite to play from chat, notifications in chat, access profiles, chat history persistence, typing + read receipts.
#### Chat UI features:
- typing indicator display
- read receipts display
- block user button
- invite-to-play button
- profile quick view from chat
- chat history scroll + pagination


## Minor — Game customization
### Requirement: customization options with defaults.
- UI to change settings + preview
- Send chosen settings to backend
- Apply in game rendering


## Minor — Gamification
### Requirement: at least 3 of achievements/badges/leaderboards/XP/daily challenges/rewards; persistent; clear rules; visual feedback.
- Progress bar / level display
- Achievements UI with unlock animations
- Leaderboard page


## Minor — Data export/import
### Requirements: export JSON/CSV/XML, import with validation, bulk operations.
- Export buttons + download handling
#### Import UI:
- upload file
- show validation errors
- success summary (rows imported)


## Minor — GDPR compliance
### Requirements: request data, delete data w/ confirmation, export readable data, confirmation emails.
#### Settings page section:
- “Request my data”
- “Export my data”
- “Delete my account”
- confirmation UI (modal + re-enter password or 2FA code)
- Show “email sent” confirmation state