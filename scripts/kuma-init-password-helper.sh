#!/bin/bash
# Helper script to set Uptime-Kuma password from Vault

KUMA_PASS=$(docker exec vault vault kv get -field=password secret/kuma 2>/dev/null)

if [ -z "$KUMA_PASS" ]; then
    echo "✗ Failed to retrieve password from Vault"
    exit 1
fi

# Run setup with password from stdin
echo "$KUMA_PASS" | docker exec -i uptime-kuma bash << 'EOF'
ADMIN_PASS=$(cat)
export KUMA_ADMIN_PASSWORD="$ADMIN_PASS"
bash /setup-kuma.sh
EOF
