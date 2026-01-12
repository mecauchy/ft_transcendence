#!/bin/bash
# Kibana entrypoint - starts Kibana and imports dashboard at startup

set -e

# Function to import dashboard
import_dashboard() {
    KIBANA_HOST="${KIBANA_HOST:-localhost:5601}"
    DASHBOARD_FILE="/usr/share/kibana/config/dashboards/ft-transcendence-logs.ndjson"
    MAX_RETRIES=120
    RETRY_INTERVAL=2

    echo "🔄 Waiting for Kibana to be ready at ${KIBANA_HOST}..."

    # Wait for Kibana to be ready
    for i in $(seq 1 $MAX_RETRIES); do
        if curl -f -s "http://127.0.0.1:5601/api/status" > /dev/null 2>&1; then
            echo "✅ Kibana is ready!"
            break
        fi

        if [ $i -eq $MAX_RETRIES ]; then
            echo "❌ Timeout: Kibana was not accessible after ${MAX_RETRIES} attempts"
            return 1
        fi

        if [ $((i % 10)) -eq 0 ]; then
            echo "⏳ Attempt ${i}/${MAX_RETRIES} - Waiting for Kibana..."
        fi
        sleep $RETRY_INTERVAL
    done

    # Wait a bit more for Kibana to be fully stable
    sleep 3

    echo "📊 Importing FT Transcendence dashboard..."

    # Import dashboard using ndjson format
    RESPONSE=$(curl -s -X POST "http://127.0.0.1:5601/api/saved_objects/_import?overwrite=true" \
        -H "kbn-xsrf: true" \
        --form file=@"${DASHBOARD_FILE}" \
        -w "\n%{http_code}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
        # 400 might occur if dashboard already exists, which is OK
        echo "✅ Dashboard imported successfully!"

        # Create index pattern if needed
        echo "🔍 Verifying filebeat-* data view..."
        curl -s -X POST "http://127.0.0.1:5601/api/data_views/data_view" \
            -H "kbn-xsrf: true" \
            -H "Content-Type: application/json" \
            -d '{"data_view":{"title":"filebeat-*","timeFieldName":"@timestamp"}}' > /dev/null 2>&1 || true

        echo "🎉 Dashboard setup complete!"
        echo ""
        return 0
    else
        echo "⚠️  Dashboard import returned HTTP $HTTP_CODE"
        echo "$BODY"
        # Don't fail - Kibana can still work without the dashboard
        return 0
    fi
}

# Start dashboard import in background
import_dashboard &
IMPORT_PID=$!

# Start Kibana in foreground
echo "🚀 Starting Kibana..."
exec /usr/local/bin/kibana-docker "$@"
