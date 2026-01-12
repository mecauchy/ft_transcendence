.PHONY: help up dev down restart secrets logs logs-vault logs-postgres logs-redis logs-waf logs-api-gateway health vault db redis build build-local build-docker clean clean-soft clean-hard clean-volumes clean-images clean-all prisma-env prisma-migrate prisma-seed prisma-studio setup setup-school down-school

# make sure env is correctly loaded
SHELL := /bin/bash
export NVM_DIR := $(HOME)/.nvm
export PATH := $(NVM_DIR)/versions/node/$(shell [ -s "$(NVM_DIR)/nvm.sh" ] && . "$(NVM_DIR)/nvm.sh" && nvm current 2>/dev/null | sed 's/v//')/bin:$(PATH)

# load nvm if available
define LOAD_NVM
	@if [ -s "$(NVM_DIR)/nvm.sh" ]; then \
		. "$(NVM_DIR)/nvm.sh"; \
	fi
endef

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
	@printf "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)\n"
	@printf "$(BLUE)║           $(PROJECT_NAME) - Essential Commands             ║$(NC)\n"
	@printf "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)\n"
	@printf "\n"
	@printf "$(GREEN)🚀 Quick Start:$(NC)\n"
	@echo "  make setup                - Full setup: secrets + db + prisma + start"
	@echo "  make setup-school         - Setup for 42 school PCs (no admin rights)"
	@printf "\n"
	@printf "$(GREEN)🚀 Runtime:$(NC)\n"
# 	@echo "  make up                   - Start all containers (production mode)"
# 	@echo "  make dev                  - Start containers in development mode (exposed ports)"
# 	@echo "  make prod                 - Start containers in production mode (no exposed ports)"
	@echo "  make down                 - Stop all containers"
	@echo "  make restart              - Restart all containers"
# 	@echo "  make restart-dev          - Restart in development mode"
	@printf "\n"
	@printf "$(GREEN)🔨 Build (Development):$(NC)\n"
# 	@echo "  make build                - Build TypeScript locally (for volume mounting)"
# 	@echo "  make build-local          - Same as 'make build'"
# 	@echo "  make build-docker         - Build Docker images (uses cache)"
# 	@echo "  make rebuild              - Force rebuild all images (no cache, slower)"
	@echo "  make secrets              - Generate missing development secrets"
	@printf "\n"
	@printf "$(GREEN)🗄️  Database & Prisma:$(NC)\n"
	@echo "  make prisma-env           - Generate Prisma .env from secrets"
	@echo "  make prisma-migrate       - Deploy Prisma migrations to database"
	@echo "  make prisma-studio        - Open Prisma Studio (DB browser)"
	@echo "  make db                   - Connect to PostgreSQL CLI"
	@printf "\n"
	@printf "$(GREEN)🔐 Secrets & Webhooks:$(NC)\n"
	@echo "  ./scripts/webhook-manager.sh save '<url>'  - Save Discord webhook URL locally"
	@echo "  ./scripts/webhook-manager.sh load          - Load webhook from file into Vault"
	@echo "  ./scripts/webhook-manager.sh show          - Show saved webhook (masked)"
	@echo "  ./scripts/kuma-password.sh                 - Show Uptime-Kuma admin credentials"
	@printf "\n"
	@printf "$(GREEN)🔧 Uptime-Kuma Setup:$(NC)\n"
	@echo "  make kuma-init-password                    - Set Uptime-Kuma admin password from Vault"
	@printf "\n"
	@printf "$(GREEN)📊 Monitoring:$(NC)\n"
	@echo "  make logs                 - View live logs from all services"
	@echo "  make logs-[service]       - View logs for specific service"
	@echo "                              (vault, postgres, redis, waf, api-gateway, elk)"
	@echo "  make kibana-init          - Initialize Kibana dashboard (run after monitoring starts)"
	@echo "  make health               - Check health of all services"
	@echo "  make urls                 - Display all service URLs"
	@echo ""
	@echo "$(GREEN)🔧 Access:$(NC)"
	@echo "  make vault                - Open Vault shell"
	@echo "  make db                   - Connect to PostgreSQL"
	@echo "  make redis                - Open Redis CLI"
	@printf "\n"
	@printf "$(GREEN)🧹 Cleanup:$(NC)\n"
	@echo "  make clean                - Soft clean (stop containers, keep volumes)"
	@echo "  make clean-soft           - Stop containers and prune unused resources"
	@echo "  make clean-hard           - Remove containers & volumes, rebuild images"
	@echo "  make clean-volumes        - Remove all volumes (⚠️  data loss)"
	@echo "  make clean-images         - Remove all project images"
	@echo "  make clean-all            - Nuclear option: remove everything"
	@printf "\n"

