#!/bin/bash
# Script d'initialisation automatique du dashboard Kibana
# Ce script importe automatiquement le dashboard pré-configuré au démarrage

set -e

KIBANA_HOST="${KIBANA_HOST:-localhost:5601}"
DASHBOARD_FILE="/usr/share/kibana/config/dashboards/ft-transcendence-logs.ndjson"
MAX_RETRIES=30
RETRY_INTERVAL=5

echo "🔄 Attente de Kibana sur ${KIBANA_HOST}..."

# Attendre que Kibana soit prêt
for i in $(seq 1 $MAX_RETRIES); do
    if curl -f -s "http://${KIBANA_HOST}/api/status" > /dev/null 2>&1; then
        echo "✅ Kibana est prêt!"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ Timeout: Kibana n'est pas accessible après ${MAX_RETRIES} tentatives"
        exit 1
    fi
    
    echo "⏳ Tentative ${i}/${MAX_RETRIES} - Kibana pas encore prêt, attente ${RETRY_INTERVAL}s..."
    sleep $RETRY_INTERVAL
done

# Attendre un peu plus pour que Kibana soit vraiment stable
sleep 5

echo "📊 Import du dashboard ft_transcendence..."

# Import du dashboard via l'API Kibana
RESPONSE=$(curl -X POST "http://${KIBANA_HOST}/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    --form file=@"${DASHBOARD_FILE}" \
    -w "\n%{http_code}" \
    -s)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Dashboard importé avec succès!"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Créer l'index pattern si nécessaire
    echo "🔍 Vérification de l'index pattern filebeat-*..."
    curl -X POST "http://${KIBANA_HOST}/api/data_views/data_view" \
        -H "kbn-xsrf: true" \
        -H "Content-Type: application/json" \
        -d '{
            "data_view": {
                "title": "filebeat-*",
                "timeFieldName": "@timestamp"
            }
        }' -s > /dev/null 2>&1 || echo "ℹ️  Index pattern déjà existant ou sera créé automatiquement"
    
    echo ""
    echo "🎉 Dashboard Kibana configuré avec succès!"
    echo "📍 Accès: http://localhost:5601"
    echo "📊 Dashboard: FT Transcendence - Logs Overview"
    echo ""
else
    echo "⚠️  Erreur lors de l'import (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
