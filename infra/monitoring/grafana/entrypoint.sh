#!/bin/sh

echo "Grafana entrypoint starting..."
echo "VAULT_ADDR=$VAULT_ADDR"
echo "VAULT_TOKEN=$VAULT_TOKEN"

# Fetch Grafana password from Vault
echo "Fetching Grafana password from Vault..."

# Retry logic for Vault connection
ATTEMPTS=0
MAX_ATTEMPTS=60
VAULT_RESPONSE=""
GRAFANA_PASS=""

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ] && [ -z "$GRAFANA_PASS" ]; do
  VAULT_RESPONSE=$(curl -s -k \
    -H "X-Vault-Token: ${VAULT_TOKEN}" \
    "${VAULT_ADDR}/v1/secret/data/grafana")
  
  # Extract password using sed (compatible with BusyBox)
  GRAFANA_PASS=$(echo "$VAULT_RESPONSE" | sed -n 's/.*"password":"\([^"]*\)".*/\1/p')
  
  if [ -n "$GRAFANA_PASS" ]; then
    echo "Successfully retrieved Grafana password from Vault"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    echo "Waiting for Vault... (attempt $ATTEMPTS/$MAX_ATTEMPTS)"
    echo "Last response: $VAULT_RESPONSE"
  fi
  sleep 1
done

if [ -z "$GRAFANA_PASS" ]; then
  echo "Error: Failed to fetch Grafana password from Vault after $MAX_ATTEMPTS attempts"
  echo "Last Vault response: $VAULT_RESPONSE"
  exit 1
fi

# Set the environment variable
export GF_SECURITY_ADMIN_PASSWORD="$GRAFANA_PASS"
echo "Starting Grafana server..."

# Start Grafana
exec /run.sh "$@"
