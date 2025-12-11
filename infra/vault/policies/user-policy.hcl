# User service
# This policy allows the application to read secrets from the specified path

path "database/creds/user-role" {
  capabilities = ["read"]
}

# Renew leases
path "sys/leases/renew" {
  capabilities = ["update"]
}
