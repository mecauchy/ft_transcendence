#!/bin/bash
# Phase 2 Security Hardening - Command Summary
# Execute these commands to replicate the security hardening steps

set -e

echo "================================================"
echo "Phase 2: Security Hardening - Command Summary"
echo "================================================"
echo ""

# Step 1: Rename Override File
echo "[1/4] Renaming docker-compose.override.yml to prevent auto-loading..."
mv docker-compose.override.yml docker-compose.dev.yml
echo "✓ Override file renamed to docker-compose.dev.yml"
echo ""

# Step 2: Generate Vault TLS Certificates
echo "[2/4] Generating self-signed TLS certificates for Vault..."
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 \
  -nodes \
  -keyout infra/certs/vault.key \
  -out infra/certs/vault.crt \
  -subj "/CN=vault/O=ft_transcendence" \
  -addext "subjectAltName=DNS:vault,DNS:localhost,IP:127.0.0.1"

chmod 600 infra/certs/vault.key
chmod 644 infra/certs/vault.crt
echo "✓ Certificates generated:"
ls -lh infra/certs/vault.{crt,key}
echo ""

# Step 3: Verify Configuration
echo "[3/4] Verifying configuration files..."
echo "  - Checking vault.hcl for TLS config..."
grep -q "tls_disable.*0" infra/vault/vault.hcl && echo "    ✓ Vault TLS enabled" || echo "    ✗ WARNING: TLS not enabled"

echo "  - Checking docker-compose.yml for Vault HTTPS..."
grep -q "VAULT_ADDR=https://" docker-compose.yml && echo "    ✓ Vault uses HTTPS" || echo "    ✗ WARNING: Vault not using HTTPS"

echo "  - Verifying no port bindings for backends..."
for service in api-gateway auth-service postgres redis; do
    if grep -A5 "^  $service:" docker-compose.yml | grep -q "ports:"; then
        echo "    ✗ WARNING: $service has exposed ports"
    else
        echo "    ✓ $service is isolated"
    fi
done
echo ""

# Step 4: Make verification script executable
echo "[4/4] Setting up verification script..."
chmod +x scripts/verify_isolation.sh
echo "✓ Verification script is executable"
echo ""

echo "================================================"
echo "✅ Phase 2 Security Hardening Complete"
echo "================================================"
echo ""
echo "Next Steps:"
echo "  1. Review changes: git diff docker-compose.yml infra/vault/vault.hcl"
echo "  2. Deploy production: docker compose down && docker compose up -d"
echo "  3. Run audit: ./scripts/verify_isolation.sh"
echo "  4. (Dev mode): docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d"
echo ""
echo "Files Modified:"
echo "  - docker-compose.override.yml → docker-compose.dev.yml"
echo "  - infra/vault/vault.hcl (TLS enabled)"
echo "  - docker-compose.yml (Vault service updated)"
echo "  - infra/certs/vault.{crt,key} (generated)"
echo "  - scripts/verify_isolation.sh (created)"
echo ""
