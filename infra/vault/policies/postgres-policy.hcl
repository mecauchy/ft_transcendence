# postgres
# This policy allows the application to read secrets from the specified path

path "secret/postgres/*" {
	capabilities = ["read"]
}

# Deny access to everything else
path "secret/*" {
	capabilities = ["deny"]
}