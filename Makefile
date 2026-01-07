.PHONY: help up dev down restart secrets logs logs-vault logs-postgres logs-redis logs-waf logs-api-gateway health vault db redis build build-local build-docker clean clean-soft clean-hard clean-volumes clean-images clean-all prisma-env prisma-migrate prisma-seed prisma-studio setup

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

PROJECT_NAME := ft_transcendence
VAULT_ADDR := https://localhost:8200
POSTGRES_USER := root_admin
PRISMA_DIR := packages/shared/prisma

# Help target
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           $(PROJECT_NAME) - Essential Commands             ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 Quick Start:$(NC)"
	@echo "  make setup                - Full setup: secrets + db + prisma + start"
	@echo ""
	@echo "$(GREEN)🚀 Runtime:$(NC)"
	@echo "  make up                   - Start all containers (including monitoring)"
	@echo "  make dev                  - Start base containers (no monitoring)"
	@echo "  make down                 - Stop all containers"
	@echo "  make restart              - Restart all containers"
	@echo ""
	@echo "$(GREEN)🔨 Build (Development):$(NC)"
	@echo "  make build                - Build TypeScript locally (for volume mounting)"
	@echo "  make build-local          - Same as 'make build'"
	@echo "  make build-docker         - Rebuild Docker images"
	@echo "  make secrets              - Generate missing development secrets"
	@echo ""
	@echo "$(GREEN)🗄️  Database & Prisma:$(NC)"
	@echo "  make prisma-env           - Generate Prisma .env from secrets"
	@echo "  make prisma-migrate       - Deploy Prisma migrations to database"
	@echo "  make prisma-studio        - Open Prisma Studio (DB browser)"
	@echo "  make db                   - Connect to PostgreSQL CLI"
	@echo ""
	@echo "$(GREEN)🔐 Secrets & Webhooks:$(NC)"
	@echo "  ./scripts/webhook-manager.sh save '<url>'  - Save Discord webhook URL locally"
	@echo "  ./scripts/webhook-manager.sh load          - Load webhook from file into Vault"
	@echo "  ./scripts/webhook-manager.sh show          - Show saved webhook (masked)"
	@echo "  ./scripts/kuma-password.sh                 - Show Uptime-Kuma admin credentials"
	@echo ""
	@echo "$(GREEN)🔧 Uptime-Kuma Setup:$(NC)"
	@echo "  make kuma-init-password                    - Set Uptime-Kuma admin password from Vault"
	@echo ""
	@echo "$(GREEN)📊 Monitoring:$(NC)"
	@echo "  make logs                 - View live logs from all services"
	@echo "  make logs-[service]       - View logs for specific service"
	@echo "                              (vault, postgres, redis, waf, api-gateway)"
	@echo "  make health               - Check health of all services"
	@echo ""
	@echo "$(GREEN)🔧 Access:$(NC)"
	@echo "  make vault                - Open Vault shell"
	@echo "  make db                   - Connect to PostgreSQL"
	@echo "  make redis                - Open Redis CLI"
	@echo ""
	@echo "$(GREEN)🧹 Cleanup:$(NC)"
	@echo "  make clean                - Soft clean (stop containers, keep volumes)"
	@echo "  make clean-soft           - Stop containers and prune unused resources"
	@echo "  make clean-hard           - Remove containers & volumes, rebuild images"
	@echo "  make clean-volumes        - Remove all volumes (⚠️  data loss)"
	@echo "  make clean-images         - Remove all project images"
	@echo "  make clean-all            - Nuclear option: remove everything"
	@echo ""

# ============================================================================
# RUNTIME
# ============================================================================

up: secrets
	@echo "$(BLUE)→ Starting all containers (including monitoring)...$(NC)"
	@docker compose --profile monitoring up -d
	@sleep 3
	@docker compose ps
	@echo "$(YELLOW)→ Loading secrets into Vault...$(NC)"
	@./scripts/webhook-manager.sh load 2>/dev/null || echo "$(YELLOW)⚠ No local webhook file found. Use: ./scripts/webhook-manager.sh save '<url>'$(NC)"

