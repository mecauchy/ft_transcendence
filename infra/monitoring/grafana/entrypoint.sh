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
  # Use wget with --no-check-certificate for HTTPS
  VAULT_RESPONSE=$(wget --quiet --output-document=- --no-check-certificate \
    --header="X-Vault-Token: ${VAULT_TOKEN}" \
    "${VAULT_ADDR}/v1/secret/data/grafana" 2>&1)
  
  # Extract password from JSON response
  GRAFANA_PASS=$(echo "$VAULT_RESPONSE" | grep -o '"password":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$GRAFANA_PASS" ] && [ "$GRAFANA_PASS" != "" ]; then
    echo "Successfully retrieved Grafana password from Vault"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    echo "Waiting for Vault... (attempt $ATTEMPTS/$MAX_ATTEMPTS)"
    if [ $ATTEMPTS -eq 10 ]; then
      echo "Debug: Response preview: $(echo "$VAULT_RESPONSE" | head -c 100)..."
    fi
  fi
  sleep 1
done

if [ -z "$GRAFANA_PASS" ]; then
  echo "error:		Failed to fetch Grafana password from Vault after $MAX_ATTEMPTS attempts"
  echo "Last Vault response: $VAULT_RESPONSE"
  exit 1
fi

# Set the environment variable
export GF_SECURITY_ADMIN_PASSWORD="$GRAFANA_PASS"
echo "Starting Grafana server..."

# Start Grafana
exec /run.sh "$@"
