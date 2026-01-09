#!/usr/bin/env bash

# Generate secrets for development environment
# This script creates missing secret files with secure random passwords

set -e

SECRETS_DIR="$(dirname "$0")" # append ../../infra/secret to get full path
SECRETS_DIR="$(realpath "$SECRETS_DIR/../infra/secret")"
mkdir -p "$SECRETS_DIR"
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
    "jwt_secret.txt"
    "session_secret.txt"
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
        echo -e "${YELLOW}✓${NC} Generated $secret"
        GENERATED=$((GENERATED + 1))
    fi
done

# Handle OAuth secrets separately (require user input or use placeholders)
OAUTH_SECRETS=("oauth_client_id.txt" "oauth_client_secret.txt")

for oauth_secret in "${OAUTH_SECRETS[@]}"; do
    if [ -f "$oauth_secret" ]; then
        # Check if it's just a placeholder
        content=$(cat "$oauth_secret" 2>/dev/null | tr -d '[:space:]')
        if [ "$content" = "YOUR_42_CLIENT_ID_HERE" ] || [ "$content" = "YOUR_42_CLIENT_SECRET_HERE" ] || [ -z "$content" ]; then
            echo -e "${YELLOW}⚠${NC} $oauth_secret exists but contains placeholder value"
        else
            echo -e "${GREEN}✓${NC} $oauth_secret already exists"
        fi
        EXISTING=$((EXISTING + 1))
    else
        # Create placeholder file
        if [ "$oauth_secret" = "oauth_client_id.txt" ]; then
            echo -n "YOUR_42_CLIENT_ID_HERE" > "$oauth_secret"
        else
            echo -n "YOUR_42_CLIENT_SECRET_HERE" > "$oauth_secret"
        fi
        chmod 600 "$oauth_secret"
        echo -e "${YELLOW}✓${NC} Created placeholder for $oauth_secret"
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
