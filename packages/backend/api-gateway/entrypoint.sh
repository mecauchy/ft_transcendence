#!/bin/sh
if [ -f "/run/secrets/redis_password.txt" ]; then
	export REDIS_PASSWORD=$(cat /run/secrets/redis_password.txt)
fi
if [ -f "/tmp/vault_token" ]; then
	export VAULT_TOKEN=$(cat /tmp/vault_token)
fi
exec su-exec nodejs node dist/index.js
