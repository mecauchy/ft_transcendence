#!/bin/sh
set -e

# Paths definition
CERT_DIR="/etc/nginx/certs"
KEY_FILE="$CERT_DIR/nginx.key"
CERT_FILE="$CERT_DIR/nginx.crt"

echo "🔐 [WAF Entrypoint] Checking SSL Certificates"

# Check and install Openssl if not present
if ! command -v openssl >/dev/null 2>&1; then
	echo "⚠️  Openssl not found, installing..."
	apk add --no-cache openssl
fi

# Create directories if they don't exist
mkdir -p "$CERT_DIR" 2>/dev/null || true

# Generate self-signed SSL certificate if not present
if [ ! -f "$KEY_FILE" ] || [ ! -f "$CERT_FILE" ]; then
	echo "🔐 Generating self-signed SSL certificate for WAF..."
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout "$KEY_FILE" \
		-out "$CERT_FILE" \
		-subj "/C=FR/ST=Paris/L=Paris/O=SpeakUp/CN=localhost" 2>/dev/null || true
	
	# Set proper permissions (best effort)
	chmod 644 "$CERT_FILE" 2>/dev/null || true
	chmod 600 "$KEY_FILE" 2>/dev/null || true
	echo "✅ Self-signed SSL certificate generated."
else
	echo "✅ SSL certificate already exists."
fi

# Start Nginx with ModSecurity, skipping entrypoint which tries to write to read-only fs
echo "🚀 Starting Nginx with ModSecurity WAF..."

# Use the default modsecurity rule file if ours wasn't mounted
if [ ! -f /etc/nginx/modsecurity.conf ]; then
	echo "⚠️  Custom modsecurity.conf not found, using defaults"
fi

exec nginx -g 'daemon off;'

