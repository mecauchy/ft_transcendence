# User service
# This policy allows the application to read secrets from the specified path

path "secret/user-service/*" {
	capabilities = ["read"]
}

# Deny access to everything else
path "secret/*" {
	capabilities = ["deny"]
}