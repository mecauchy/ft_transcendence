.PHONY: help install build up down logs clean test lint format deploy health reset

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Project variables
PROJECT_NAME := ft_transcendence
DOCKER_COMPOSE_FILE := docker-compose.yml
DOCKER_COMPOSE_OVERRIDE := docker-compose.override.yml

# Get the absolute path to the project root
PROJECT_ROOT := $(shell pwd)

# Vault variables
VAULT_ADDR := http://localhost:8200
VAULT_TOKEN := root_token_dev_only

# PostgreSQL variables
POSTGRES_USER := root_admin
POSTGRES_HOST := localhost
POSTGRES_PORT := 5432

# Help target
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           $(PROJECT_NAME) - Makefile Commands                    ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)📦 Setup & Installation:$(NC)"
	@echo "  make install              - Install all dependencies"
	@echo "  make build                - Build Docker images"
	@echo ""
	@echo "$(GREEN)🚀 Runtime:$(NC)"
	@echo "  make up                   - Start all containers (detached)"
	@echo "  make up-debug             - Start containers with live logs"
	@echo "  make down                 - Stop all containers"
	@echo "  make restart              - Restart all containers"
	@echo "  make ps                   - Show running containers"
	@echo ""
	@echo "$(GREEN)📊 Monitoring & Logs:$(NC)"
	@echo "  make logs                 - View all container logs (live)"
	@echo "  make logs-waf             - View WAF logs"
	@echo "  make logs-vault           - View Vault logs"
	@echo "  make logs-db              - View PostgreSQL logs"
	@echo "  make logs-redis           - View Redis logs"
	@echo "  make health               - Check health of all services"
	@echo ""
	@echo "$(GREEN)🧹 Cleanup:$(NC)"
	@echo "  make clean                - Remove containers and volumes"
	@echo "  make clean-all            - Remove everything (containers, volumes, images)"
	@echo "  make prune                - Prune unused Docker resources"
	@echo "  make reset                - Hard reset project (clean + rebuild)"
	@echo ""
	@echo "$(GREEN)🔐 Vault Management:$(NC)"
	@echo "  make vault-status         - Check Vault status"
	@echo "  make vault-init           - Initialize Vault (dev mode)"
	@echo "  make vault-login          - Login to Vault CLI"
	@echo "  make vault-shell          - Open Vault container shell"
	@echo ""
	@echo "$(GREEN)🗄️ Database:$(NC)"
	@echo "  make db-shell             - Connect to PostgreSQL"
	@echo "  make db-init              - Initialize database"
	@echo "  make db-dump              - Create database backup"
	@echo "  make db-restore           - Restore database from backup"
	@echo ""
	@echo "$(GREEN)🧪 Testing & Quality:$(NC)"
	@echo "  make test                 - Run tests"
	@echo "  make test-watch           - Run tests in watch mode"
	@echo "  make lint                 - Run linter"
	@echo "  make format               - Format code"
	@echo "  make type-check           - TypeScript type checking"
	@echo ""
	@echo "$(GREEN)🐚 Utilities:$(NC)"
	@echo "  make bash                 - Open bash shell in main container"
	@echo "  make version              - Show project versions"
	@echo "  make validate             - Validate docker-compose.yml"
	@echo ""

# ============================================================================
# SETUP & INSTALLATION
# ============================================================================

install: validate
	@echo "$(BLUE)→ Installing dependencies...$(NC)"
	@pnpm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

build: validate
	@echo "$(BLUE)→ Building Docker images...$(NC)"
	@docker compose build --no-cache
	@echo "$(GREEN)✓ Docker images built$(NC)"

validate:
	@echo "$(BLUE)→ Validating docker-compose.yml...$(NC)"
	@docker compose config > /dev/null && echo "$(GREEN)✓ docker-compose.yml is valid$(NC)" || echo "$(RED)✗ Invalid docker-compose.yml$(NC)"

# ============================================================================
# RUNTIME
# ============================================================================

up:
	@echo "$(BLUE)→ Starting containers (detached mode)...$(NC)"
	@docker compose up -d
	@sleep 3
	@echo "$(GREEN)✓ Containers started$(NC)"
	@make ps

up-debug:
	@echo "$(BLUE)→ Starting containers with logs...$(NC)"
	@docker compose up

down:
	@echo "$(BLUE)→ Stopping containers...$(NC)"
	@docker compose down
	@echo "$(GREEN)✓ Containers stopped$(NC)"

restart: down up
	@echo "$(GREEN)✓ Containers restarted$(NC)"

ps:
	@echo "$(BLUE)→ Running containers:$(NC)"
	@docker compose ps

# ============================================================================
# MONITORING & LOGS
# ============================================================================

logs:
	@echo "$(BLUE)→ Showing live logs from all containers...$(NC)"
	@docker compose logs -f

logs-waf:
	@echo "$(BLUE)→ WAF Logs:$(NC)"
	@docker compose logs -f waf

logs-vault:
	@echo "$(BLUE)→ Vault Logs:$(NC)"
	@docker compose logs -f vault

logs-db:
	@echo "$(BLUE)→ PostgreSQL Logs:$(NC)"
	@docker compose logs -f postgres

logs-redis:
	@echo "$(BLUE)→ Redis Logs:$(NC)"
	@docker compose logs -f redis

