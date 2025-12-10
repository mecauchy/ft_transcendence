# Authentification service
# This policy allows the application to read secret from the specified path

path "secret/auth-service/*" {
	capabilities = ["read"]
}

# Deny access to everything else
path "secret/*" {
	capabilities = ["deny"]
}