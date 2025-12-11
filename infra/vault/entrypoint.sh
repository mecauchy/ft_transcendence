#!/bin/sh

# Start Vault server in the background
vault server -dev \
  -dev-listen-address=0.0.0.0:8200 \
  -dev-root-token-id=root_token_dev_only &

VAULT_PID=$!

# Wait for Vault to be ready
echo "" 2>&1
echo "Waiting for Vault to start..." 2>&1
sleep 3
for i in $(seq 1 30); do
  if vault status > /dev/null 2>&1; then
    echo "✓ Vault started successfully" 2>&1
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ Vault failed to start after 30 seconds" 2>&1
    exit 1
  fi
  sleep 1
done

# Set environment variables for init script
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="root_token_dev_only"

# Run the initialization script
echo "" 2>&1
echo "Running Vault initialization script..." 2>&1
sh /init-vault.sh 2>&1

echo "" 2>&1
echo "Vault setup complete! All services initialized." 2>&1
echo "" 2>&1

# Keep the Vault process running in foreground
wait $VAULT_PID
