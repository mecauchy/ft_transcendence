#!/bin/sh
if [ -f "/run/secrets/postgres_db_pass.txt" ]; then
	export DB_PASSWORD=$(cat /run/secrets/postgres_db_pass.txt)
fi
if [ -f "/tmp/vault_token" ]; then
	export VAULT_TOKEN=$(cat /tmp/vault_token)
	
	# Fetch 42 OAuth credentials from Vault
	OAUTH_DATA=$(wget -q -O- --header "X-Vault-Token: $VAULT_TOKEN" http://vault:8200/v1/secret/data/oauth/42 2>/dev/null)
	if [ $? -eq 0 ] && [ -n "$OAUTH_DATA" ]; then
		export OAUTH_42_CLIENT_ID=$(echo "$OAUTH_DATA" | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
		export OAUTH_42_CLIENT_SECRET=$(echo "$OAUTH_DATA" | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)
		export OAUTH_42_REDIRECT_URI="https://localhost:8443/api/auth/callback/42"
	fi
fi
exec su-exec nodejs node dist/index.js
