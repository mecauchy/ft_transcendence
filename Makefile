.PHONY: help up dev down restart secrets logs logs-vault logs-postgres logs-redis logs-waf logs-api-gateway health vault db redis build build-local build-docker clean clean-soft clean-hard clean-volumes clean-images clean-all

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

PROJECT_NAME := ft_transcendence
VAULT_ADDR := https://localhost:8200
POSTGRES_USER := root_admin

# Help target
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           $(PROJECT_NAME) - Essential Commands             ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 Runtime:$(NC)"
	@echo "  make up                   - Start all containers (production mode)"
	@echo "  make dev                  - Start containers in development mode (exposed ports)"
	@echo "  make prod                 - Start containers in production mode (no exposed ports)"
	@echo "  make down                 - Stop all containers"
	@echo "  make restart              - Restart all containers"
	@echo "  make restart-dev          - Restart in development mode"
	@echo ""
	@echo "$(GREEN)🔨 Build (Development):$(NC)"
	@echo "  make build                - Build TypeScript locally (for volume mounting)"
	@echo "  make build-local          - Same as 'make build'"
	@echo "  make build-docker         - Rebuild Docker images"
	@echo "  make secrets              - Generate missing development secrets"
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

up: prod
	@echo "$(GREEN)✓ Production stack started$(NC)"

dev: secrets
	@echo "$(BLUE)→ Starting containers in DEVELOPMENT mode...$(NC)"
	@echo "$(YELLOW)  - Ports exposed: 3000 (api-gateway), 3011 (auth-service), 5432 (postgres), 6378 (redis)$(NC)"
	@echo "$(YELLOW)  - Vault: HTTP mode at http://vault:8200$(NC)"
	@echo "$(YELLOW)  - AppRole credentials: Auto-generated$(NC)"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@sleep 5
	@echo "$(BLUE)→ Checking AppRole credentials...$(NC)"
	@if [ -s infra/secret/api-gateway_role_id ] && [ -s infra/secret/api-gateway_secret_id ]; then \
		echo "$(GREEN)✓ AppRole credentials generated$(NC)"; \
	else \
		echo "$(YELLOW)⚠ AppRole credentials not found - check vault logs$(NC)"; \
	fi
	@docker-compose ps

prod: secrets
	@echo "$(BLUE)→ Starting containers in PRODUCTION mode...$(NC)"
	@echo "$(GREEN)  - Network isolation: No backend ports exposed$(NC)"
	@echo "$(GREEN)  - Vault: TLS enabled$(NC)"
	@echo "$(GREEN)  - Access via WAF only (ports 80/443)$(NC)"
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@sleep 3
	@docker-compose ps

secrets:
	@echo "$(BLUE)→ Generating development secrets...$(NC)"
	@./infra/secret/generate_dev_secrets.sh
	@echo "$(BLUE)→ Creating AppRole credential placeholders...$(NC)"
	@touch infra/secret/api-gateway_role_id infra/secret/api-gateway_secret_id infra/secret/auth-service_role_id infra/secret/auth-service_secret_id 2>/dev/null || true
	@chmod 600 infra/secret/api-gateway_* infra/secret/auth-service_* 2>/dev/null || true

down:
	@echo "$(BLUE)→ Stopping containers...$(NC)"
	@docker-compose down || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

restart: down up
	@echo "$(GREEN)✓ Containers restarted$(NC)"

restart-dev:
	@echo "$(BLUE)→ Restarting in development mode...$(NC)"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Development stack restarted$(NC)"

# ============================================================================
# MONITORING & LOGS
# ============================================================================

logs:
	@docker-compose logs -f

logs-vault:
	@docker-compose logs -f vault

logs-postgres:
	@docker-compose logs -f postgres

logs-redis:
	@docker-compose logs -f redis

logs-waf:
	@docker-compose logs -f waf

logs-api-gateway:
	@docker-compose logs -f api-gateway

health:
	@echo "$(BLUE)→ Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Vault:$(NC)"
	@docker-compose exec -T vault vault status 2>/dev/null || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)PostgreSQL:$(NC)"
	@docker-compose exec -T postgres pg_isready -U $(POSTGRES_USER) 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)Redis:$(NC)"
	@docker-compose exec -T redis redis-cli ping 2>&1 || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)WAF (Nginx):$(NC)"
	@curl -s http://localhost:80 >/dev/null 2>&1 && echo "$(GREEN)✓ Listening on port 80$(NC)" || echo "$(RED)✗ Unreachable$(NC)"
	@echo ""
	@echo "$(YELLOW)API Gateway (dev mode only):$(NC)"
	@curl -s http://localhost:3000/health >/dev/null 2>&1 && echo "$(GREEN)✓ Listening on port 3000$(NC)" || echo "$(YELLOW)○ Not exposed (production mode)$(NC)"

