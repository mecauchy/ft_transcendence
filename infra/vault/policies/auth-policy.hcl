# Authentification service
# This policy allows the application to read secret from the specified path
path "database/creds/auth-role" {
  capabilities = ["read"]
}

# Global static secrets
path "secret/data/global/*" {
  capabilities = ["read"]
}

# OAuth credentials (42 API)
path "secret/data/oauth/*" {
  capabilities = ["read", "list"]
}

# Vault token renewal
path "sys/leases/renew" {
  capabilities = ["update"]
}
