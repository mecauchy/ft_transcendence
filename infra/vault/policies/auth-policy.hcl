# Authentification service
# This policy allows the application to read secret from the specified path
path "database/creds/auth-role" {
  capabilities = ["read"]
}

# Global static secrets
path "secret/data/global/*" {
  capabilities = ["read"]
}

# Vault token renewal
path "sys/leases/renew" {
  capabilities = ["update"]
}