dev: secrets
	@echo "$(BLUE)→ Starting base containers (without monitoring)...$(NC)"
	@docker compose up -d
	@sleep 3
	@docker compose ps

secrets:
	@echo "$(BLUE)→ Generating development secrets...$(NC)"
	@./infra/secret/generate_dev_secrets.sh

# ============================================================================
# FULL SETUP (for new developers)
# ============================================================================

setup: secrets
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           Full Project Setup                               ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(BLUE)→ Step 1/4: Starting database...$(NC)"
	@docker compose up -d postgres
	@echo "$(YELLOW)→ Waiting for PostgreSQL to be ready...$(NC)"
	@sleep 5
	@until docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do \
		echo "$(YELLOW)  Waiting for PostgreSQL...$(NC)"; \
		sleep 2; \
	done
	@echo "$(GREEN)✓ PostgreSQL is ready$(NC)"
	@echo ""
	@echo "$(BLUE)→ Step 2/4: Generating Prisma .env...$(NC)"
	@$(MAKE) -s prisma-env
	@echo ""
	@echo "$(BLUE)→ Step 3/4: Deploying database migrations...$(NC)"
	@$(MAKE) -s prisma-migrate
	@echo ""
	@echo "$(BLUE)→ Step 4/4: Starting all services...$(NC)"
	@docker compose up -d
	@sleep 3
	@docker compose ps
	@echo ""
	@echo "$(GREEN)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(GREEN)║           ✓ Setup Complete!                                ║$(NC)"
	@echo "$(GREEN)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(YELLOW)Access the application:$(NC)"
	@echo "  Frontend:      https://localhost:8443"
	@echo "  API:           https://localhost:8443/api"
	@echo "  Prisma Studio: make prisma-studio"
	@echo ""
	@echo "$(YELLOW)Test the API:$(NC)"
	@echo "  curl -k https://localhost:8443/api/auth/register -X POST \\"
	@echo "    -H 'Content-Type: application/json' \\"
	@echo "    -d '{\"username\":\"test\",\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"dob\":\"1995-01-01\"}'"
	@echo ""

# ============================================================================
# PRISMA / DATABASE
# ============================================================================

prisma-env:
	@echo "$(BLUE)→ Generating Prisma .env file...$(NC)"
	@if [ ! -f infra/secret/postgres_db_pass.txt ]; then \
		echo "$(RED)✗ Secrets not found. Run 'make secrets' first$(NC)"; \
		exit 1; \
	fi
ifeq ($(shell uname -s),Darwin)
	@PG_PASS=$$(cat infra/secret/postgres_db_pass.txt | tr -d '\r\n'); \
	PG_PASS_ENCODED=$$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$$PG_PASS"); \
	echo "DATABASE_URL=\"postgresql://$(POSTGRES_USER):$${PG_PASS_ENCODED}@localhost:5432/game_db?schema=public\"" > $(PRISMA_DIR)/.env; \
	echo "$(GREEN)✓ Created $(PRISMA_DIR)/.env$(NC) for macos"
else
	@PG_PASS=$$(cat infra/secret/postgres_db_pass.txt | tr -d '\n'); \
	PG_PASS_ENCODED=$$(echo -n "$$PG_PASS" | sed 's/+/%2B/g; s/=/%3D/g; s/\//%2F/g'); \
	echo "DATABASE_URL=\"postgresql://$(POSTGRES_USER):$${PG_PASS_ENCODED}@localhost:5432/game_db?schema=public\"" > $(PRISMA_DIR)/.env
	@echo "$(GREEN)✓ Created $(PRISMA_DIR)/.env$(NC) for linux"
endif

