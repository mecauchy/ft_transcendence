

| Module Area | Requirement | Status | Type | Notes |
|-------------|-------------|--------|------|-------|
| **IV.1 Web** | Use a frontend framework (React, Vue, etc.) | ☑️ | Minor | React (front) |
|  | Use a backend framework (Fastify, etc.) | ☑️ | Minor | Fastify (backend) |
|  | Real-time features (WebSockets, etc.) | ⬜ | Major | WebSocket infra exists in gateway, needs frontend connection |
|  | User interaction (chat, profile, friends) | ⬜ | Major | Backend complete, needs Chat UI + profile view UI |
|  | Public API (secured, documented, 5+ endpoints) | ☑️ | Major | /api/* endpoints, docs in docs/ |
|  | Use an ORM | ☑️ | Minor | Prisma |
|  | Notification system | ☑️ | Minor | Full flow: backend + frontend dropdown with bell badge |
|  | Custom design system (10+ components) | ☑️ | Minor | Many reusable React components |
|  | File upload/management | ⬜ | Minor | Backend avatar upload exists, needs full UI |
| **IV.2 Accessibility & i18n** | Multiple languages (3+) | ☑️ | Minor | EN/FR/ES complete with language switcher |
|  | Additional browser support | ☑️ | Minor | Chrome, Firefox, Edge tested |
| **IV.3 User Management** | User management/authentication | ⬜ | Major | Backend complete, needs avatar upload UI + online status display |
|  | Game stats & match history | ☑️ | Minor | Pong leaderboard + history endpoints + frontend display |
|  | OAuth 2.0 (Google, GitHub, 42) | ☑️ | Minor | 42 OAuth working |
|  | 2FA (Two-Factor Auth) | ☑️ | Minor | Full flow: setup QR + verify + login + settings toggle |
| **IV.4 Artificial Intelligence** | AI Opponent for games | ☑️ | Major | Game AI present with 3 difficulty levels |
| **IV.5 Cybersecurity** | WAF/ModSecurity + Vault | ☑️ | Major | WAF and Vault configured |
| **IV.6 Gaming & UX** | Complete web-based game | ☑️ | Major | Pong game with AI + local multiplayer |
|  | Advanced chat features | ⬜ | Minor | Block users exists, needs typing indicators/read receipts |
|  | Gamification (achievements, XP, etc.) | ⬜ | Minor | Backend complete, needs frontend display |
| **IV.7 Devops** | Monitoring (Prometheus, Grafana) | ☑️ | Major | Prometheus, Grafana in infra/monitoring |
|  | Microservices backend | ☑️ | Major | Multiple backend services |
|  | Health check/status page | ☑️ | Minor | Health endpoints, status checks |
| **IV.8 Data & Analytics** | Data export/import | ☑️ | Minor | GDPR export (JSON/CSV/XML) + import with progress UI |
|  | GDPR compliance | ☑️ | Minor | Full flow: export + delete account + import with settings UI |

---

### **Points Calculation**
- **Major:** 2 points each
- **Minor:** 1 point each

#### **Current points (fully complete):**

- Major modules completed: 6 × 2 = **12**
- Minor modules completed: 13 × 1 = **13**
- **Total: 25 points**

#### **Aimed points:**
- Major modules: 9 × 2 = **18** (add User Management, User Interaction, Websocket)
- Minor modules: 16 × 1 = **16**
- **Potential Total: 34 points**

