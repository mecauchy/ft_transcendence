#!/bin/sh

# Check for CI variable first, then local file path
get_secret_content() {
	local env_var_name=$1
	local file_path=$2
	local secret_content=""

	# 1. Check if the environment variable is set
	if [ -n "${!env_var_name}" ]; then
		secret_content="${!env_var_name}"

	# 2. Check if the file exists and read its content
	elif [ -n "${file_path}" ] && [ -f "${file_path}" ]; then
		secret_content=$(cat "${file_path}")
	else
		echo "Error: Neither environment variable '${env_var_name}' is set nor file '${file_path}' exists."
		exit 1
	fi
	echo "${secret_content}"
}

echo "Initializing Vault..."

# Policies file paths
AUTH_POLICY_FILE="./infra/vault/policies/auth-policy.hcl"
CHAT_POLICY_FILE="./infra/vault/policies/chat-policy.hcl"
GAME_POLICY_FILE="./infra/vault/policies/game-policy.hcl"
USER_POLICY_FILE="./infra/vault/policies/user-policy.hcl"
POSTGRES_POLICY_FILE="./infra/vault/policies/postgres-policy.hcl"

# Retrieve secret from environment variables or local files
AUTH_DB_PASS=$(get_secret_content "AUTH_DB_PASS" "./secret/auth_db_pass.txt")
CHAT_DB_PASS=$(get_secret_content "CHAT_DB_PASS" "./secret/chat_db_pass.txt")
GAME_DB_PASS=$(get_secret_content "GAME_DB_PASS" "./secret/game_db_pass.txt")
USER_DB_PASS=$(get_secret_content "USER_DB_PASS" "./secret/user_db_pass.txt")
POSTGRES_PASS=$(get_secret_content "POSTGRES_PASS" "./secret/postgres_pass.txt")

# Vault configuration and secret writing
echo "Configuring Vault..."

# Enable KV secret engine at 'secret/' path with version 2
vault secret enable -version=2 -path=secret kv

# Upload secrets to Vault
vault kv put secret/auth-db \
	username="auth_user" \
	password="${AUTH_DB_PASS}"

vault kv put secret/chat-db \
	username="chat_user" \
	password="${CHAT_DB_PASS}"

vault kv put secret/game-db \
	username="game_user" \
	password="${GAME_DB_PASS}"

vault kv put secret/user-db \
	username="user_user" \
	password="${USER_DB_PASS}"

vault kv put secret/postgres \
	username="root_admin" \
	password="${POSTGRES_PASS}"

# Apply policies
vault policy write auth-policy "${AUTH_POLICY_FILE}"
vault policy write chat-policy "${CHAT_POLICY_FILE}"
vault policy write game-policy "${GAME_POLICY_FILE}"
vault policy write user-policy "${USER_POLICY_FILE}"
vault policy write postgres-policy "${POSTGRES_POLICY_FILE}"

echo "Policy and secret setup complete."

# Create token with all policies attached
vault token create -policy="auth-policy" -id="auth-token"
vault token create -policy="chat-policy" -id="chat-token"
vault token create -policy="game-policy" -id="game-token"
vault token create -policy="user-policy" -id="user-token"
vault token create -policy="postgres-policy" -id="postgres-token"

# Enable APProle
vault auth enable approle

# AUTH SERVICE
# Define roles and bind policies
vault write auth/approle/role/auth-role \
	token_policies="auth-policy" \
	token_ttl=1h \
	token_max_ttl=4h
# Set fixed dev creds
vault write auth/approle/role/auth-role role_id="auth-role-id"
vault write -f auth/approle/role/auth-role/custom-secret-id secret_id="auth-secret-id"

# CHAT SERVICE
vault write auth/approle/role/chat-role \
	token_policies="chat-policy" \
	token_ttl=1h \
	token_max_ttl=4h
vault write auth/approle/role/chat-role role_id="chat-role-id"
vault write -f auth/approle/role/chat-role/custom-secret-id secret_id="chat-secret-id"

# GAME SERVICE
vault write auth/approle/role/game-role \
	token_policies="game-policy" \
	token_ttl=1h \
	token_max_ttl=4h
vault write auth/approle/role/game-role role_id="game-role-id"
vault write -f auth/approle/role/game-role/custom-secret-id secret_id="game-secret-id"

# USER SERVICE
vault write auth/approle/role/user-role \
	token_policies="user-policy" \
	token_ttl=1h \
	token_max_ttl=4h
vault write auth/approle/role/user-role role_id="user-role-id"
vault write -f auth/approle/role/user-role/custom-secret-id secret_id="user-secret-id"

# POSTGRES SERVICE
vault write auth/approle/role/postgres-role \
	token_policies="postgres-policy" \
	token_ttl=1h \
	token_max_ttl=4h
vault write auth/approle/role/postgres-role role_id="postgres-role-id"
vault write -f auth/approle/role/postgres-role/custom-secret-id secret_id="postgres-secret-id"

echo "Vault initialization complete."
