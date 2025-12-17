#!/bin/bash

# Uptime-Kuma Initialization Script
# This script is called BEFORE the server starts
# We'll use a Node script to properly hash passwords with bcrypt

DB="/app/data/kuma.db"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✓ $1"
}

log_error() {
    echo "✗ $1"
}

# Wait for database to be ready
wait_for_db() {
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if sqlite3 "$DB" "SELECT 1;" &>/dev/null; then
            log_success "Database is ready"
            return 0
        fi
        attempts=$((attempts + 1))
        sleep 1
    done
    
    log_error "Database not ready after $max_attempts attempts"
    return 1
}

# Create admin user using Node/bcryptjs
create_admin_user_with_node() {
    local username=$1
    local password=$2
    
    # Use Node to hash password with bcryptjs
    local hashed_pw=$(node -e "
        try {
            const bcryptjs = require('bcryptjs');
            const salt = bcryptjs.genSaltSync(10);
            const hash = bcryptjs.hashSync('$password', salt);
            console.log(hash);
        } catch(e) {
            console.log('');
        }
    " 2>/dev/null)
    
    if [ -z "$hashed_pw" ]; then
        log_error "Failed to hash password with bcryptjs"
        return 1
    fi
    
    # Check if user already exists
    local user_exists=$(sqlite3 "$DB" "SELECT COUNT(*) FROM user WHERE username = '$username';" 2>/dev/null || echo "0")
    
    if [ "$user_exists" -eq 0 ]; then
        # Create admin user
        sqlite3 "$DB" "INSERT INTO user (username, password) VALUES ('$username', '$hashed_pw');" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_success "Admin user '$username' created"
            return 0
        else
            log_error "Failed to create admin user"
            return 1
        fi
    else
        log_info "Admin user '$username' already exists"
        # Update password
        sqlite3 "$DB" "UPDATE user SET password = '$hashed_pw' WHERE username = '$username';" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_success "Password updated for user '$username'"
            return 0
        else
            log_error "Failed to update password"
            return 1
        fi
    fi
}

# Add monitor to database
add_monitor() {
    local user_id=$1
    local name=$2
    local url=$3
    local type=$4
    local interval=$5
    
    # Check if monitor already exists
    local exists=$(sqlite3 "$DB" "SELECT COUNT(*) FROM monitor WHERE name = '$name';" 2>/dev/null || echo "0")
    
    if [ "$exists" -eq 0 ]; then
        sqlite3 "$DB" "INSERT INTO monitor (user_id, name, url, type, interval, active) VALUES ($user_id, '$name', '$url', '$type', $interval, 1);" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_success "$name"
            return 0
        else
            log_error "$name"
            return 1
        fi
    else
        log_info "$name (already configured)"
        return 0
    fi
}

# Get user ID by username
get_user_id() {
    local username=$1
    sqlite3 "$DB" "SELECT id FROM user WHERE username = '$username';" 2>/dev/null
}

# ============================================================================
# Main Execution
# ============================================================================

log_info "Starting Uptime-Kuma initialization..."

# Wait for database
if ! wait_for_db; then
    log_error "Cannot proceed without database"
    exit 0  # Don't fail completely, just skip initialization
fi

# Get credentials from environment (set by entrypoint.sh from Vault)
ADMIN_USERNAME="${KUMA_ADMIN_USER:-kuma_admin}"
ADMIN_PASSWORD="${KUMA_ADMIN_PASSWORD:-}"

if [ -z "$ADMIN_PASSWORD" ]; then
    log_error "KUMA_ADMIN_PASSWORD not set"
    exit 0  # Don't fail, let server start anyway
fi

log_info "Creating/updating admin user..."
if ! create_admin_user_with_node "$ADMIN_USERNAME" "$ADMIN_PASSWORD"; then
    log_error "Continuing anyway..."
fi

# Get the admin user ID
ADMIN_USER_ID=$(get_user_id "$ADMIN_USERNAME")

if [ -z "$ADMIN_USER_ID" ]; then
    log_error "Failed to retrieve admin user ID"
    exit 0  # Don't fail, let server start anyway
fi

log_info "Admin user ID: $ADMIN_USER_ID"

# Add monitors only if not already configured
MONITOR_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM monitor;" 2>/dev/null || echo "0")

if [ "$MONITOR_COUNT" -eq 0 ]; then
    log_info "Adding monitors to database..."
    
    add_monitor "$ADMIN_USER_ID" "API Gateway" "http://api-gateway:3000/health" "http" 60
    add_monitor "$ADMIN_USER_ID" "PostgreSQL" "postgres:5432" "ping" 60
    add_monitor "$ADMIN_USER_ID" "Redis" "redis:6379" "ping" 60
    add_monitor "$ADMIN_USER_ID" "Vault" "http://vault:8200/v1/sys/health" "http" 60
    add_monitor "$ADMIN_USER_ID" "WAF" "http://waf:8080" "http" 60
    add_monitor "$ADMIN_USER_ID" "Prometheus" "http://prometheus:9090" "http" 60
    add_monitor "$ADMIN_USER_ID" "Alertmanager" "http://alertmanager:9093" "http" 60
    add_monitor "$ADMIN_USER_ID" "Grafana" "http://grafana:3000" "http" 60
    
    log_success "All monitors added"
else
    log_info "Monitors already configured ($MONITOR_COUNT found)"
    
    # Ensure all existing monitors are assigned to admin user
    log_info "Assigning all monitors to admin user..."
    UPDATED=$(sqlite3 "$DB" "UPDATE monitor SET user_id = $ADMIN_USER_ID WHERE user_id IS NULL OR user_id = 0;" 2>/dev/null && sqlite3 "$DB" "SELECT changes();" 2>/dev/null || echo "0")
    
    if [ "$UPDATED" -gt 0 ]; then
        log_success "Assigned $UPDATED unassigned monitor(s) to admin"
    fi
fi

log_success "Initialization complete"
