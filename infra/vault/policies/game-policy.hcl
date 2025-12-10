# Game service
# This policy allows the application to read secret from the specified path

path "secret/game-service/*" {
	capabilities = ["read"]
}

# Deny access to everything else
path "secret/*" {
	capabilities = ["deny"]
}