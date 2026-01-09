#!/bin/sh
# Entrypoint pour Alertmanager
# Récupère le webhook Discord depuis Vault et remplace le placeholder dans la config

set -e

echo "=== Alertmanager Entrypoint ==="

# Load Vault token from file
if [ -f "${VAULT_TOKEN_FILE}" ]; then
    export VAULT_TOKEN=$(cat "${VAULT_TOKEN_FILE}" | tr -d '\n')
    echo "Vault token loaded from ${VAULT_TOKEN_FILE}"
else
    echo "ERREUR: Vault token file not found at ${VAULT_TOKEN_FILE}"
    exit 1
fi

echo "Récupération du webhook Discord depuis Vault..."

# Read vault token from file if provided
if [ -n "$VAULT_TOKEN_FILE" ] && [ -f "$VAULT_TOKEN_FILE" ]; then
    VAULT_TOKEN=$(cat "$VAULT_TOKEN_FILE")
    echo "Loaded VAULT_TOKEN from $VAULT_TOKEN_FILE"
fi

# Attendre que Vault soit disponible (utiliser wget car curl n'est pas dispo)
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if wget -q -O /dev/null "${VAULT_ADDR}/v1/sys/health" 2>/dev/null; then
        echo "Vault est accessible!"
        break
    fi
    echo "Attente de Vault... ($RETRY_COUNT/$MAX_RETRIES)"
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERREUR: Vault n'est pas accessible après $MAX_RETRIES tentatives"
    exit 1
fi

# Récupérer le webhook Discord depuis Vault avec retry
# Le webhook peut ne pas être chargé immédiatement après le démarrage de Vault
echo "Fetching webhook from Vault (with retry)..."
WEBHOOK_RETRIES=60
WEBHOOK_COUNT=0
DISCORD_WEBHOOK=""

while [ $WEBHOOK_COUNT -lt $WEBHOOK_RETRIES ] && [ -z "$DISCORD_WEBHOOK" ]; do
    VAULT_RESPONSE=$(wget -q -O - \
        --header="X-Vault-Token: ${VAULT_TOKEN}" \
        "${VAULT_ADDR}/v1/secret/data/alertmanager" 2>&1 || echo "")
    
    DISCORD_WEBHOOK=$(echo "$VAULT_RESPONSE" | sed -n 's/.*"discord_webhook_url":"\([^"]*\)".*/\1/p')
    
    if [ -n "$DISCORD_WEBHOOK" ]; then
        break
    fi
    
    WEBHOOK_COUNT=$((WEBHOOK_COUNT + 1))
    if [ $((WEBHOOK_COUNT % 10)) -eq 0 ]; then
        echo "Waiting for webhook in Vault... ($WEBHOOK_COUNT/$WEBHOOK_RETRIES)"
    fi
    sleep 2
done

if [ -z "$DISCORD_WEBHOOK" ]; then
    echo "WARNING: Could not retrieve Discord webhook from Vault after $WEBHOOK_RETRIES attempts"
    echo "Alertmanager will start without Discord notifications"
    echo "To enable notifications, add webhook via: ./scripts/webhook-manager.sh save '<url>'"
    # Use a placeholder that won't break the config but won't send real notifications
    DISCORD_WEBHOOK="https://discord.com/api/webhooks/disabled/placeholder"
fi

echo "Alertmanager configuration ready!"

# Créer le fichier de config avec le webhook
cp /etc/alertmanager/alertmanager.yml /tmp/alertmanager.yml

# Remplacer le placeholder par le vrai webhook
sed -i "s|VAULT_DISCORD_WEBHOOK_PLACEHOLDER|${DISCORD_WEBHOOK}|g" /tmp/alertmanager.yml

echo "Configuration mise à jour avec le webhook Discord"

# Démarrer Alertmanager avec la config modifiée
echo "Démarrage d'Alertmanager..."
exec /bin/alertmanager \
    --config.file=/tmp/alertmanager.yml \
    --storage.path=/alertmanager \
    --web.external-url=http://localhost:9093 \
    "$@"
