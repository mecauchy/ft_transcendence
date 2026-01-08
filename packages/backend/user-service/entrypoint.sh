#!/bin/sh
# Read secrets as root before switching to nodejs user
if [ -f "/run/secrets/postgres_db_pass.txt" ]; then
	DB_PASSWORD=$(cat /run/secrets/postgres_db_pass.txt)
	export DB_PASSWORD
fi
if [ -f "/run/secrets/redis_password.txt" ]; then
	REDIS_PASSWORD=$(cat /run/secrets/redis_password.txt)
	export REDIS_PASSWORD
fi
if [ -f "/tmp/vault_token" ]; then
	VAULT_TOKEN=$(cat /tmp/vault_token)
	export VAULT_TOKEN
fi
# Use exec with environment variables preserved
exec su-exec nodejs sh -c 'export DB_PASSWORD="'"$DB_PASSWORD"'" VAULT_TOKEN="'"$VAULT_TOKEN"'" REDIS_PASSWORD="'"$REDIS_PASSWORD"'" && node dist/index.js'
