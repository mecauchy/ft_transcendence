#!/bin/sh
set -e

echo "Filebeat entrypoint starting..."
echo "Waiting for Elasticsearch to be ready..."

# Wait for Elasticsearch
ATTEMPTS=0
MAX_ATTEMPTS=120

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  # Check if Elasticsearch is responding
  if curl -s -f "http://elasticsearch:9200/_cluster/health" >/dev/null 2>&1; then
    echo "Elasticsearch is ready!"
    break
  fi
  
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    echo "Waiting for Elasticsearch... (attempt $ATTEMPTS/$MAX_ATTEMPTS)"
  fi
  sleep 2
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
  echo "ERROR: Elasticsearch not available after $MAX_ATTEMPTS attempts"
  exit 1
fi

# Fetch Elasticsearch password from Vault if available
if [ -n "$VAULT_ADDR" ] && [ -n "$VAULT_TOKEN" ]; then
  echo "Fetching Elasticsearch password from Vault..."
  
  VAULT_ATTEMPTS=0
  ELASTIC_PASS=""
  
  while [ $VAULT_ATTEMPTS -lt 30 ] && [ -z "$ELASTIC_PASS" ]; do
    VAULT_RESPONSE=$(curl -s \
      --header "X-Vault-Token: ${VAULT_TOKEN}" \
      "${VAULT_ADDR}/v1/secret/data/elasticsearch" 2>&1)
    
    ELASTIC_PASS=$(echo "$VAULT_RESPONSE" | grep -o '"password":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$ELASTIC_PASS" ]; then
      echo "Successfully retrieved Elasticsearch password from Vault"
      export ELASTICSEARCH_PASSWORD="$ELASTIC_PASS"
      break
    fi
    
    VAULT_ATTEMPTS=$((VAULT_ATTEMPTS + 1))
    sleep 1
  done
  
  if [ -z "$ELASTIC_PASS" ]; then
    echo "WARNING: Could not fetch password from Vault, using default"
    export ELASTICSEARCH_PASSWORD="${ELASTICSEARCH_PASSWORD:-changeme123}"
  fi
else
  echo "Vault not configured, using environment password"
  export ELASTICSEARCH_PASSWORD="${ELASTICSEARCH_PASSWORD:-changeme123}"
fi

echo "Starting Filebeat with user: elastic"

# Run filebeat with strict permissions disabled (needed for mounted config)
exec filebeat -e --strict.perms=false