# ============================================================================
# RUNTIME
# ============================================================================

# up: secrets
# 	@printf "$(BLUE)→ Checking if images need to be built...$(NC)\n"
# 	@docker compose build
# 	@printf "$(BLUE)→ Starting production stack (idempotent)...$(NC)\n"
# 	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# 	@docker compose ps
# 	@printf "$(GREEN)✓ Production stack started$(NC)\n"

# dev: secrets
# 	@printf "$(BLUE)→ Starting containers in DEVELOPMENT mode...$(NC)\n"
# 	@printf "$(YELLOW)  - Ports exposed: 3000 (api-gateway), 3011 (auth-service), 5432 (postgres), 6378 (redis)$(NC)\n"
# 	@printf "$(YELLOW)  - Vault: HTTP mode at http://vault:8200$(NC)\n"
# 	@printf "$(YELLOW)  - AppRole credentials: Auto-generated$(NC)\n"
# 	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# 	@sleep 5
# 	@printf "$(BLUE)→ Checking AppRole credentials...$(NC)\n"
# 	@if [ -s infra/secret/api-gateway_role_id ] && [ -s infra/secret/api-gateway_secret_id ]; then \
# 		echo "$(GREEN)✓ AppRole credentials generated$(NC)"; \
# 	else \
# 		echo "$(YELLOW)⚠ AppRole credentials not found - check vault logs$(NC)"; \
# 	fi
# 	@docker compose ps

# prod: secrets
# 	@printf "$(BLUE)→ Starting containers in PRODUCTION mode...$(NC)\n"
# 	@printf "$(GREEN)  - Network isolation: No backend ports exposed$(NC)\n"
# 	@printf "$(GREEN)  - Vault: TLS enabled$(NC)\n"
# 	@printf "$(GREEN)  - Access via WAF only (ports 80/443)$(NC)\n"
# 	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# 	@sleep 3
# 	@docker compose ps

secrets:
	@printf "$(BLUE)→ Generating development secrets...$(NC)\n"
	@./scripts/generate_dev_secrets.sh
	@printf "$(BLUE)→ Creating AppRole credential placeholders...$(NC)\n"
	@touch infra/secret/api-gateway_role_id infra/secret/api-gateway_secret_id infra/secret/auth-service_role_id infra/secret/auth-service_secret_id 2>/dev/null || true
	@chmod 600 infra/secret/api-gateway_* infra/secret/auth-service_* 2>/dev/null || true

# ============================================================================
# FULL SETUP (for new developers)
# ============================================================================

