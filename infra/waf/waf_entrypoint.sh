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
	if command -v apk >/dev/null 2>&1; then
		apk add --no-cache openssl
	elif command -v apt-get >/dev/null 2>&1; then
		apt-get update && apt-get install -y openssl
	fi
fi

# Check and install curl if not present (required for healthcheck)
if ! command -v curl >/dev/null 2>&1; then
	echo "⚠️  curl not found, installing..."
	if command -v apk >/dev/null 2>&1; then
		apk add --no-cache curl
	elif command -v apt-get >/dev/null 2>&1; then
		apt-get update && apt-get install -y curl
	fi
fi

# Create directories if they don't exist
mkdir -p "$CERT_DIR" 2>/dev/null || true

# Auto-discover existing cert/key pairs in the cert dir.
# Preferred names are nginx.crt/nginx.key (already used). If not present,
# look for common alternatives produced by mkcert or other tools and link them.
if [ -f "$KEY_FILE" ] && [ -f "$CERT_FILE" ]; then
	echo "✅ SSL certificate already exists: $CERT_FILE"
else
	# Look for matching pairs in the cert directory
	FOUND_CERT=""
	FOUND_KEY=""
	for base in nginx localhost vite server; do
		if [ -f "$CERT_DIR/${base}.crt" ] && [ -f "$CERT_DIR/${base}.key" ]; then
			FOUND_CERT="$CERT_DIR/${base}.crt"
			FOUND_KEY="$CERT_DIR/${base}.key"
			break
		fi
	done

	# Generic search: find any .crt with a corresponding .key
	if [ -z "$FOUND_CERT" ]; then
		for crt in "$CERT_DIR"/*.crt "$CERT_DIR"/*.pem; do
			[ -e "$crt" ] || continue
			key="${crt%.*}.key"
			if [ -f "$key" ]; then
				FOUND_CERT="$crt"
				FOUND_KEY="$key"
				break
			fi
		done
	fi

	if [ -n "$FOUND_CERT" ] && [ -n "$FOUND_KEY" ]; then
		echo "🔐 Found existing cert pair: $FOUND_CERT & $FOUND_KEY — linking to nginx.crt/nginx.key"
		# Copy (not symlink) so user-mounted read-only files are preserved; overwrite if necessary
		cp -f "$FOUND_CERT" "$CERT_FILE"
		cp -f "$FOUND_KEY" "$KEY_FILE"
		chmod 644 "$CERT_FILE" 2>/dev/null || true
		chmod 600 "$KEY_FILE" 2>/dev/null || true
		echo "✅ Installed user-provided certificate."
	else
		echo "🔐 No existing cert pair found — generating self-signed SSL certificate for WAF..."
		openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
			-keyout "$KEY_FILE" \
			-out "$CERT_FILE" \
			-subj "/C=FR/ST=Paris/L=Paris/O=SpeakUp/CN=localhost" 2>/dev/null || true
		chmod 644 "$CERT_FILE" 2>/dev/null || true
		chmod 600 "$KEY_FILE" 2>/dev/null || true
		echo "✅ Self-signed SSL certificate generated."
	fi
fi

# Start Nginx with ModSecurity, skipping entrypoint which tries to write to read-only fs
echo "🚀 Starting Nginx with ModSecurity WAF..."

# Use the default modsecurity rule file if ours wasn't mounted
if [ ! -f /etc/nginx/modsecurity.conf ]; then
	echo "⚠️  Custom modsecurity.conf not found, using defaults"
fi

exec nginx -g 'daemon off;'
