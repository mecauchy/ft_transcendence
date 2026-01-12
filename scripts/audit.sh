#!/usr/bin/env bash
set -euo pipefail

# audit.sh - Forensic audit script for HTTPS/Secrets/DB SSL checks
# Usage: ./audit.sh [path]
# - path defaults to repository root (.)

ROOT="${1:-.}"
echo "Running forensic audit on: $ROOT"

EXCLUDE_ARGS=(--exclude-dir=node_modules --exclude-dir=.git)

echo
echo "1) Scanning for plain 'http://' occurrences (excluding node_modules and .git)"
HTTP_MATCHES=$(grep -R -n "http://" "${EXCLUDE_ARGS[@]}" "$ROOT" 2>/dev/null || true)
# filter out any accidental matches containing https:// (defensive)
HTTP_MATCHES=$(printf "%s\n" "$HTTP_MATCHES" | grep -v "https://" || true)

if [ -n "$HTTP_MATCHES" ]; then
  echo "-- Found HTTP usages:"
  printf "%s\n" "$HTTP_MATCHES"
else
  echo "-- No plain http:// occurrences found."
fi

echo
echo "2) Verifying WAF config (infra/waf/default.conf) for redirect and HSTS"
if [ -f infra/waf/default.conf ]; then
  echo "-- Checking for 'return 301' (HTTP->HTTPS redirect):"
  grep -n "return 301" infra/waf/default.conf || echo "   MISSING: return 301 not found"

  echo "-- Checking for HSTS header (Strict-Transport-Security):"
  grep -n "Strict-Transport-Security" infra/waf/default.conf || echo "   MISSING: HSTS header not found"
else
  echo "-- MISSING: infra/waf/default.conf not found"
fi

echo
echo "3) Hunting for Vault token leaks and dev defaults"
echo "-- Searching for VAULT_TOKEN assignments and 'root_token_dev_only'"
grep -R -n "VAULT_TOKEN" "${EXCLUDE_ARGS[@]}" "$ROOT" 2>/dev/null || true
grep -R -n "root_token_dev_only" "${EXCLUDE_ARGS[@]}" "$ROOT" 2>/dev/null || true

echo
echo "4) Checking backend DB SSL settings (packages/backend)"
grep -R -n "rejectUnauthorized" "${EXCLUDE_ARGS[@]}" packages/backend 2>/dev/null || true
grep -R -n -E "ssl:[[:space:]]*false|ssl:[[:space:]]*true" "${EXCLUDE_ARGS[@]}" packages/backend 2>/dev/null || true

echo
echo "5) Checking for insecure cookie/session settings (secure: false) in api-gateway"
grep -R -n "secure:[[:space:]]*false" "${EXCLUDE_ARGS[@]}" packages/backend/api-gateway 2>/dev/null || true
grep -R -n "@fastify/cookie\|@fastify/session\|fastify.register(session)" "${EXCLUDE_ARGS[@]}" packages/backend/api-gateway 2>/dev/null || true

echo
echo "=== Summary / Exit Decision ==="

ERRORS=0

if [ -n "$HTTP_MATCHES" ]; then
  echo "[FAIL] Plain http:// occurrences detected — review output above."
  ERRORS=$((ERRORS+1))
else
  echo "[PASS] No plain http:// occurrences found."
fi

if [ -f infra/waf/default.conf ]; then
  if ! grep -q "return 301" infra/waf/default.conf; then
    echo "[FAIL] WAF: HTTP->HTTPS redirect (return 301) missing."
    ERRORS=$((ERRORS+1))
  else
    echo "[PASS] WAF: return 301 present."
  fi

  if ! grep -q "Strict-Transport-Security" infra/waf/default.conf; then
    echo "[FAIL] WAF: HSTS header missing."
    ERRORS=$((ERRORS+1))
  else
    echo "[PASS] WAF: HSTS header present."
  fi
else
  echo "[FAIL] infra/waf/default.conf not found."
  ERRORS=$((ERRORS+1))
fi

# Check for vault token defaults
if grep -R -n "root_token_dev_only" "${EXCLUDE_ARGS[@]}" "$ROOT" 2>/dev/null | grep -q .; then
  echo "[FAIL] Found 'root_token_dev_only' in repository — remove/rotate and use secrets."
  ERRORS=$((ERRORS+1))
else
  echo "[PASS] No 'root_token_dev_only' occurrences found."
fi

# Check for VAULT_TOKEN environment leakage
if grep -R -n "VAULT_TOKEN" "${EXCLUDE_ARGS[@]}" "$ROOT" 2>/dev/null | grep -q .; then
  echo "[WARN] 'VAULT_TOKEN' environment var references found — ensure not used in production or not hardcoded."
else
  echo "[PASS] No direct 'VAULT_TOKEN' env var references found."
fi

# DB SSL checks
if grep -R -n "rejectUnauthorized" "${EXCLUDE_ARGS[@]}" packages/backend 2>/dev/null | grep -q .; then
  echo "[PASS] DB clients with explicit 'rejectUnauthorized' found."
else
  echo "[WARN] No 'rejectUnauthorized' occurrences found in packages/backend — verify DB clients enforce TLS in production."
fi

# Cookie secure flag checks
if grep -R -n "secure:[[:space:]]*false" "${EXCLUDE_ARGS[@]}" packages/backend/api-gateway 2>/dev/null | grep -q .; then
  echo "[FAIL] Insecure cookie flag 'secure: false' found in api-gateway."
  ERRORS=$((ERRORS+1))
else
  echo "[PASS] No insecure cookie 'secure: false' found in api-gateway (verify secure:true in production)."
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "\nAUDIT RESULT: NOT COMPLIANT — $ERRORS issue(s) detected."
  exit 2
else
  echo "\nAUDIT RESULT: COMPLIANT (no critical issues detected)."
  exit 0
fi
