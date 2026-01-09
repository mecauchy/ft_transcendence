# 🎮 ft_transcendence

> A real-time multiplayer web application featuring classic Pong gameplay with modern social features, built as the final project of the 42 Common Core curriculum.

![42 Badge](https://img.shields.io/badge/42-Project-000000?style=flat&logo=42&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat&logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Team & Roles](#-team--roles)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Module Implementation](#-module-implementation)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Contributing](#-contributing)

---

## 🎯 Overview

ft_transcendence is a full-stack web application that brings the classic Pong game to life with modern multiplayer features. Players can compete in real-time matches, chat with friends, track their statistics, and climb the global leaderboards. The platform emphasizes security, scalability, and user experience.

### Key Highlights

- **Real-time Multiplayer Gaming**: Play Pong against AI or challenge friends online
- **Social Platform**: Chat system with friends, notifications, and user profiles  
- **Gamification**: XP system, achievements, and global leaderboards
- **Enterprise Security**: WAF protection, HashiCorp Vault secrets management, 2FA
- **Microservices Architecture**: Scalable backend with 5 independent services

---

## ✨ Features

### 🎮 Gaming
- Classic Pong with smooth physics and responsive controls
- Three AI difficulty levels (Easy, Medium, Hard)
- Real-time multiplayer matches
- Match history and statistics tracking
- Game customization options

### 💬 Social
- Real-time chat with typing indicators
- Friends system with online status
- User profiles with avatars
- Block/unblock users
- Game invitations from chat

### 🏆 Gamification
- XP and level progression system
- 20+ unlockable achievements
- Global leaderboards
- Daily challenges

### 🔐 Security
- Two-Factor Authentication (TOTP)
- OAuth 2.0 (42 Intra)
- WAF/ModSecurity protection
- HashiCorp Vault secrets management
- HTTPS everywhere

### 📊 Analytics
- Match history and statistics
- Data export (JSON/CSV/XML)
- GDPR compliance tools
- Prometheus metrics & Grafana dashboards

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework |
| **TypeScript** | Type Safety |
| **TailwindCSS** | Styling |
| **Phaser.js** | Game Engine |
| **Vite** | Build Tool |
| **i18next** | Internationalization (EN/FR/ES) |

### Backend
| Technology | Purpose |
|------------|---------|
| **Fastify 5** | HTTP Framework |
| **TypeScript** | Type Safety |
| **PostgreSQL 15** | Database |
| **Prisma** | ORM |
| **Redis** | Caching & Pub/Sub |
| **WebSocket** | Real-time Communication |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Nginx** | Reverse Proxy |
| **ModSecurity** | Web Application Firewall |
| **HashiCorp Vault** | Secrets Management |
| **Prometheus** | Metrics Collection |
| **Grafana** | Monitoring Dashboards |
| **Uptime Kuma** | Health Monitoring |

---

## 👥 Team & Roles

Our team of 4 developers from 42 Paris, each bringing specialized expertise:

| Member | GitHub | Role | Responsibilities |
|--------|--------|------|------------------|
| **Melissa Cauchy** | [@mecauchy](https://github.com/mecauchy) | DevOps Lead | Docker orchestration, CI/CD, Prometheus/Grafana monitoring, infrastructure automation |
| **Maxime Cauchy** | [@maxime-c16](https://github.com/maxime-c16) | DevSecOps Lead | WAF/ModSecurity, HashiCorp Vault, security hardening, SSL/TLS configuration |
| **Leny Garcia** | [@lewwny](https://github.com/lewwny) | Frontend Lead | React components, game UI, responsive design, i18n implementation |
| **Omar Ben Hamza** | [@floppy727](https://github.com/floppy727) | Backend Lead | Microservices, database design, API development, WebSocket implementation |

### Role Distribution (4-member team)
- **Product Owner**: Omar Ben Hamza - Feature prioritization, backlog management
- **Scrum Master**: Melissa Cauchy - Sprint planning, team coordination
- **Technical Lead**: Maxime Cauchy - Architecture decisions, security reviews
- **Developers**: All team members contribute to implementation

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         WAF (ModSecurity)                       │
│                      HTTPS Termination + OWASP CRS              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                       API Gateway                               │
│              Route handling, JWT validation, WebSocket          │
└──────┬──────────┬──────────┬──────────┬────────────────────────┘
       │          │          │          │
┌──────▼───┐ ┌────▼────┐ ┌───▼────┐ ┌───▼───────────┐
│  Auth    │ │  User   │ │  Game  │ │ Gamification  │
│ Service  │ │ Service │ │Service │ │   Service     │
└────┬─────┘ └────┬────┘ └───┬────┘ └───────┬───────┘
     │            │          │              │
     └────────────┴──────────┴──────────────┘
                          │
              ┌───────────▼────────────┐
              │      PostgreSQL        │
              │   (Multi-database)     │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │         Redis          │
              │  (Cache, Pub/Sub)      │
              └────────────────────────┘
```

### Service Breakdown

| Service | Port | Description |
|---------|------|-------------|
| **frontend** | 8443 | React SPA served via HTTPS |
| **api-gateway** | 3000 | Central API router, WebSocket hub |
| **auth-service** | 3001 | Authentication, OAuth, 2FA |
| **user-service** | 3002 | Profile, friends, notifications |
| **game-service** | 3003 | Match management, statistics |
| **gamification-service** | 3004 | XP, achievements, leaderboards |

---

## 🚀 Quick Start

### Prerequisites
- **Docker** & **Docker Compose** (v2.0+)
- **Node.js** 20+ and **pnpm** (auto-installed via Makefile)
- **Git**
- Modern web browser (Chrome recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-team/ft_transcendence.git
cd ft_transcendence

# Start everything with a single command
make setup
```

That's it! The Makefile handles:
- ✅ NVM installation and Node.js setup
- ✅ pnpm installation
- ✅ SSL certificate generation
- ✅ Environment configuration
- ✅ Docker container orchestration
- ✅ Database initialization

### Access the Application

Once setup completes:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | https://localhost:8443 | Register a new account |
| **Grafana** | https://localhost:8443/grafana | See `make show-creds` |
| **API Docs** | [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | - |

### Development Commands

```bash
# View all available commands
make help

# Start development environment
make dev

# Run tests
make test

# View logs
make logs

# Stop all services
make stop

# Clean up everything
make clean

# Show credentials
make show-creds
```

---

## 📊 Module Implementation

Our project implements **35 points** worth of modules (14 required for completion).

### Major Modules (9 × 2 = 18 points)

| # | Module | Category | Implementation |
|---|--------|----------|----------------|
| 1 | Frontend + Backend Framework | Web | React 19 + Fastify 5 |
| 2 | Real-time WebSocket | Web | `@fastify/websocket`, Redis pub/sub |
| 3 | User Interaction | Web | Chat, friends, profiles, blocking |
| 4 | Public API (5+ endpoints) | Web | 39+ documented REST endpoints |
| 5 | Standard User Management | User | Profile editing, avatars, online status |
| 6 | WAF/ModSecurity + Vault | Security | OWASP CRS, HashiCorp Vault |
| 7 | Prometheus + Grafana | DevOps | Full monitoring stack with alerts |
| 8 | Backend Microservices | DevOps | 5 independent services |
| 9 | Web-based Game | Gaming | Pong with AI opponent |

### Minor Modules (17 × 1 = 17 points)

| # | Module | Category | Implementation |
|---|--------|----------|----------------|
| 1 | ORM (Prisma) | Web | 430+ line schema |
| 2 | Notification System | Web | 6 notification types, real-time updates |
| 3 | Custom Design System | Web | 10+ reusable components |
| 4 | File Upload | Web | Avatar upload with validation |
| 5 | Multiple Languages (3+) | i18n | English, French, Spanish |
| 6 | Additional Browser Support | i18n | Chrome, Firefox, Safari |
| 7 | Game Statistics | User | Leaderboards, match history |
| 8 | OAuth 2.0 | User | 42 Intra authentication |
| 9 | 2FA (TOTP) | User | QR code setup, verification |
| 10 | AI Opponent | Gaming | 3 difficulty levels |
| 11 | Advanced Chat | Gaming | Typing indicators, game invites |
| 12 | Gamification | Gaming | XP, achievements, leaderboards |
| 13 | Game Customization | Gaming | Themes, power-ups |
| 14 | Health Check/Status | DevOps | Uptime Kuma monitoring |
| 15 | Data Export/Import | Data | JSON, CSV, XML formats |
| 16 | GDPR Compliance | Data | Data export, deletion, consent |
| 17 | AI Opponent (Extended) | AI | Adaptive difficulty |

---

## 📚 API Documentation

Our API provides 39+ endpoints across 5 services. Full documentation available at:
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)
- [docs/BACKEND_API.md](docs/BACKEND_API.md)

### Quick Reference

```bash
# Authentication
POST   /api/auth/register          # Create account
POST   /api/auth/login             # Login with credentials
GET    /api/auth/42                # OAuth with 42
POST   /api/auth/2fa/setup         # Enable 2FA
POST   /api/auth/2fa/verify        # Verify 2FA code

# Users
GET    /api/users/profile          # Get own profile
PUT    /api/users/profile          # Update profile
POST   /api/users/avatar           # Upload avatar
GET    /api/users/:id              # Get user by ID

# Friends
GET    /api/users/friends          # List friends
POST   /api/users/friends/:id      # Send friend request
DELETE /api/users/friends/:id      # Remove friend

# Games
POST   /api/games/create           # Create match
GET    /api/games/history          # Match history
GET    /api/games/leaderboard      # Rankings

# Chat
GET    /api/chat/conversations     # List conversations
POST   /api/chat/messages          # Send message
```

---

## 🔒 Security

### Security Features
- **WAF/ModSecurity**: OWASP Core Rule Set blocks common attacks (SQLi, XSS, etc.)
- **HashiCorp Vault**: Centralized secrets management with role-based access
- **2FA (TOTP)**: Time-based one-time passwords with QR code setup
- **JWT Authentication**: Short-lived access tokens with refresh token rotation
- **HTTPS Everywhere**: TLS 1.2/1.3 with auto-generated certificates
- **Password Security**: bcrypt hashing with salt
- **Input Validation**: Frontend and backend validation on all inputs
- **Rate Limiting**: API rate limiting via WAF rules

### Environment Variables

Copy the example file and configure your secrets:

```bash
cp .env.example .env
```

> ⚠️ Never commit `.env` files to version control!

---

## 📝 Legal

The application includes mandatory legal pages accessible from the footer:

- **Privacy Policy**: `/privacy` - Data collection and usage policies
- **Terms of Service**: `/terms` - User agreement and rules

---

## 🧪 Testing

```bash
# Run all tests
make test

# Run specific service tests
cd packages/backend/auth-service && pnpm test

# Run frontend tests
cd packages/front && pnpm test

# Audit script
make audit
```

---

## 🤝 Contributing

This is a 42 school project with a fixed team. However, issues and suggestions are welcome!

### Git Workflow

1. Branch from `dev`
2. Use meaningful commit messages
3. Create PR to `dev`
4. Require at least one review
5. Merge to `main` for releases

### Commit Convention

```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes
refactor: Code refactoring
test: Add tests
chore: Build/config changes
```

---

## 📄 License

This project is part of the 42 school curriculum. All rights reserved.

---

## 🙏 Acknowledgments

- **42 School** for the project framework and evaluation criteria
- **Phaser.js** community for game development resources
- All open-source libraries and tools that made this project possible

---

<p align="center">
  Made with ❤️ by Team ft_transcendence @ 42 Paris
</p>
