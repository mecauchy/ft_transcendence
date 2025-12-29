#!/bin/sh
if [ -f "/run/secrets/postgres_db_pass.txt" ]; then
	export DB_PASSWORD=$(cat /run/secrets/postgres_db_pass.txt)
fi
if [ -f "/tmp/vault_token" ]; then
	export VAULT_TOKEN=$(cat /tmp/vault_token)
fi
exec su-exec nodejs node dist/index.js
