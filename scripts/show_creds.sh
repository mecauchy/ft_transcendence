#!/usr/bin/env bash
# Development Environment Credentials - Development Use Only
# This script retrieves credentials from Vault for monitoring services
set -eo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_DIR="$ROOT_DIR/infra/secret"

# CLI options
REVEAL=true  # Always show credentials for monitoring services

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

usage(){
  cat <<EOF
Usage: $(basename "$0") [--help]

Shows credentials for monitoring services (Grafana, Uptime-Kuma, Kibana, etc.)
Retrieved from Vault when available, falls back to local files.

Options:
  --help     Show this help message.

This script is intended for local development only. DO NOT use in production.
EOF
}

# parse args
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# Function to get password from Vault
get_vault_secret() {
    local secret_path=$1
    local field=${2:-password}
    
    if docker ps | grep -q vault; then
        docker exec vault sh -c "export VAULT_ADDR=http://0.0.0.0:8200 && vault kv get -field=$field secret/$secret_path" 2>/dev/null || echo "N/A"
    else
        echo "N/A (Vault not running)"
    fi
}

# Read a secret file fallback
read_secret() {
  local f="$1"
  if [[ -f "$f" ]]; then
    awk 'BEGIN{ORS=""} {print}' "$f" 2>/dev/null || cat "$f" 2>/dev/null
  else
    echo "N/A"
  fi
}

main() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Service Credentials (from Vault)                 ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Check if Vault is running
  if ! docker ps | grep -q vault; then
      echo -e "${YELLOW}⚠️  Vault container is not running${NC}"
      echo "Please start services with: make monitoring"
      echo ""
      echo "Falling back to local files..."
      echo ""
  fi

  echo -e "${GREEN}🔐 Grafana:${NC}"
  echo "  URL:      http://localhost:3009"
  echo "  Username: grafana_admin"
  GRAFANA_PASS=$(get_vault_secret grafana)
  if [ "$GRAFANA_PASS" = "N/A" ] || [ -z "$GRAFANA_PASS" ]; then
    GRAFANA_PASS=$(read_secret "$SECRETS_DIR/grafana_pass.txt")
  fi
  echo "  Password: $GRAFANA_PASS"
  echo ""

  echo -e "${GREEN}🔐 Uptime-Kuma:${NC}"
  echo "  URL:      http://localhost:3010"
  echo "  Username: kuma_admin"
  KUMA_PASS=$(get_vault_secret kuma)
  if [ "$KUMA_PASS" = "N/A" ] || [ -z "$KUMA_PASS" ]; then
    KUMA_PASS=$(read_secret "$SECRETS_DIR/kuma_pass.txt")
  fi
  echo "  Password: $KUMA_PASS"
  echo ""

  echo -e "${GREEN}🔐 Kibana:${NC}"
  echo "  URL:      http://localhost:5601"
  echo "  Username: elastic"
  ES_PASS=$(get_vault_secret elasticsearch)
  if [ "$ES_PASS" = "N/A" ] || [ -z "$ES_PASS" ]; then
    ES_PASS=$(read_secret "$SECRETS_DIR/elasticsearch_pass.txt")
  fi
  echo "  Password: $ES_PASS"
  echo ""

  echo -e "${GREEN}🔐 Elasticsearch:${NC}"
  echo "  URL:      http://localhost:9200"
  echo "  Username: elastic"
  echo "  Password: $ES_PASS"
  echo ""

  echo -e "${GREEN}🔐 Prometheus:${NC}"
  echo "  URL:      http://localhost:9090"
  echo "  Username: (none - no auth)"
  echo "  Password: (none)"
  echo ""

  echo -e "${GREEN}🔐 Alertmanager:${NC}"
  echo "  URL:      http://localhost:9093"
  echo "  Username: (none - no auth)"
  echo "  Password: (none)"
  echo ""

  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${YELLOW}💡 Tip: You can also use 'make kuma-init-password' for Uptime-Kuma${NC}"
  echo ""
}

main
