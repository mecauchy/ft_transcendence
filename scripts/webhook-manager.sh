#!/bin/bash

set -e
VAULT_ADDR=${VAULT_ADDR:-http://vault:8200}
# Resolve script directory and set secrets path idempotently (can be overridden by env)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
SECRETS_DIR="${SECRETS_DIR:-$SCRIPT_DIR/../infra/secret}"
# Normalize to absolute path if possible
if cd "$SECRETS_DIR" >/dev/null 2>&1; then
	SECRETS_DIR="$(pwd -P)"
else
	SECRETS_DIR="$(cd "$SCRIPT_DIR" >/dev/null 2>&1 && cd ../infra/secret 2>/dev/null && pwd -P || printf '%s' "$SECRETS_DIR")"
fi
WEBHOOK_FILE="${WEBHOOK_FILE:-$SECRETS_DIR/alertmanager_webhook.txt}"

# Create secrets directory if it doesn't exist
mkdir -p "$SECRETS_DIR"

case "$1" in
    save)
        # Save the Discord webhook URL to a local file
        if [ -z "$2" ]; then
            echo "❌ Usage: $0 save <webhook_url>"
            echo ""
            echo "Example:"
            echo "  $0 save 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN'"
            exit 1
        fi
        
        WEBHOOK_URL="$2"
        echo "$WEBHOOK_URL" > "$WEBHOOK_FILE"
        chmod 600 "$WEBHOOK_FILE"  # Restrict permissions to owner only
        echo "✅ Webhook URL saved to: $WEBHOOK_FILE"
        echo "📝 File permissions: 600 (owner read/write only)"
        
        # Also load it into Vault if containers are running
        if docker ps | grep -q vault; then
            echo "🔐 Loading webhook into Vault..."
            # Ensure the Vault CLI inside the container uses HTTP (the server is served over plain HTTP)
            docker exec vault env VAULT_ADDR=$VAULT_ADDR vault kv put secret/alertmanager discord_webhook_url="$WEBHOOK_URL" > /dev/null 2>&1
            echo "✅ Webhook loaded into Vault"
        fi
        ;;
        
    load)
        # Load the Discord webhook URL from local file to Vault
        if [ ! -f "$WEBHOOK_FILE" ]; then
            echo "❌ Webhook file not found: $WEBHOOK_FILE"
            echo "💡 Tip: Save it first with: $0 save '<webhook_url>'"
            exit 1
        fi
        
        WEBHOOK_URL=$(cat "$WEBHOOK_FILE")
        
        if [ -z "$WEBHOOK_URL" ]; then
            echo "❌ Webhook file is empty: $WEBHOOK_FILE"
            exit 1
        fi
        
        if ! docker ps | grep -q vault; then
            echo "❌ Vault container is not running"
            exit 1
        fi
        
        echo "🔐 Loading webhook from $WEBHOOK_FILE into Vault..."
        # Force the Vault CLI inside the container to connect using HTTP to avoid HTTPS mismatch
        docker exec vault env VAULT_ADDR=http://127.0.0.1:8200 vault kv put secret/alertmanager discord_webhook_url="$WEBHOOK_URL"
        echo "✅ Webhook loaded into Vault"
        ;;
        
    show)
        # Display the saved webhook URL (masked for security)
        if [ ! -f "$WEBHOOK_FILE" ]; then
            echo "❌ Webhook file not found: $WEBHOOK_FILE"
            exit 1
        fi
        
        WEBHOOK_URL=$(cat "$WEBHOOK_FILE")
        MASKED=$(echo "$WEBHOOK_URL" | sed 's/\(.*\/api\/webhooks\/\)\(.*\)/\1***MASKED***/g')
        echo "📋 Saved Webhook (masked): $MASKED"
        echo "📍 Full file location: $WEBHOOK_FILE"
        ;;
        
    path)
        # Just show the path
        echo "$WEBHOOK_FILE"
        ;;
        
    *)
        echo "🔑 Alertmanager Webhook Manager"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  save <url>    - Save Discord webhook URL locally (and to Vault if running)"
        echo "  load          - Load webhook from local file into Vault"
        echo "  show          - Show saved webhook (masked)"
        echo "  path          - Show file path where webhook is stored"
        echo ""
        echo "Examples:"
        echo "  $0 save 'https://discord.com/api/webhooks/123456/abcdef'"
        echo "  $0 load"
        echo "  $0 show"
        echo ""
        echo "Security Note:"
        echo "  - Webhook file is stored in: $SECRETS_DIR/"
        echo "  - Permissions set to 600 (owner read/write only)"
        echo "  - File is excluded from git (.gitignore)"
        exit 0
        ;;
esac
