#!/bin/sh
set -e

echo "Logstash entrypoint starting..."
echo "VAULT_ADDR=$VAULT_ADDR"

# Read vault token from file if provided
if [ -n "$VAULT_TOKEN_FILE" ] && [ -f "$VAULT_TOKEN_FILE" ]; then
    VAULT_TOKEN=$(cat "$VAULT_TOKEN_FILE")
    echo "Loaded VAULT_TOKEN from $VAULT_TOKEN_FILE"
fi

# For development: Elasticsearch security is disabled, no password needed
# If security is enabled, fetch from Vault
if [ -n "$VAULT_TOKEN" ] && [ "$VAULT_TOKEN" != "root_token_dev_only" ]; then
    echo "Fetching Elasticsearch password from Vault..."
    ATTEMPTS=0
    MAX_ATTEMPTS=60
    ELASTIC_PASS=""

    while [ $ATTEMPTS -lt $MAX_ATTEMPTS ] && [ -z "$ELASTIC_PASS" ]; do
        VAULT_RESPONSE=$(curl -s \
            --header "X-Vault-Token: ${VAULT_TOKEN}" \
            "${VAULT_ADDR}/v1/secret/data/elasticsearch" 2>&1)
        
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
        echo "WARNING: Could not fetch password from Vault, continuing without auth"
    fi

    export ELASTICSEARCH_PASSWORD="$ELASTIC_PASS"
    export ELASTICSEARCH_USERNAME="logstash_admin"
else
    echo "Development mode: Elasticsearch security disabled, no password needed"
fi

echo "Starting Logstash..."

# Execute the original Logstash entrypoint
exec /usr/local/bin/docker-entrypoint