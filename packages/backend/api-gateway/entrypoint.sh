#!/bin/sh
if [ -f "/tmp/vault_token" ]; then
	export VAULT_TOKEN=$(cat /tmp/vault_token)
fi
exec su-exec nodejs node dist/index.js
