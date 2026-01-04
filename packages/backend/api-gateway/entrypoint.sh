#!/bin/sh
set -e

# Load Vault secrets from Docker secrets directory if present
SECRETS_DIR=${SECRETS_DIR:-/run/secrets}

# Load JWT secret from file if JWT_SECRET_FILE is set
if [ -f "$SECRETS_DIR/jwt_secret.txt" ]; then
  export JWT_SECRET="$(cat "$SECRETS_DIR/jwt_secret.txt")"
fi

if [ -f "$SECRETS_DIR/vault_role_id" ]; then
  export VAULT_ROLE_ID="$(cat "$SECRETS_DIR/vault_role_id")"
fi

if [ -f "$SECRETS_DIR/vault_secret_id" ]; then
  export VAULT_SECRET_ID="$(cat "$SECRETS_DIR/vault_secret_id")"
fi

# Legacy/compat: support vault_token.txt used in dev secrets
if [ -f "$SECRETS_DIR/vault_token.txt" ]; then
  export VAULT_TOKEN="$(cat "$SECRETS_DIR/vault_token.txt")"
fi

# Load session secret for @fastify/session middleware
if [ -f "$SECRETS_DIR/session_secret" ]; then
  export SESSION_SECRET="$(cat "$SECRETS_DIR/session_secret" | tr -d '\n')"
fi

if [ "${NODE_ENV:-development}" = "production" ]; then
  if [ -z "$VAULT_ROLE_ID" ] || [ -z "$VAULT_SECRET_ID" ]; then
    echo "FATAL: VAULT_ROLE_ID and VAULT_SECRET_ID are required in production and were not provided via Docker secrets or environment" >&2
    exit 1
  fi
fi

# If su-exec is available, drop to the non-root user (nodejs) for the final command
if command -v su-exec >/dev/null 2>&1; then
  exec su-exec nodejs "$@"
else
  exec "$@"
fi