setup: secrets
	@printf "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)\n"
	@printf "$(BLUE)║           Full Project Setup                               ║$(NC)\n"
	@printf "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)\n"
	@printf "\n"
	@printf "$(BLUE)→ Step 1/4: Starting database...$(NC)\n"
	@docker compose up -d postgres
	@printf "$(YELLOW)→ Waiting for PostgreSQL to be ready...$(NC)\n"
	@sleep 5
	@until docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do \
		echo "$(YELLOW)  Waiting for PostgreSQL...$(NC)"; \
		sleep 2; \
	done
	@printf "$(GREEN)✓ PostgreSQL is ready$(NC)\n"
	@printf "\n"
	@printf "$(BLUE)→ Step 2/4: Generating Prisma .env...$(NC)\n"
	@$(MAKE) -s prisma-env
	@printf "\n"
	@printf "$(BLUE)→ Step 3/4: Deploying database migrations...$(NC)\n"
	@$(MAKE) -s prisma-migrate
	@printf "\n"
	@printf "$(BLUE)→ Step 4/4: Starting all services...$(NC)\n"
	@docker compose up -d
	@sleep 3
	@docker compose ps
	@printf "\n"
	@printf "$(GREEN)╔════════════════════════════════════════════════════════════╗$(NC)\n"
	@printf "$(GREEN)║           ✓ Setup Complete!                                ║$(NC)\n"
	@printf "$(GREEN)╚════════════════════════════════════════════════════════════╝$(NC)\n"
	@printf "\n"
	@printf "$(YELLOW)Access the application:$(NC)\n"
	@echo "  Frontend:      https://localhost:8443"
	@echo "  API:           https://localhost:8443/api"
	@echo "  Prisma Studio: make prisma-studio"
	@printf "\n"
	@printf "$(YELLOW)Test the API:$(NC)\n"
	@echo "  curl -k https://localhost:8443/api/auth/register -X POST \\"
	@echo "    -H 'Content-Type: application/json' \\"
	@echo "    -d '{\"username\":\"test\",\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"dob\":\"1995-01-01\"}'"
	@printf "\n"

# ============================================================================
# SCHOOL SETUP (42 school PCs without admin rights)
# ============================================================================

setup-school: secrets
	@printf "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)\n"
	@printf "$(BLUE)║    42 School Setup (No Admin Rights Required)              ║$(NC)\n"
	@printf "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)\n"
	@printf "\n"
	@printf "$(YELLOW)⚠ Disabled services: filebeat, cadvisor (require privileged access)$(NC)\n"
	@printf "\n"
	@printf "$(BLUE)→ Step 1/4: Starting database...$(NC)\n"
	@docker compose -f docker-compose.yml -f docker-compose.school.yml up -d postgres
	@printf "$(YELLOW)→ Waiting for PostgreSQL to be ready...$(NC)\n"
	@sleep 5
	@until docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do \
		echo "$(YELLOW)  Waiting for PostgreSQL...$(NC)"; \
		sleep 2; \
	done
	@printf "$(GREEN)✓ PostgreSQL is ready$(NC)\n"
	@printf "\n"
	@printf "$(BLUE)→ Step 2/4: Generating Prisma .env...$(NC)\n"
	@$(MAKE) -s prisma-env
	@printf "\n"
	@printf "$(BLUE)→ Step 3/4: Deploying database migrations...$(NC)\n"
	@$(MAKE) -s prisma-migrate
	@printf "\n"
	@printf "$(BLUE)→ Step 4/4: Starting all services (school mode)...$(NC)\n"
	@docker compose -f docker-compose.yml -f docker-compose.school.yml up -d
	@sleep 3
	@docker compose -f docker-compose.yml -f docker-compose.school.yml ps
	@printf "\n"
	@printf "$(GREEN)╔════════════════════════════════════════════════════════════╗$(NC)\n"
	@printf "$(GREEN)║           ✓ School Setup Complete!                         ║$(NC)\n"
	@printf "$(GREEN)╚════════════════════════════════════════════════════════════╝$(NC)\n"
	@printf "\n"
	@printf "$(YELLOW)Access the application:$(NC)\n"
	@echo "  Frontend:      https://localhost:8443"
	@echo "  API:           https://localhost:8443/api"
	@echo "  Prisma Studio: make prisma-studio"
	@printf "\n"
	@printf "$(YELLOW)Note: Monitoring features (filebeat, cadvisor) are disabled.$(NC)\n"
	@printf "$(YELLOW)Kibana/Elasticsearch logs will not show container logs.$(NC)\n"
	@printf "\n"

down-school:
	@printf "$(BLUE)→ Stopping school mode containers...$(NC)\n"
	@docker compose -f docker-compose.yml -f docker-compose.school.yml down

# ============================================================================
# PRISMA / DATABASE
# ============================================================================

