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
AUTH_POLICY_FILE="./infrastructure/vault/policies/auth-policy.hcl"
CHAT_POLICY_FILE="./infrastructure/vault/policies/chat-policy.hcl"
GAME_POLICY_FILE="./infrastructure/vault/policies/game-policy.hcl"
USER_POLICY_FILE="./infrastructure/vault/policies/user-policy.hcl"
POSTGRES_POLICY_FILE="./infrastructure/vault/policies/postgres-policy.hcl"

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
