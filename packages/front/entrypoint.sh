#!/bin/sh
set -e

CERT_DIR="/app/certs"
CERT_FILE="$CERT_DIR/vite.crt"
KEY_FILE="$CERT_DIR/vite.key"

mkdir -p "$CERT_DIR"

# Generate a self-signed cert if not present
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
  echo "🔐 Generating self-signed SSL certificate for Vite preview..."
  # Try to generate without interactive prompts
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/CN=localhost" 2>/dev/null || true

  chmod 644 "$CERT_FILE" 2>/dev/null || true
  chmod 600 "$KEY_FILE" 2>/dev/null || true
  echo "✅ Certificate created: $CERT_FILE"
else
  echo "🔐 Certificate already exists: $CERT_FILE"
fi

APP_DIST_DIR="/app/dist"

if [ ! -d "$APP_DIST_DIR" ]; then
  echo "❗ Dist folder not found at $APP_DIST_DIR. Building is expected at image build time. Falling back to pnpm preview."
  exec sh -c "pnpm preview --host 0.0.0.0 --port ${PORT:-3005}"
fi

HTTP_PORT="${PORT:-3005}"
HTTPS_PORT="3006"

echo "🚀 Starting bundled HTTP static server on port ${HTTP_PORT} (serving $APP_DIST_DIR)"

exec node /app/https-server.js --port "$HTTP_PORT"
