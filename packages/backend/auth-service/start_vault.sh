#!/bin/sh

# This script mimics the "Vault Agent" behavior

# 1. Authenticate with Vault (via .env but AppRole could be used here)
export VAULT_TOKEN=root_token_dev_only

# 2. Fetch secrets into temporary env variables
echo "Fetching secrets from Vault..."

DB_PASS=$(curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
	http://vault:8200/v1/secret/data/auth-service | jq -r '.data.data.password')

OAUTH_SECRET=$(curl -s --header "X-Vault-Token: $VAULT_TOKEN" \
	http://vault:8200/v1/secret/data/auth-service | jq -r '.data.data.secret')

# 3. Export secrets as environment variables for the application
export DB_PASS=$DB_PASS
export OAUTH_SECRET=$OAUTH_SECRET

# 4. Start the authentication service
echo "Starting authentication service..."
exec pnpm start
