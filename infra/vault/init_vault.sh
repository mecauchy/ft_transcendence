#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

get_secret_content() {
	local file_path=$1
	if [ -f "${file_path}" ]; then 
		cat "${file_path}"
	else 
		echo "Error: Secret file not found at ${file_path}." >&2
		exit 1
	fi
}

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Initializing Vault for Development               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Wait for Vault to be ready
echo -e "${YELLOW} Waiting for Vault to be ready...${NC}"
for i in {1..30}; do
    if vault status > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Vault is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Vault failed to start!${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${YELLOW} Reading secrets from files...${NC}"

# Retrieve database passwords from infra/secrets/
POSTGRES_PASS=$(get_secret_content "/run/secrets/postgres_db_pass.txt")
AUTH_PASS=$(get_secret_content "/run/secrets/auth_db_pass.txt")
CHAT_PASS=$(get_secret_content "/run/secrets/chat_db_pass.txt")
GAME_PASS=$(get_secret_content "/run/secrets/game_db_pass.txt")
USER_PASS=$(get_secret_content "/run/secrets/user_db_pass.txt")
GRAFANA_PASS=$(get_secret_content "/run/secrets/grafana_pass.txt")

echo -e "${GREEN}✓ All secrets loaded${NC}"

# Check if engines are already enabled
echo ""
echo -e "${YELLOW}🔧 Configuring Vault engines...${NC}"

vault secrets list 2>/dev/null | grep -q "^secret/" || \
	(vault secrets enable -version=2 -path=secret kv && echo -e "${GREEN}✓ KV engine enabled${NC}") || \
	echo -e "${YELLOW}⚠ KV engine already enabled${NC}"

vault secrets list 2>/dev/null | grep -q "^database/" || \
	(vault secrets enable database && echo -e "${GREEN}✓ Database engine enabled${NC}") || \
	echo -e "${YELLOW}⚠ Database engine already enabled${NC}"

# --------------------------------------------------------------------------
# STATIC SECRETS (KV STORE) - Database Credentials
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW} Storing database credentials in Vault...${NC}"

# PostgreSQL root credentials
vault kv put secret/database/postgres \
	password="${POSTGRES_PASS}" \
	username="root_admin" \
	host="postgres" \
	port="5432" 2>/dev/null && \
	echo -e "${GREEN}✓ PostgreSQL root credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ PostgreSQL credentials already exist${NC}"

# Auth DB credentials
vault kv put secret/database/auth \
	password="${AUTH_PASS}" \
	username="auth_user" \
	host="postgres" \
	port="5432" \
	database="auth_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Auth DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Auth DB credentials already exist${NC}"

# Chat DB credentials
vault kv put secret/database/chat \
	password="${CHAT_PASS}" \
	username="chat_user" \
	host="postgres" \
	port="5432" \
	database="chat_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Chat DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Chat DB credentials already exist${NC}"

# Game DB credentials
vault kv put secret/database/game \
	password="${GAME_PASS}" \
	username="game_user" \
	host="postgres" \
	port="5432" \
	database="game_db" 2>/dev/null && \
	echo -e "${GREEN}✓ Game DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ Game DB credentials already exist${NC}"

# User DB credentials
vault kv put secret/database/user \
	password="${USER_PASS}" \
	username="user_user" \
	host="postgres" \
	port="5432" \
	database="user_db" 2>/dev/null && \
	echo -e "${GREEN}✓ User DB credentials stored${NC}" || \
	echo -e "${YELLOW}⚠ User DB credentials already exist${NC}"

# --------------------------------------------------------------------------
# POSTGRES DATABASE SECRETS ENGINE CONFIGURATION
#---------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}🗄️  Configuring PostgreSQL Database Engine...${NC}"

# 1. Configure the Database Secret Engine
vault write database/config/postgres \
	plugin_name=postgresql-database-plugin \
	connection_url="postgresql://{{username}}:{{password}}@postgres:5432/postgres?sslmode=disable" \
	username="root_admin" \
	password="${POSTGRES_PASS}" 2>/dev/null && \
	echo -e "${GREEN}✓ PostgreSQL database engine configured${NC}" || \
	echo -e "${YELLOW}⚠ PostgreSQL database engine already configured${NC}"

# 2. Create Roles for Dynamic Credentials
echo -e "${YELLOW} Creating database roles...${NC}"

# Auth Role
vault write database/roles/auth-role \
	db_name=postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"auth_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h" 2>/dev/null && \
	echo -e "${GREEN}✓ Auth role created${NC}" || \
	echo -e "${YELLOW}⚠ Auth role already exists${NC}"

vault kv put secret/grafana \
	username="grafana_admin" \
	password="${GRAFANA_PASS}"
echo -e "${GREEN}✓ Grafana credentials stored${NC}"

# Create token with all policies attached
vault token create -policy="auth-policy" -id="auth-token"
vault token create -policy="chat-policy" -id="chat-token"
vault token create -policy="game-policy" -id="game-token"
vault token create -policy="user-policy" -id="user-token"
vault token create -policy="postgres-policy" -id="postgres-token"
vault token create -policy="grafana-policy" -id="grafana-token"
echo -e "${GREEN}✓ Service tokens created${NC}"

# Enable APProle
vault auth enable approle

# AUTH SERVICE
# Define roles and bind policies
vault write auth/approle/role/auth-role \
	token_policies="auth-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Auth service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ Auth service AppRole already exists${NC}"

# Chat Service AppRole
vault write auth/approle/role/chat-role \
	token_policies="chat-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Chat service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ Chat service AppRole already exists${NC}"

# Game Service AppRole
vault write auth/approle/role/game-role \
	token_policies="game-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ Game service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ Game service AppRole already exists${NC}"

# User Service AppRole
vault write auth/approle/role/user-role \
	token_policies="user-policy" \
	token_ttl=1h \
	token_max_ttl=24h 2>/dev/null && \
	echo -e "${GREEN}✓ User service AppRole created${NC}" || \
	echo -e "${YELLOW}⚠ User service AppRole already exists${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ Vault initialization complete!                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW} Vault is ready with:${NC}"
echo "   • KV secret engine for static secrets"
echo "   • PostgreSQL database engine for dynamic credentials"
echo "   • AppRole authentication for services"
echo "   • Database credentials for all services"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "   1. Configure AppRole with RoleID and SecretID"
echo "   2. Deploy services with AppRole authentication"
echo "   3. Monitor secret rotation and token expiration"
