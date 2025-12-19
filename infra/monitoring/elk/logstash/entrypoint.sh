#!/bin/sh
set -e

echo "Logstash entrypoint starting..."
echo "VAULT_ADDR=$VAULT_ADDR"

# Retry logic for Vault connection
ATTEMPTS=0
MAX_ATTEMPTS=60
ELASTIC_PASS=""

echo "Fetching Elasticsearch password from Vault..."

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ] && [ -z "$ELASTIC_PASS" ]; do
  # Use curl to fetch secret from Vault
  VAULT_RESPONSE=$(curl -s \
    --header "X-Vault-Token: ${VAULT_TOKEN}" \
    "${VAULT_ADDR}/v1/secret/data/elasticsearch" 2>&1)
  
  # Extract password from JSON response
  ELASTIC_PASS=$(echo "$VAULT_RESPONSE" | grep -o '"password":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -n "$ELASTIC_PASS" ] && [ "$ELASTIC_PASS" != "" ]; then
    echo "Successfully retrieved Elasticsearch password from Vault"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    echo "Waiting for Vault... (attempt $ATTEMPTS/$MAX_ATTEMPTS)"
  fi
  sleep 1
done

if [ -z "$ELASTIC_PASS" ]; then
  echo "ERROR: Failed to fetch password from Vault after $MAX_ATTEMPTS attempts"
  echo "Vault must be accessible for Logstash to start securely"
  exit 1
fi

# Export credentials for Logstash pipeline
export ELASTICSEARCH_PASSWORD="$ELASTIC_PASS"
export ELASTICSEARCH_USERNAME="logstash_admin"

# Also set for pipeline configuration
export LOGSTASH_ELASTICSEARCH_USER="logstash_admin"
export LOGSTASH_ELASTICSEARCH_PASSWORD="$ELASTIC_PASS"

echo "Logstash configured with user: $ELASTICSEARCH_USERNAME"
echo "Starting Logstash..."

# Execute the original Logstash entrypoint
exec /usr/local/bin/docker-entrypoint