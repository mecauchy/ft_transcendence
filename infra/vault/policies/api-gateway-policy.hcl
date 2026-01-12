# API Gateway Policy - Least Privilege Access
# This policy grants the API Gateway ONLY what it needs to operate

# =============================================================================
# JWT Secret (Shared between gateway and auth service)
# =============================================================================
path "secret/data/jwt" {
  capabilities = ["read"]
}

# =============================================================================
# API Gateway Specific Secrets
# =============================================================================
path "secret/data/api-gateway/*" {
  capabilities = ["read"]
}

# Session secret for @fastify/session middleware
path "secret/data/session" {
  capabilities = ["read"]
}

# =============================================================================
# Redis Connection Info (if stored in Vault)
# =============================================================================
path "secret/data/redis" {
  capabilities = ["read"]
}

# =============================================================================
# Service Discovery / Health Checks
# =============================================================================
path "sys/health" {
  capabilities = ["read"]
}

# =============================================================================
# Token Self-Management
# =============================================================================
# Allow token renewal for long-running services
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow token lookup for debugging/monitoring
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# =============================================================================
# DENY: Database Credentials
# =============================================================================
# Explicitly DENY access to all database credentials
# API Gateway should NOT have direct database access
path "secret/data/database/*" {
  capabilities = ["deny"]
}

path "database/creds/*" {
  capabilities = ["deny"]
}
