#!/bin/sh

get_secret_content() {
	local env_var_name=$1
	local file_path=$2
	if [ -n "${!env_var_name}" ]; then echo "${!env_var_name}";
	elif [ -n "${file_path}" ] && [ -f "${file_path}" ]; then cat "${file_path}";
	else echo "Error: Secret for ${env_var_name} not found." >&2; exit 1; fi
}

echo "Initializing Vault..."

# Retrieve INFRA secrets
POSTGRES_PASS=$(get_secret_content "POSTGRES_PASS" "./secret/postgres_pass.txt")

# Retrieve APP secrets
OAUTH_SECRET=$(get_secret_content "OAUTH_SECRET" "./secret/oauth_secret.txt")
JWT_SECRET=$(get_secret_content "JWT_SECRET" "./secret/jwt_secret.txt")

# Enable engines
vault secrets enable -version=2 -path=secret kv
vault secrets enable database

# --------------------------------------------------------------------------
# STATIC SECRETS (KV STORE)
#---------------------------------------------------------------------------
echo "Configuring Vault KV and Policies..."
vault kv put secret/global \
	jwt_secret="${JWT_SECRET}" \
	oauth_secret="${OAUTH_SECRET}"

# --------------------------------------------------------------------------
# POSTGRES DATABASE SECRETS ENGINE CONFIGURATION
#---------------------------------------------------------------------------
echo "Configuring Postgres Database Secrets Engine..."

# 1. Configure the Database Secret Engine
vault write database/config/speakup-postgres \
	plugin_name=postgresql-database-plugin \
	connection_url="postgresql://{{username}}:{{password}}@postgres:5432/postgres?sslmode=disable" \
	username="root_admin" \
	password="${POSTGRES_PASS}"

# 2. Create Roles for Dynamic Credentials
# Auth Role
vault write database/roles/auth-role \
	db_name=speakup-postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"auth_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h"

# Chat Role
vault write database/roles/chat-role \
	db_name=speakup-postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"chat_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h"

# Game Role
vault write database/roles/game-role \
	db_name=speakup-postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"game_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h"

# User Role
vault write database/roles/user-role \
	db_name=speakup-postgres \
	creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT ALL PRIVILEGES ON DATABASE \"user_db\" TO \"{{name}}\";" \
	default_ttl="1h" \
	max_ttl="24h"

#----------------------------------------------------------------------------
# AUTHENTIFICATION
#----------------------------------------------------------------------------
echo "Configuring Approle Auth Method..."
vault auth enable approle

# Create Approles for each service

# Auth Service Approle
vault write auth/approle/role/auth-role token_policies="auth-policy" token_ttl=1h token_max_ttl=24h
vault write auth/approle/role/auth-role role_id="auth-role-id"
vault write -f auth/approle/role/auth-role/custom-secret-id secret_id="auth-secret-id"

# Chat Service Approle
vault write auth/approle/role/chat-role token_policies="chat-policy" token_ttl=1h token_max_ttl=24h
vault write auth/approle/role/chat-role role_id="chat-role-id"
vault write -f auth/approle/role/chat-role/custom-secret-id secret_id="chat-secret-id"

# Game Service Approle
vault write auth/approle/role/game-role token_policies="game-policy" token_ttl=1h token_max_ttl=24h
vault write auth/approle/role/game-role role_id="game-role-id"
vault write -f auth/approle/role/game-role/custom-secret-id secret_id="game-secret-id"

# User Service Approle
vault write auth/approle/role/user-role token_policies="user-policy" token_ttl=1h token_max_ttl=24h
vault write auth/approle/role/user-role role_id="user-role-id"
vault write -f auth/approle/role/user-role/custom-secret-id secret_id="user-secret-id"

echo "Vault initialization complete."
