# This policy allows the application to read secrets from the specified path

path "secret/data/auth-service/db" {
	  capabilities = ["read"]
}

path "secret/data/auth-service/42-auth" {
	  capabilities = ["read"]
}

# Deny access to everything else
path "secret/data/*" {
	  capabilities = ["deny"]
}
