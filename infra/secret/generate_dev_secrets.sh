#!/usr/bin/env bash

# Generate secrets for development environment
# This script creates missing secret files with secure random passwords

set -e

SECRETS_DIR="$(dirname "$0")"
cd "$SECRETS_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Generating Development Secrets                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Array of required secret files
REQUIRED_SECRETS=(
    "postgres_db_pass.txt"
    "auth_db_pass.txt"
    "chat_db_pass.txt"
    "game_db_pass.txt"
    "user_db_pass.txt"
    "redis_password.txt"
	"grafana_pass.txt"
	"kuma_pass.txt"
	"vault_token.txt"
	"postgres_db_pass.txt"
	"redis_password.txt"
	"jwt_secret.txt"
)

# Counter for generated secrets
GENERATED=0
EXISTING=0

# Generate missing secrets
for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -f "$secret" ]; then
        echo -e "${GREEN}✓${NC} $secret already exists"
        EXISTING=$((EXISTING + 1))
    else
        # Generate a secure random password using base64
        openssl rand -base64 32 | tr -d '\n' > "$secret"
        chmod 600 "$secret"
        echo -e "${YELLOW}✓${NC} Generated $secret"
        GENERATED=$((GENERATED + 1))
    fi
done

# Set proper permissions on directory
chmod 700 .

echo ""
echo -e "${BLUE}Summary:${NC}"
echo -e "  ${GREEN}Existing secrets:${NC} $EXISTING"
echo -e "  ${YELLOW}Generated secrets:${NC} $GENERATED"

if [ $GENERATED -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠  New secrets created for DEVELOPMENT only!${NC}"
    echo -e "${YELLOW}   Do NOT use these in production.${NC}"
fi

echo ""
echo -e "${GREEN}✓ All secrets ready${NC}"
