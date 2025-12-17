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
# Prefer mounted secret file, then environment variable, then fallback (not recommended)
DEFAULT_TOKEN_FILE=${VAULT_TOKEN_FILE:-/run/secrets/vault_token}
if [ -f "$DEFAULT_TOKEN_FILE" ]; then
  VAULT_TOKEN="$(cat "$DEFAULT_TOKEN_FILE")"
  echo "Using Vault token from file: $DEFAULT_TOKEN_FILE"
elif [ -f "/tmp/vault_token" ]; then
  VAULT_TOKEN="$(cat "/tmp/vault_token")"
  echo "Using Vault token from /tmp/vault_token"
else
  VAULT_TOKEN="${VAULT_TOKEN:-}"
  if [ -z "$VAULT_TOKEN" ]; then
    echo "WARNING: No Vault token found (no secret file and VAULT_TOKEN unset). Requests to Vault will fail.";
  else
    echo "Using Vault token from VAULT_TOKEN environment variable (ensure this is not hardcoded)."
  fi
fi

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