health:
	@echo "$(BLUE)→ Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Vault:$(NC)"
	@curl -s http://localhost:8200/v1/sys/health | jq '.' 2>/dev/null || echo "$(RED)✗ Vault unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker compose exec postgres pg_isready -U $(POSTGRES_USER) || echo "$(RED)✗ PostgreSQL unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker compose exec redis redis-cli ping || echo "$(RED)✗ Redis unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)WAF (Nginx):$(NC)"
	@nc -zv localhost 8080 2>&1 | grep -q "succeeded" && echo "$(GREEN)✓ WAF listening on port 8080$(NC)" || echo "$(RED)✗ WAF unreachable$(NC)"
	@docker compose exec waf nginx -t 2>&1 | grep -q "successful" && echo "$(GREEN)✓ Nginx config OK$(NC)" || echo "$(YELLOW)⚠ Nginx config issue$(NC)"

# ============================================================================
# CLEANUP
# ============================================================================

clean:
	@echo "$(BLUE)→ Removing containers and volumes...$(NC)"
	@docker compose down -v
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

clean-all: clean
	@echo "$(BLUE)→ Removing images...$(NC)"
	@docker compose down --rmi all
	@echo "$(GREEN)✓ Full cleanup complete$(NC)"

prune:
	@echo "$(BLUE)→ Pruning unused Docker resources...$(NC)"
	@docker system prune -f
	@docker volume prune -f
	@echo "$(GREEN)✓ Prune complete$(NC)"

reset: clean-all build up health
	@echo "$(GREEN)✓ Project reset complete$(NC)"

# ============================================================================
# VAULT MANAGEMENT
# ============================================================================

vault-status:
	@echo "$(BLUE)→ Vault Status:$(NC)"
	@curl -s $(VAULT_ADDR)/v1/sys/health | jq '.' || echo "$(RED)✗ Vault unreachable$(NC)"

vault-init:
	@echo "$(BLUE)→ Initializing Vault (already done in dev mode)...$(NC)"
	@echo "$(YELLOW)Token: $(VAULT_TOKEN)$(NC)"
	@echo "$(YELLOW)Address: $(VAULT_ADDR)$(NC)"

vault-login:
	@echo "$(BLUE)→ Logging into Vault...$(NC)"
	@docker compose exec vault vault login -method=token -path=auth/token/login $(VAULT_TOKEN)

vault-shell:
	@echo "$(BLUE)→ Opening Vault shell...$(NC)"
	@docker compose exec vault sh

# ============================================================================
# DATABASE MANAGEMENT
# ============================================================================

db-shell:
	@echo "$(BLUE)→ Connecting to PostgreSQL...$(NC)"
	@docker compose exec postgres psql -U $(POSTGRES_USER)

db-init:
	@echo "$(BLUE)→ Initializing database...$(NC)"
	@docker compose exec postgres psql -U $(POSTGRES_USER) -f /docker-entrypoint-initdb.d/init.sql
	@echo "$(GREEN)✓ Database initialized$(NC)"

db-dump:
	@echo "$(BLUE)→ Creating database backup...$(NC)"
	@mkdir -p backups
	@docker compose exec postgres pg_dump -U $(POSTGRES_USER) -d transcendence > backups/db_backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✓ Backup created$(NC)"

db-restore:
	@echo "$(BLUE)→ Restoring database from backup...$(NC)"
	@docker compose exec -T postgres psql -U $(POSTGRES_USER) -d transcendence < backups/latest.sql
	@echo "$(GREEN)✓ Database restored$(NC)"

# ============================================================================
# TESTING & QUALITY
# ============================================================================

test:
	@echo "$(BLUE)→ Running tests...$(NC)"
	@pnpm test

test-watch:
	@echo "$(BLUE)→ Running tests in watch mode...$(NC)"
	@pnpm test --watch

lint:
	@echo "$(BLUE)→ Running linter...$(NC)"
	@pnpm lint

format:
	@echo "$(BLUE)→ Formatting code...$(NC)"
	@pnpm format

type-check:
	@echo "$(BLUE)→ Running TypeScript type check...$(NC)"
	@pnpm type-check

# ============================================================================
# UTILITIES
# ============================================================================

bash:
	@echo "$(BLUE)→ Opening bash shell...$(NC)"
	@docker compose exec -it waf sh

version:
	@echo "$(BLUE)→ Project Versions:$(NC)"
	@echo "Node: $$(node --version)"
	@echo "pnpm: $$(pnpm --version)"
	@echo "Docker: $$(docker --version)"
	@echo "Docker Compose: $$(docker compose --version)"
	@echo "Vault: $$(curl -s $(VAULT_ADDR)/v1/sys/health | jq -r '.version' 2>/dev/null || echo 'N/A')"

git-push:
	@echo "$(BLUE)→ Pushing changes to Git (with force-with-lease)...$(NC)"
	@git push --force-with-lease origin $$(git rev-parse --abbrev-ref HEAD)
	@echo "$(GREEN)✓ Changes pushed$(NC)"

git-status:
	@echo "$(BLUE)→ Git status:$(NC)"
	@git status

# ============================================================================
# COMBINED COMMANDS
# ============================================================================

dev: up logs
	@echo "$(GREEN)✓ Development environment started$(NC)"

prod-build: build
	@echo "$(BLUE)→ Building production images...$(NC)"
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml build
	@echo "$(GREEN)✓ Production images built$(NC)"

quick-start: install build up health
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           🎉 Quick Start Complete!                        ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Services:$(NC)"
	@echo "  • WAF (Nginx + ModSecurity): http://localhost:8080"
	@echo "  • Vault: http://localhost:8200"
	@echo "  • PostgreSQL: localhost:5432"
	@echo "  • Redis: localhost:6378"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  • Run 'make logs' to see live logs"
	@echo "  • Run 'make health' to check service health"
	@echo "  • Run 'make help' for all available commands"
	@echo ""

# ============================================================================
# DEFAULT TARGET
# ============================================================================

.DEFAULT_GOAL := help