# ============================================================================
# SERVICE ACCESS
# ============================================================================

vault:
	@docker-compose exec vault sh

db:
	@docker-compose exec postgres psql -U $(POSTGRES_USER)

redis:
	@docker-compose exec redis redis-cli

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
	@docker-compose build --no-cache
	@echo "$(GREEN)✓ Docker images built$(NC)"

# ============================================================================
# UPTIME-KUMA SETUP
# ============================================================================

kuma-init-password:
	@echo "$(BLUE)→ Setting Uptime-Kuma admin password...$(NC)"
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
	@echo "$(GREEN)✓ Soft cleanup complete$(NC)"

clean-soft:
	@echo "$(BLUE)→ Soft clean: Stopping containers and pruning unused resources...$(NC)"
	@docker-compose down 2>/dev/null || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
	@echo "$(YELLOW)→ Pruning unused Docker resources...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Soft cleanup complete (volumes preserved)$(NC)"

clean-hard: down
	@echo "$(BLUE)→ Hard clean: Removing containers, volumes, and rebuilding images...$(NC)"
	@echo "$(YELLOW)⚠️  This will delete all data in volumes!$(NC)"
	@docker-compose down -v --remove-orphans 2>/dev/null || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
	@echo "$(YELLOW)→ Removing project images...$(NC)"
	@docker image rm ft_transcendence-api-gateway ft_transcendence-auth-service ft_transcendence-waf ft_transcendence-front 2>/dev/null || true
	@echo "$(YELLOW)→ Pruning all Docker system resources...$(NC)"
	@docker system prune -af
	@echo "$(YELLOW)→ Rebuilding Docker images...$(NC)"
	@docker-compose build --no-cache
	@echo "$(GREEN)✓ Hard cleanup and rebuild complete$(NC)"

clean-volumes:
	@echo "$(RED)⚠️  WARNING: This will DELETE all persistent data!$(NC)"
	@echo "$(YELLOW)Continuing in 5 seconds... Press Ctrl+C to cancel$(NC)"
	@sleep 5
	@echo "$(BLUE)→ Removing all volumes...$(NC)"
	@docker volume ls -q --filter label=com.docker.compose.project=$(PROJECT_NAME) | xargs -r docker volume rm 2>/dev/null || true
	@docker-compose down -v --remove-orphans 2>/dev/null || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
	@echo "$(GREEN)✓ All volumes removed$(NC)"

clean-images:
	@echo "$(BLUE)→ Removing project Docker images...$(NC)"
	@docker-compose down 2>/dev/null || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
	@docker image rm -f ft_transcendence-api-gateway ft_transcendence-auth-service ft_transcendence-waf ft_transcendence-front 2>/dev/null || true
	@docker images --filter reference='ft_transcendence-*' -q | xargs -r docker image rm -f
	@echo "$(GREEN)✓ Project images removed$(NC)"

clean-all:
	@echo "$(RED)🔥 NUCLEAR OPTION: Removing EVERYTHING for this project!$(NC)"
	@echo "$(RED)This will delete:$(NC)"
	@echo "  - All containers"
	@echo "  - All volumes (data loss!)"
	@echo "  - All images"
	@echo "  - Generated AppRole credentials"
	@echo "$(RED)Continuing in 10 seconds... Press Ctrl+C to cancel$(NC)"
	@sleep 10
	@echo "$(BLUE)→ Stopping and removing containers...$(NC)"
	@docker-compose down -v --remove-orphans 2>/dev/null || docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
	@echo "$(BLUE)→ Removing all project images...$(NC)"
	@docker images --filter reference='ft_transcendence-*' -q | xargs -r docker image rm -f
	@echo "$(BLUE)→ Removing all project volumes...$(NC)"
	@docker volume ls -q --filter label=com.docker.compose.project=$(PROJECT_NAME) | xargs -r docker volume rm 2>/dev/null || true
	@echo "$(BLUE)→ Removing AppRole credentials...$(NC)"
	@rm -f infra/secret/api-gateway_role_id infra/secret/api-gateway_secret_id infra/secret/auth-service_role_id infra/secret/auth-service_secret_id
	@echo "$(BLUE)→ Full system prune...$(NC)"
	@docker system prune -af --volumes
	@echo "$(GREEN)✓ Complete nuclear cleanup finished$(NC)"

.DEFAULT_GOAL := help
