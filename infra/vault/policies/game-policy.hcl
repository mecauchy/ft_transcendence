# Game service
# This policy allows the application to read secret from the specified path

path "database/creds/game-role" {
  capabilities = ["read"]
}

# if openai is used
#path "secret/data/global" {
#  capabilities = ["read"]
#}

# Renew leases
path "sys/leases/renew" {
  capabilities = ["update"]
}
