# Vault Configuration File for Development

# Storage backend configuration
# Using file storage with persistent volume
storage "file" {
  path = "/vault/file"
}

# Listener configuration
# Production-ready: TLS enabled with self-signed certificates
# For production with CA-signed certs, replace vault.crt/vault.key
listener "tcp" {
  address          = "0.0.0.0:8200"
  tls_disable      = 0
  tls_cert_file    = "/vault/tls/vault.crt"
  tls_key_file     = "/vault/tls/vault.key"
  tls_min_version  = "tls12"
}

# Cluster listener
listener "tcp" {
  address       = "0.0.0.0:8201"
  tls_cert_file = "/vault/tls/server.crt"
  tls_key_file  = "/vault/tls/server.key"
  tls_disable   = 0
}

# Telemetry
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = false
}

# API configuration
api_addr      = "https://0.0.0.0:8200"
cluster_addr  = "https://0.0.0.0:8201"

# Logging
log_level = "info"

# UI
ui = true

# Lease durations
max_lease_ttl      = "168h"
default_lease_ttl  = "168h"