prisma-env:
	@printf "$(BLUE)→ Generating Prisma .env file...$(NC)\n"
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
	@printf "$(BLUE)→ Syncing database with Prisma schema...$(NC)\n"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) -s prisma-env; \
	fi
	@cd $(PRISMA_DIR) && npm install && ./node_modules/.bin/prisma db push
	@printf "$(GREEN)✓ Database schema synced successfully$(NC)\n"
	@printf "$(BLUE)→ Seeding database with initial data...$(NC)\n"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/tsx seed.ts
	@printf "$(GREEN)✓ Database seeded successfully$(NC)\n"

prisma-seed:
	@printf "$(BLUE)→ Seeding database...$(NC)\n"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) -s prisma-env; \
	fi
	@cd $(PRISMA_DIR) && ./node_modules/.bin/tsx seed.ts
	@printf "$(GREEN)✓ Database seeded successfully$(NC)\n"

prisma-studio:
	@printf "$(BLUE)→ Starting Prisma Studio...$(NC)\n"
	@if [ ! -f $(PRISMA_DIR)/.env ]; then \
		echo "$(YELLOW)→ Prisma .env not found, generating...$(NC)"; \
		$(MAKE) prisma-env; \
	fi
	@printf "$(GREEN)Opening Prisma Studio at http://localhost:5555$(NC)\n"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma studio

prisma-generate:
	@printf "$(BLUE)→ Generating Prisma client...$(NC)\n"
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma generate
	@printf "$(GREEN)✓ Prisma client generated$(NC)\n"

prisma-reset:
	@printf "$(RED)⚠️  WARNING: This will DELETE all data and re-run migrations!$(NC)\n"
	@printf "$(YELLOW)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)\n"
	@sleep 5
	@cd $(PRISMA_DIR) && ./node_modules/.bin/prisma migrate reset --force
	@printf "$(GREEN)✓ Database reset complete$(NC)\n"

down:
	@printf "$(BLUE)→ Stopping containers...$(NC)\n"
	@docker compose down || docker compose -f docker-compose.yml -f docker-compose.dev.yml down

restart: down up
	@printf "$(GREEN)✓ Containers restarted$(NC)\n"

restart-dev:
	@printf "$(BLUE)→ Restarting in development mode...$(NC)\n"
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml down
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@printf "$(GREEN)✓ Development stack restarted$(NC)\n"

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

logs-elk:
	@docker compose logs -f elasticsearch logstash kibana filebeat

kibana-init:
	@echo "$(BLUE)→ Initializing Kibana dashboard...$(NC)"
	@docker compose exec kibana /usr/local/bin/init-dashboard.sh
	@echo "$(GREEN)✓ Dashboard initialized!$(NC)"
	@echo "$(YELLOW)Access Kibana at: http://localhost:5601$(NC)"

health:
	@echo "$(BLUE)→ Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Vault:$(NC)"
	@docker compose exec -T vault vault status 2>/dev/null || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker compose exec -T redis redis-cli ping 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)WAF (Nginx):$(NC)"
	@curl -s http://localhost:80 >/dev/null 2>&1 && echo "$(GREEN)✓ Listening on port 80$(NC)" || echo "$(RED)✗ Unreachable$(NC)"
	@printf "\n"
	@printf "$(YELLOW)API Gateway (dev mode only):$(NC)\n"
	@curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "$(GREEN)✓ Listening on port 3000$(NC)" || echo "$(YELLOW)○ Not exposed (production mode)$(NC)"

