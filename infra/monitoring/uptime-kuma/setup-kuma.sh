#!/bin/bash

# Uptime-Kuma Setup Script
DB="/app/data/kuma.db"

log_info() { echo "ℹ️  $1"; }
log_success() { echo "✓ $1"; }
log_error() { echo "✗ $1"; }

log_info "Uptime-Kuma setup..."

# The password comes in via KUMA_ADMIN_PASSWORD env var (passed via docker exec -e)
# Write to temp file first to pass through to the script
echo "${KUMA_ADMIN_PASSWORD}" > /tmp/.kuma_pass

ADMIN_USER="${KUMA_ADMIN_USER:-kuma_admin}"
ADMIN_PASS=$(cat /tmp/.kuma_pass)

[ -z "$ADMIN_PASS" ] && { log_error "No password provided"; rm -f /tmp/.kuma_pass; exit 0; }

# Use Node to hash the password via environment variable
HASHED=$(KUMA_ADMIN_PASSWORD="$ADMIN_PASS" node -e "const bcryptjs = require('bcryptjs'); const password = process.env.KUMA_ADMIN_PASSWORD; const salt = bcryptjs.genSaltSync(10); console.log(bcryptjs.hashSync(password, salt));" 2>/dev/null) || {
    log_error "Hash failed"
    exit 0
}

if [ -z "$HASHED" ]; then
    log_error "Hash failed"
    exit 0
fi

# Check if user exists
USER_EXISTS=$(sqlite3 "$DB" "SELECT id FROM user WHERE username = '$ADMIN_USER';" 2>/dev/null)

if [ -z "$USER_EXISTS" ]; then
    # Insert new user
    sqlite3 "$DB" "INSERT INTO user (username, password, active) VALUES ('$ADMIN_USER', '$HASHED', 1);" 2>/dev/null
    [ $? -eq 0 ] && log_success "User created" || { log_error "User creation failed"; exit 0; }
else
    # Update existing user
    sqlite3 "$DB" "UPDATE user SET password = '$HASHED' WHERE username = '$ADMIN_USER';" 2>/dev/null
    [ $? -eq 0 ] && log_success "Password set" || { log_error "Password update failed"; exit 0; }
fi

# Get user ID
ADMIN_ID=$(sqlite3 "$DB" "SELECT id FROM user WHERE username = '$ADMIN_USER';" 2>/dev/null)
[ -z "$ADMIN_ID" ] && { log_error "User ID not found"; exit 0; }

log_info "User ID: $ADMIN_ID"

# Add monitors
COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM monitor;" 2>/dev/null || echo 0)

if [ "$COUNT" -eq 0 ]; then
    log_info "Adding monitors..."
    
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, url, type, interval, active) VALUES ($ADMIN_ID, 'API Gateway', 'http://api-gateway:3000/health', 'http', 60, 1);"
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, hostname, port, type, interval, active) VALUES ($ADMIN_ID, 'PostgreSQL', 'postgres', 5432, 'port', 60, 1);"
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, hostname, port, type, interval, active) VALUES ($ADMIN_ID, 'Redis', 'redis', 6379, 'port', 60, 1);"
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, url, type, interval, active) VALUES ($ADMIN_ID, 'Prometheus', 'http://prometheus:9090/-/healthy', 'http', 60, 1);"
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, url, type, interval, active) VALUES ($ADMIN_ID, 'Alertmanager', 'http://alertmanager:9093/-/healthy', 'http', 60, 1);"
    sqlite3 "$DB" "INSERT INTO monitor (user_id, name, url, type, interval, active) VALUES ($ADMIN_ID, 'Grafana', 'http://grafana:3000/api/health', 'http', 60, 1);"

    log_success "All monitors added"
fi

# Remove WAF monitor if it exists
sqlite3 "$DB" "DELETE FROM monitor WHERE name = 'WAF';" 2>/dev/null

log_success "Setup complete"
