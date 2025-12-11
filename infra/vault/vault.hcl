# Vault Configuration File for Development/Production

# Storage backend configuration
# For development: using file storage with volume
# For production: use Consul, S3, PostgreSQL, etc.
storage "file" {
  path = "/vault/file"
}

# Listener configuration
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = 1  # Set to 0 in production with proper certificates
  tls_cert_file = "/vault/config/tls/server.crt"
  tls_key_file  = "/vault/config/tls/server.key"
}

# Cluster listener for HA setup
listener "tcp" {
  address            = "0.0.0.0:8201"
  tls_disable        = 1
  cluster_address    = "0.0.0.0:8201"
}

# Telemetry for monitoring (optional)
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = false
}

# API configuration
api_addr      = "http://0.0.0.0:8200"
cluster_addr  = "http://0.0.0.0:8201"

# Logging
log_level = "info"

# Enable UI (useful for development)
ui = true

# Max lease duration
max_lease_ttl      = "168h"
default_lease_ttl  = "168h"