urls:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║              Service URLs - $(PROJECT_NAME)                 ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)🌐 Frontend & Gateway:$(NC)"
	@echo "  Frontend (HTTP):         http://localhost:3005"
	@echo "  Frontend (HTTPS):        https://localhost:3006"
	@echo "  WAF HTTP:                http://localhost:8080"
	@echo "  WAF HTTPS:               https://localhost:8443"
	@echo "  API Gateway (dev):       http://localhost:3000"
	@echo ""
	@echo "$(GREEN)🔐 Authentication:$(NC)"
	@echo "  Auth Service (internal): http://auth-service:3001"
	@echo "  Vault (dev):             http://localhost:8200"
	@echo "  Vault (prod):            https://localhost:8200"
	@echo ""
	@echo "$(GREEN)💾 Data Services:$(NC)"
	@echo "  PostgreSQL:              localhost:5432 (user: $(POSTGRES_USER))"
	@echo "  Redis (dev):             localhost:6378"
	@echo "  Redis (internal):        redis:6379"
	@echo "  Elasticsearch:           http://localhost:9200"
	@echo ""
	@echo "$(GREEN)📊 Monitoring & Logging:$(NC)"
	@echo "  Grafana:                 http://localhost:3009 (admin/admin)"
	@echo "  Prometheus:              http://localhost:9090"
	@echo "  Alertmanager:            http://localhost:9093"
	@echo "  cAdvisor:                http://localhost:8081"
	@echo "  Kibana:                  http://localhost:5601"
	@echo "  Kibana Dashboard:        http://localhost:5601/app/dashboards#/view/ft-logs-dashboard"
	@echo "  Uptime-Kuma:             http://localhost:3010 (kuma_admin/[vault password])"
	@echo ""
	@echo "$(YELLOW)📝 Note:$(NC)"
	@echo "  - Dev mode exposes backend ports for development"
	@echo "  - Prod mode only exposes WAF (80/443), access via hostname"
	@echo "  - Run 'make monitoring' to start monitoring stack"
	@echo "  - Use 'make urls' anytime to show this list"
	@echo ""

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

# build: build-local
# 	@printf "$(GREEN)✓ Local TypeScript built successfully$(NC)\n"

# build-local:
# 	@printf "$(BLUE)→ Building TypeScript locally...$(NC)\n"
# 	@cd packages/backend/api-gateway && npm run build && cd ../../..
# 	@printf "$(GREEN)✓ api-gateway built$(NC)\n"

# build-docker:
# 	@printf "$(BLUE)→ Building Docker images...$(NC)\n"
# 	@docker compose build
# 	@printf "$(GREEN)✓ Docker images built$(NC)\n"

# rebuild:
# 	@printf "$(BLUE)→ Forcing rebuild of all Docker images (no cache)...$(NC)\n"
# 	@docker compose build --no-cache
# 	@printf "$(GREEN)✓ Docker images rebuilt from scratch$(NC)\n"

# ============================================================================
# UPTIME-KUMA SETUP
# ============================================================================

kuma-init-password:
	@printf "$(BLUE)→ Setting Uptime-Kuma admin password...$(NC)\n"
	@KUMA_PASS=$$(docker exec vault sh -c 'export VAULT_ADDR=http://0.0.0.0:8200 && vault kv get -field=password secret/kuma' 2>/dev/null); \
	if [ -z "$$KUMA_PASS" ]; then \
		echo "$(RED)✗ Failed to retrieve password from Vault$(NC)"; \
		echo "$(YELLOW)Hint: Make sure Vault is running and initialized$(NC)"; \
		exit 1; \
	fi; \
	docker exec -e "KUMA_ADMIN_PASSWORD=$$KUMA_PASS" uptime-kuma bash /setup-kuma.sh; \
	echo ""; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"; \
	echo "$(GREEN)   🎯 Uptime-Kuma Admin Credentials$(NC)"; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"; \
	echo ""; \
	echo "URL:      http://localhost:3010"; \
	echo "Username: kuma_admin"; \
	echo "Password: $$KUMA_PASS"; \
	echo ""; \
	echo "$(GREEN)════════════════════════════════════════════════$(NC)"

# ============================================================================
# CLEANUP
# ============================================================================

clean: clean-soft
	@printf "$(GREEN)✓ Soft cleanup complete$(NC)\n"

clean-soft:
	@printf "$(BLUE)→ Soft clean: Stopping containers and pruning unused resources...$(NC)\n"
	@docker compose down 2>/dev/null || docker compose -f docker-compose.yml -f docker-compose.dev.yml down
	@printf "$(YELLOW)→ Pruning unused Docker resources...$(NC)\n"
	@docker system prune -f
	@printf "$(GREEN)✓ Soft cleanup complete (volumes preserved)$(NC)\n"

