# Auth Service Policy - Least Privilege Access
# This policy grants the Auth Service access to authentication-related secrets

# =============================================================================
# JWT Secret (Required for token signing/verification)
# =============================================================================
path "secret/data/jwt" {
  capabilities = ["read"]
}

# =============================================================================
# Auth Service Specific Secrets
# =============================================================================
path "secret/data/auth-service/*" {
  capabilities = ["read"]
}

# =============================================================================
# Auth Database Credentials (Static)
# =============================================================================
path "secret/data/database/auth" {
  capabilities = ["read"]
}

# =============================================================================
# Auth Database Dynamic Credentials (Vault DB Engine)
# =============================================================================
# Request dynamic database credentials with TTL
path "database/creds/auth-role" {
  capabilities = ["read"]
}

# =============================================================================
# OAuth/OIDC Provider Secrets (if applicable)
# =============================================================================
path "secret/data/oauth/*" {
  capabilities = ["read"]
}

# =============================================================================
# Token Self-Management
# =============================================================================
path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# Lease management for dynamic credentials
path "sys/leases/renew" {
  capabilities = ["update"]
}

path "sys/leases/revoke" {
  capabilities = ["update"]
}

# =============================================================================
# DENY: Other Services' Secrets
# =============================================================================
# Explicitly DENY access to other services' database credentials
path "secret/data/database/chat" {
  capabilities = ["deny"]
}

path "secret/data/database/game" {
  capabilities = ["deny"]
}

path "secret/data/database/user" {
  capabilities = ["deny"]
}

path "database/creds/chat-role" {
  capabilities = ["deny"]
}

path "database/creds/game-role" {
  capabilities = ["deny"]
}

path "database/creds/user-role" {
  capabilities = ["deny"]
}