prisma-migrate:
	@echo "$(BLUE)→ Syncing database with Prisma schema...$(NC)"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) -s prisma-env; \
	fi
	@cd $(PRISMA_DIR) && npm install && ./node_modules/.bin/prisma db push
	@echo "$(GREEN)✓ Database schema synced successfully$(NC)"
	@echo "$(BLUE)→ Seeding database with initial data...$(NC)"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/tsx seed.ts
	@echo "$(GREEN)✓ Database seeded successfully$(NC)"

prisma-seed:
	@echo "$(BLUE)→ Seeding database...$(NC)"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) -s prisma-env; \
	fi
	@cd $(PRISMA_DIR) && ./node_modules/.bin/tsx seed.ts
	@echo "$(GREEN)✓ Database seeded successfully$(NC)"

prisma-studio:
	@echo "$(BLUE)→ Starting Prisma Studio...$(NC)"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) prisma-env; \
	fi
	@echo "$(GREEN)Opening Prisma Studio at http://localhost:5555$(NC)"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma studio

prisma-generate:
	@echo "$(BLUE)→ Generating Prisma client...$(NC)"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma generate
	@echo "$(GREEN)✓ Prisma client generated$(NC)"

prisma-reset:
	@echo "$(RED)⚠️  WARNING: This will DELETE all data and re-run migrations!$(NC)"
	@echo "$(YELLOW)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)"
	@sleep 5
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma migrate reset --force
	@echo "$(GREEN)✓ Database reset complete$(NC)"

down:
	@echo "$(BLUE)→ Stopping containers...$(NC)"
	@docker compose --profile monitoring down

restart: down up
	@echo "$(GREEN)✓ Containers restarted$(NC)"

# ============================================================================
# MONITORING & LOGS
# ============================================================================

logs:
	@docker compose logs -f

logs-vault:
	@docker compose logs -f vault

logs-postgres:
	@docker compose logs -f postgres

logs-redis:
	@docker compose logs -f redis

logs-waf:
	@docker compose logs -f waf

logs-api-gateway:
	@docker compose logs -f api-gateway

health:
	@echo "$(BLUE)→ Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Vault:$(NC)"
	@curl -s https://localhost:8200/v1/sys/health | jq '.' 2>/dev/null || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker compose exec -T redis redis-cli ping 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)WAF (Nginx):$(NC)"
	@nc -zv localhost 8080 2>&1 | grep -q "succeeded" && echo "$(GREEN)✓ Listening on 8080$(NC)" || echo "$(RED)✗ Unreachable$(NC)"

# ============================================================================
# SERVICE ACCESS
# ============================================================================

vault:
	@docker compose exec vault sh

db:
	@docker compose exec postgres psql -U $(POSTGRES_USER)

redis:
	@docker compose exec redis redis-cli

# ============================================================================
# BUILD (Development)
# ============================================================================

build: build-local
	@echo "$(GREEN)✓ Local TypeScript built successfully$(NC)"

build-local:
	@echo "$(BLUE)→ Building TypeScript locally...$(NC)"
	@cd packages/backend/api-gateway && npm run build && cd ../../..
	@echo "$(GREEN)✓ api-gateway built$(NC)"

build-docker:
	@echo "$(BLUE)→ Building Docker images...$(NC)"
	@docker compose build --no-cache
	@echo "$(GREEN)✓ Docker images built$(NC)"

# ============================================================================
# UPTIME-KUMA SETUP
# ============================================================================

kuma-init-password:
	@echo "$(BLUE)→ Setting Uptime-Kuma admin password...$(NC)"
	@KUMA_PASS=$$(docker exec vault vault kv get -field=password secret/kuma 2>/dev/null); \
	if [ -z "$$KUMA_PASS" ]; then \
		echo "$(RED)✗ Failed to retrieve password from Vault$(NC)"; \
		exit 1; \
	fi; \
	docker exec -e "KUMA_ADMIN_PASSWORD=$$KUMA_PASS" uptime-kuma bash /setup-kuma.sh; \
	echo ""; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"; \
	echo "$(GREEN)   🎯 Uptime-Kuma Admin Credentials$(NC)"; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"; \
	echo ""; \
	echo "URL:      https://localhost:3010"; \
	echo "Username: kuma_admin"; \
	echo "Password: $$KUMA_PASS"; \
	echo ""; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"

