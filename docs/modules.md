
| Module Area | Requirement | Status | Type | Notes |
|-------------|-------------|--------|------|-------|
| **IV.1 Web** | Use a frontend framework (React, Vue, etc.) | ☑️ | Minor | React (front) |
|  | Use a backend framework (Fastify, etc.) | ☑️ | Minor | Fastify (backend) |
|  | Real-time features (WebSockets, etc.) | ⬜ | Major | Game & chat use WebSockets, TO IMPLEMENT |
|  | User interaction (chat, profile, friends) | ⬜ | Major | Chat + profile + friends exist TO IMPLEMENT |
|  | Public API (secured, documented, 5+ endpoints) | ☑️ | Major | /api/* endpoints, docs in docs/ |
|  | Use an ORM | ☑️ | Minor | Prisma |
|  | Notification system | ⬜ | Minor | EXISTS, TO IMPLEMENT |
|  | Custom design system (10+ components) | ☑️ | Minor | Many reusable React components |
|  | File upload/management | ⬜ | Minor | Avatar upload + file validation infra exists, TO IMPLEMENT |
| **IV.2 Accessibility & i18n** | Multiple languages (3+) | ⬜ | Minor | TO IMPLEMENT |
|  | Additional browser support | ☑️ | Minor | Chrome, Firefox, Edge tested |
| **IV.3 User Management** | User management/authentication | ⬜ | Major | Register, login, profile DONE, avatar + friends TO IMPLEMENT |
|  | Game stats & match history | ⬜ | Minor | Game stats leaderboard match history in db, TO IMPLEMENT IN FRONT |
|  | OAuth 2.0 (Google, GitHub, 42) | ☑️ | Minor | 42 OAuth working |
|  | 2FA (Two-Factor Auth) | ⬜ | Minor | 2FA endpoints present, TO IMPLEMENT |
| **IV.4 Artificial Intelligence** | AI Opponent for games | ☑️ | Major | Game AI present |
| **IV.5 Cybersecurity** | WAF/ModSecurity + Vault | ☑️ | Major | WAF and Vault configured |
| **IV.6 Gaming & UX** | Complete web-based game | ☑️ | Major | Game module implemented |
|  | Advanced chat features | ⬜ | Minor | Block, invite, notifications, etc in back, TO IMPLEMENT IN FRONT |
|  | Game customization | ⬜ | Minor | TO IMPLEMENT |
|  | Gamification (achievements, XP, etc.) | ⬜ | Minor | Achievements, XP, leaderboard in db, TO IMPLEMENT IN FRONT|
| **IV.7 Devops** | Monitoring (Prometheus, Grafana) | ☑️ | Major | Prometheus, Grafana in infra/monitoring |
|  | Microservices backend | ☑️ | Major | Multiple backend services |
|  | Health check/status page | ☑️ | Minor | Health endpoints, status checks |
| **IV.8 Data & Analytics** | Data export/import | ⬜ | Minor | infra exists, TO IMPLEMENT |
|  | GDPR compliance | ⬜ | Minor | infra exists, TO IMPLEMENT |

---

### **Points Calculation**
- **Major:** 2 points each
- **Minor:** 1 point each

#### **Current points:**

- Major modules completed: 6 × 2 = **12**
- Minor modules completed: 7 × 1 = **7**
- **Total: 19 points**

#### **Targeted points:**
- Major modules completed: 9 × 2 = **18**
- Minor modules completed: 17 × 1 = **17**
- **Total: 35 points**
