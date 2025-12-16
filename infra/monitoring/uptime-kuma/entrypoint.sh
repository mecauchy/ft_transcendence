#!/bin/sh

echo "Uptime-Kuma entrypoint starting..."

# Fetch Uptime-Kuma password from Vault
echo "Fetching Uptime-Kuma admin password from Vault..."

# Retry logic for Vault connection
ATTEMPTS=0
MAX_ATTEMPTS=60
VAULT_RESPONSE=""
KUMA_PASS=""

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root_token_dev_only}"

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ] && [ -z "$KUMA_PASS" ]; do
  VAULT_RESPONSE=$(curl -s -k \
    --header "X-Vault-Token: ${VAULT_TOKEN}" \
    "${VAULT_ADDR}/v1/secret/data/kuma" 2>&1)
  
  KUMA_PASS=$(echo "$VAULT_RESPONSE" | grep -o '"password":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$KUMA_PASS" ] && [ "$KUMA_PASS" != "" ]; then
    echo "Successfully retrieved Uptime-Kuma password from Vault"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 1
done

if [ -z "$KUMA_PASS" ]; then
  echo "Warning: Failed to fetch password, proceeding anyway"
  KUMA_PASS="changeme"
fi

# Export for use later
export KUMA_ADMIN_USER="kuma_admin"
export KUMA_ADMIN_PASSWORD="$KUMA_PASS"

echo "Starting Uptime-Kuma server..."

# Start setup script in background after a delay (to allow database tables to be created)
(
  sleep 5
  if [ -n "$KUMA_PASS" ] && [ "$KUMA_PASS" != "changeme" ]; then
    echo "Running Uptime-Kuma setup script..."
    bash /setup-kuma.sh
  fi
) &

# Start the server normally
exec node server/server.js