clean-hard: down
	@printf "$(BLUE)→ Hard clean: Removing containers, volumes, and rebuilding images...$(NC)\n"
	@printf "$(YELLOW)⚠️  This will delete all data in volumes!$(NC)\n"
	@docker compose down -v --remove-orphans 2>/dev/null || docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
	@printf "$(YELLOW)→ Removing project images...$(NC)\n"
	@docker image rm ft_transcendence-api-gateway ft_transcendence-auth-service ft_transcendence-waf ft_transcendence-front 2>/dev/null || true
	@printf "$(YELLOW)→ Pruning all Docker system resources...$(NC)\n"
	@docker system prune -af
	@printf "$(YELLOW)→ Rebuilding Docker images...$(NC)\n"
	@docker compose build --no-cache
	@printf "$(GREEN)✓ Hard cleanup and rebuild complete$(NC)\n"

clean-volumes:
	@printf "$(RED)⚠️  WARNING: This will DELETE all persistent data!$(NC)\n"
	@printf "$(YELLOW)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)\n"
	@sleep 5
	@printf "$(BLUE)→ Removing all volumes...$(NC)\n"
	@docker volume ls -q --filter label=com.docker.compose.project=$(PROJECT_NAME) | xargs -r docker volume rm 2>/dev/null || true
	@docker compose down -v --remove-orphans 2>/dev/null || docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
	@printf "$(GREEN)✓ All volumes removed$(NC)\n"

clean-images:
	@printf "$(BLUE)→ Removing project Docker images...$(NC)\n"
	@docker compose down 2>/dev/null || docker compose -f docker-compose.yml -f docker-compose.dev.yml down
	@docker image rm -f ft_transcendence-api-gateway ft_transcendence-auth-service ft_transcendence-waf ft_transcendence-front 2>/dev/null || true
	@docker images --filter reference='ft_transcendence-*' -q | xargs -r docker image rm -f
	@printf "$(GREEN)✓ Project images removed$(NC)\n"

clean-all:
	@printf "$(RED)🔥 NUCLEAR OPTION: Removing EVERYTHING for this project!$(NC)\n"
	@printf "$(RED)This will delete:$(NC)\n"
	@echo "  - All containers"
	@echo "  - All volumes (data loss!)"
	@echo "  - All images"
	@echo "  - All secrets"
	@echo "  - Prisma .env"
	@printf "$(RED)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)\n"
	@sleep 5
	@printf "$(BLUE)→ Stopping and removing containers...$(NC)\n"
	@docker compose --profile monitoring down -v --remove-orphans 2>/dev/null || true
	@printf "$(BLUE)→ Removing all project images...$(NC)\n"
	$(MAKE) clean-images
	@printf "$(BLUE)→ Removing all project volumes...$(NC)\n"
	$(MAKE) clean-volumes
	@printf "$(BLUE)→ Removing secrets...$(NC)\n"
	@rm -f infra/secret/*.txt 2>/dev/null || true
	@rm -rf infra/secret/.secrets 2>/dev/null || true
	@printf "$(BLUE)→ Removing Prisma .env...$(NC)\n"
	@rm -f $(PRISMA_DIR)/.env 2>/dev/null || true
	@printf "$(BLUE)→ Pruning Docker system...$(NC)\n"
	@docker system prune -f
	@printf "$(BLUE)→ Removing AppRole credentials...$(NC)\n"
	@rm -f infra/secret/api-gateway_role_id infra/secret/api-gateway_secret_id infra/secret/auth-service_role_id infra/secret/auth-service_secret_id
	@printf "$(BLUE)→ Full system prune...$(NC)\n"
	@docker system prune -af --volumes
	@printf "$(GREEN)✓ Complete nuclear cleanup finished$(NC)\n"
	@printf "\n"
	@printf "$(YELLOW)To start fresh, run: make setup$(NC)\n"

.DEFAULT_GOAL := help