# ============================================================================
# CLEANUP
# ============================================================================

clean: clean-soft
	@echo "$(GREEN)✓ Soft cleanup complete$(NC)"

clean-soft:
	@echo "$(BLUE)→ Soft clean: Stopping containers and pruning unused resources...$(NC)"
	@docker compose down
	@echo "$(YELLOW)→ Pruning unused Docker resources...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Soft cleanup complete (volumes preserved)$(NC)"

clean-hard: down
	@echo "$(BLUE)→ Hard clean: Removing containers, volumes, and rebuilding images...$(NC)"
	@echo "$(YELLOW)⚠️  This will delete all data in volumes!$(NC)"
	@docker compose down -v --remove-orphans
	@echo "$(YELLOW)→ Removing project images...$(NC)"
	@docker image rm ft_transcendence-api-gateway ft_transcendence-waf 2>/dev/null || true
	@echo "$(YELLOW)→ Pruning all Docker system resources...$(NC)"
	@docker system prune -af
	@echo "$(YELLOW)→ Rebuilding Docker images...$(NC)"
	@docker compose build --no-cache
	@echo "$(GREEN)✓ Hard cleanup and rebuild complete$(NC)"

clean-volumes:
	@echo "$(RED)⚠️  WARNING: This will DELETE all persistent data!$(NC)"
	@echo "$(YELLOW)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)"
	@sleep 5
	@echo "$(BLUE)→ Removing all volumes...$(NC)"
	@docker volume ls -q --filter label=com.docker.compose.project=$(PROJECT_NAME) | xargs -r docker volume rm 2>/dev/null || true
	@docker compose down -v --remove-orphans
	@echo "$(GREEN)✓ All volumes removed$(NC)"

clean-images:
	@echo "$(BLUE)→ Removing project Docker images...$(NC)"
	@docker compose down
	@docker image rm -f ft_transcendence-api-gateway ft_transcendence-waf 2>/dev/null || true
	@docker images --filter reference='ft_transcendence-*' -q | xargs -r docker image rm -f
	@echo "$(GREEN)✓ Project images removed$(NC)"

clean-all:
	@echo "$(RED)🔥 NUCLEAR OPTION: Removing EVERYTHING for this project!$(NC)"
	@echo "$(RED)This will delete:$(NC)"
	@echo "  - All containers"
	@echo "  - All volumes (data loss!)"
	@echo "  - All images"
	@echo "  - All secrets"
	@echo "  - Prisma .env"
	@echo "$(RED)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)"
	@sleep 5
	@echo "$(BLUE)→ Stopping and removing containers...$(NC)"
	@docker compose --profile monitoring down -v --remove-orphans 2>/dev/null || true
	@echo "$(BLUE)→ Removing all project images...$(NC)"
	@docker images --filter reference='transcendence-*' -q | xargs -r docker image rm -f 2>/dev/null || true
	@echo "$(BLUE)→ Removing all project volumes...$(NC)"
	@docker volume ls -q | grep -E "transcendence|postgres|redis|vault|grafana|prometheus" | xargs -r docker volume rm 2>/dev/null || true
	@echo "$(BLUE)→ Removing secrets...$(NC)"
	@rm -f infra/secret/*.txt 2>/dev/null || true
	@rm -rf infra/secret/.secrets 2>/dev/null || true
	@echo "$(BLUE)→ Removing Prisma .env...$(NC)"
	@rm -f $(PRISMA_DIR)/.env 2>/dev/null || true
	@echo "$(BLUE)→ Pruning Docker system...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Complete nuclear cleanup finished$(NC)"
	@echo ""
	@echo "$(YELLOW)To start fresh, run: make setup$(NC)"

.DEFAULT_GOAL := help
