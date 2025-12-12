.PHONY: help up down restart logs logs-vault logs-postgres logs-redis logs-waf health vault db redis clean

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m

PROJECT_NAME := ft_transcendence
VAULT_ADDR := http://localhost:8200
POSTGRES_USER := root_admin

# Help target
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           $(PROJECT_NAME) - Essential Commands             ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)🚀 Runtime:$(NC)"
	@echo "  make up                   - Start all containers"
	@echo "  make down                 - Stop all containers"
	@echo "  make restart              - Restart all containers"
	@echo ""
	@echo "$(GREEN)📊 Monitoring:$(NC)"
	@echo "  make logs                 - View live logs from all services"
	@echo "  make logs-[service]       - View logs for specific service"
	@echo "                              (vault, postgres, redis, waf)"
	@echo "  make health               - Check health of all services"
	@echo ""
	@echo "$(GREEN)🔧 Access:$(NC)"
	@echo "  make vault                - Open Vault shell"
	@echo "  make db                   - Connect to PostgreSQL"
	@echo "  make redis                - Open Redis CLI"
	@echo ""
	@echo "$(GREEN)🧹 Cleanup:$(NC)"
	@echo "  make clean                - Remove containers and volumes"
	@echo ""

# ============================================================================
# RUNTIME
# ============================================================================

up:
	@echo "$(BLUE)→ Starting containers...$(NC)"
	@docker compose up -d
	@sleep 3
	@docker compose ps

down:
	@echo "$(BLUE)→ Stopping containers...$(NC)"
	@docker compose down

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

health:
	@echo "$(BLUE)→ Checking service health...$(NC)"
	@echo ""
	@echo "$(YELLOW)Vault:$(NC)"
	@curl -s http://localhost:8200/v1/sys/health | jq '.' 2>/dev/null || echo "$(RED)✗ Unreachable$(NC)"
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
# CLEANUP
# ============================================================================

clean:
	@echo "$(BLUE)→ Removing containers and volumes...$(NC)"
	@docker compose down -v
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

.DEFAULT_GOAL := help
