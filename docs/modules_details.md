# Web

## Minor: Use a frontend framework (React, Vue, Angular, Svelte, etc.).
## Minor: Use a backend framework (Express, Fastify, NestJS, Django, etc.).
## Major: Implement real-time features using WebSockets or similar technology.
### Real-time updates across clients.
### Handle connection/disconnection gracefully.
### Efficient message broadcasting.
## Major: Allow users to interact with other users. The minimum requirements are:
### A basic chat system (send/receive messages between users).
### A profile system (view user information).
### A friends system (add/remove friends, see friends list).
## Major: A public API to interact with the database with a secured API key, rate
limiting, documentation, and at least 5 endpoints:
### GET /api/{something}
### POST /api/{something}
### PUT /api/{something}
### DELETE /api/{something}
## Minor: Use an ORM for the database.
## Minor: A complete notification system for all creation, update, and deletion actions.
## Minor: Custom-made design system with reusable components, including a proper
color palette, typography, and icons (minimum: 10 reusable components).
12
# Minor: File upload and management system.
### Support multiple file types (images, documents, etc.).
### Client-side and server-side validation (type, size, format).
### Secure file storage with proper access control.
### File preview functionality where applicable.
### Progress indicators for uploads.
### Ability to delete uploaded files.
## Minor: Support for multiple languages (at least 3 languages).
### Implement i18n (internationalization) system.
### At least 3 complete language translations.
### Language switcher in the UI.
### All user-facing text must be translatable.
## Minor: Support for additional browsers.
### Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge,
etc.).
### Test and fix all features in each browser.
### Document any browser-specific limitations.
### Consistent UI/UX across all supported browsers.
# User Management
# Major: Standard user management and authentication.
### Users can update their profile information.
### Users can upload an avatar (with a default avatar if none provided).
### Users can add other users as friends and see their online status.
### Users have a profile page displaying their information.
## Minor: Game statistics and match history (requires a game module).
### Track user game statistics (wins, losses, ranking, level, etc.).
### Display match history (1v1 games, dates, results, opponents).
### Show achievements and progression.
### Leaderboard integration.
This module requires you to have implemented at least one game (see
"Gaming and user experience" section). You cannot claim this module
without a functional game.
## Minor: Implement remote authentication with OAuth 2.0 (Google, GitHub, 42,
etc.).
## Minor: Implement a complete 2FA (Two-Factor Authentication) system for the
users.
# Artificial Intelligence
# Major: Introduce an AI Opponent for games.
### The AI must be challenging and able to win occasionally.
### The AI should simulate human-like behavior (not perfect play).
### If you implement game customization options, the AI must be able to use
them.
### You must be able to explain your AI implementation during evaluation.
This module requires you to have implemented at least one game (see
"Gaming and user experience" section). The AI must be able to play
your game competently.
# Cybersecurity
# Major: Implement WAF/ModSecurity (hardened) + HashiCorp Vault for secrets:
### Configure strict ModSecurity/WAF.
### Manage secrets in Vault (API keys, credentials, environment variables), encrypted and isolated.
# Gaming and user experience
# Major: Implement a complete web-based game where users can play against each
other.
### The game can be real-time multiplayer (e.g., Pong, Chess, Tic-Tac-Toe, Card
games, etc.).
### Players must be able to play live matches.
### The game must have clear rules and win/loss conditions.
### The game can be 2D or 3D.
## Major: Add another game with user history and matchmaking.
### Implement a second distinct game.
### Track user history and statistics for this game.
### Implement a matchmaking system.
### Maintain performance and responsiveness.
This module requires you to have already implemented a first game
(see "Implement a complete web-based game" module above). You cannot
claim this module without having a functional first game.
## Minor: Advanced chat features (enhances the basic chat from "User interaction"
module).
### Ability to block users from messaging you.
### Invite users to play games directly from chat.
### Game/tournament notifications in chat.
### Access to user profiles from chat interface.
### Chat history persistence.
### Typing indicators and read receipts.
This module enhances the basic chat system from the "Allow users
to interact" module. You cannot claim this module without having
implemented the basic chat first.
## Minor: A gamification system to reward users for their actions.
### Implement at least 3 of the following: achievements, badges, leaderboards,
XP/level system, daily challenges, rewards
### System must be persistent (stored in database)
### Visual feedback for users (notifications, progress bars, etc.)
### Clear rules and progression mechanics
While this is a Minor module (1 point), implementing a complete
gamification system can be substantial. Focus on quality over
quantity—three well-implemented features are better than six poorly
done ones.
## Major: Infrastructure for log management using ELK (Elasticsearch, Logstash,
## Major: Monitoring system with Prometheus and Grafana.
### Set up Prometheus to collect metrics.
### Configure exporters and integrations.
### Create custom Grafana dashboards.
### Set up alerting rules.
### Secure access to Grafana.
## Major: Backend as microservices.
### Design loosely-coupled services with clear interfaces.
### Use REST APIs or message queues for communication.
### Each service should have a single responsibility.
## Minor: Health check and status page system with automated backups and disaster
recovery procedures.
# Data and Analytics
# Minor: Data export and import functionality.
### Export data in multiple formats (JSON, CSV, XML, etc.).
### Import data with validation.
### Bulk operations support.
## Minor: GDPR compliance features.
### Allow users to request their data.
### Data deletion with confirmation.
### Export user data in a readable format.
### Confirmation emails for data operations.