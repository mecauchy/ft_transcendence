#!/bin/bash
# Uptime-Kuma Password Helper
# This script retrieves the Uptime-Kuma admin password from Vault for manual login

set -e

VAULT_CONTAINER="vault"
VAULT_ADDR="http://vault:8200"

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    exit 1
fi

# Check if vault container is running
if ! docker ps | grep -q "$VAULT_CONTAINER"; then
    echo "❌ Vault container is not running"
    exit 1
fi

# Extract password from vault
echo "🔐 Retrieving Uptime-Kuma password from Vault..."
PASSWORD=$(docker exec vault vault kv get -field=password secret/kuma 2>/dev/null)

if [ -z "$PASSWORD" ]; then
    echo "❌ Failed to retrieve password from Vault"
    exit 1
fi

# Display login credentials
echo ""
echo "════════════════════════════════════════════════"
echo "   🎯 Uptime-Kuma Admin Credentials"
echo "════════════════════════════════════════════════"
echo ""
echo "URL:      http://localhost:3010"
echo "Username: kuma_admin"
echo "Password: $PASSWORD"
echo ""
echo "════════════════════════════════════════════════"
echo ""
echo "✅ Password copied to clipboard (if available)"
echo "   or displayed above"
echo ""

# Try to copy to clipboard if xclip is available
if command -v xclip &> /dev/null; then
    echo "$PASSWORD" | xclip -selection clipboard
    echo "✓ Password copied to clipboard!"
fi
