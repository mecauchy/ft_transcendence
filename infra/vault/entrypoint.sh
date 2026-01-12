#!/bin/sh

# Start Vault server in the background
# Determine dev root token: prefer explicit VAULT_TOKEN_FILE, then common secret mounts,
# then VAULT_DEV_ROOT_TOKEN_ID env var; otherwise fail with a helpful message.
VAULT_TOKEN_FILE=${VAULT_TOKEN_FILE:-}
if [ -n "$VAULT_TOKEN_FILE" ] && [ -f "$VAULT_TOKEN_FILE" ]; then
  DEV_ROOT_TOKEN="$(cat "$VAULT_TOKEN_FILE")"
  echo "Using Vault dev root token from VAULT_TOKEN_FILE: $VAULT_TOKEN_FILE" 2>&1
elif [ -f "/run/secrets/vault_token" ]; then
  DEV_ROOT_TOKEN="$(cat /run/secrets/vault_token)"
  echo "Using Vault dev root token from /run/secrets/vault_token" 2>&1
elif [ -f "/run/secrets/vault_token.txt" ]; then
  DEV_ROOT_TOKEN="$(cat /run/secrets/vault_token.txt)"
  echo "Using Vault dev root token from /run/secrets/vault_token.txt" 2>&1
elif [ -f "/tmp/vault_token" ]; then
  DEV_ROOT_TOKEN="$(cat /tmp/vault_token)"
  echo "Using Vault dev root token from /tmp/vault_token" 2>&1
elif [ -n "${VAULT_DEV_ROOT_TOKEN_ID:-}" ]; then
  DEV_ROOT_TOKEN="$VAULT_DEV_ROOT_TOKEN_ID"
  echo "Using Vault dev root token from VAULT_DEV_ROOT_TOKEN_ID environment variable" 2>&1
else
  echo "error:		No Vault dev root token provided. Set VAULT_TOKEN_FILE, mount /run/secrets/vault_token, or set VAULT_DEV_ROOT_TOKEN_ID." 2>&1
  exit 1
fi

vault server -dev \
  -dev-listen-address=0.0.0.0:8200 \
  -dev-root-token-id="$DEV_ROOT_TOKEN" &

VAULT_PID=$!

# Wait for Vault to be ready
echo "" 2>&1
echo "Waiting for Vault to start..." 2>&1
# Export address so the CLI knows how to reach the dev server while we wait
export VAULT_ADDR="http://127.0.0.1:8200"
# Export token early so any init tooling can use it while Vault finishes startup
export VAULT_TOKEN="$DEV_ROOT_TOKEN"

sleep 1
i=1
while [ $i -le 60 ]; do
  if wget -q -O /dev/null http://127.0.0.1:8200/v1/sys/health 2>&1; then
    echo "✓ Vault started successfully" 2>&1
    break
  fi
  if [ $i -eq 60 ]; then
    echo "✗ Vault failed to start after 60 seconds" 2>&1
    echo "Attempting to continue anyway..." 2>&1
  fi
  sleep 1
  i=$((i+1))
done

# Set environment variables for init script
export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_SKIP_VERIFY="true"
# Remove VAULT_CACERT since we're using dev mode HTTP, not HTTPS
unset VAULT_CACERT
# Export token for convenience to init script and other local tooling
export VAULT_TOKEN="$DEV_ROOT_TOKEN"

# Run the initialization script
echo "" 2>&1
echo "Running Vault initialization script..." 2>&1
sh /init-vault.sh 2>&1

echo "" 2>&1
echo "Vault setup complete! All services initialized." 2>&1
echo "" 2>&1

# Keep the Vault process running in foreground
wait $VAULT_PID
