#!/bin/sh
set -e

echo "Filebeat entrypoint starting..."
echo "Waiting for Elasticsearch to be ready..."

# Wait for Elasticsearch
ATTEMPTS=0
MAX_ATTEMPTS=60

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  if curl -s -f "http://elasticsearch:9200/_cluster/health" >/dev/null 2>&1; then
    echo "Elasticsearch is ready!"
    break
  fi

  ATTEMPTS=$((ATTEMPTS + 1))
  if [ $((ATTEMPTS % 10)) -eq 0 ]; then
    echo "Waiting for Elasticsearch... (attempt $ATTEMPTS/$MAX_ATTEMPTS)"
  fi
  sleep 2
done

if [ $ATTEMPTS -eq $MAX_ATTEMPTS ]; then
  echo "ERROR: Elasticsearch not available after $MAX_ATTEMPTS attempts"
  exit 1
fi

echo "Starting Filebeat (no authentication - ES security disabled)..."

# Run filebeat with strict permissions disabled (needed for mounted config)
exec filebeat -e --strict.perms=false
