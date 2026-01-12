# Chat service
# This policy allows the application to read secret from the specified path

path "database/creds/chat-role" {
  capabilities = ["read"]
}

# Renew leases
path "sys/leases/renew" {
  capabilities = ["update"]
}
