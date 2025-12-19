#!/usr/bin/env bash
set -euo pipefail

# Test JWT authentication flow against local gateway
# Usage: SKIP_PROTECTED=true ./scripts/test_jwt_flow.sh

# Default to http://localhost:3000 (Local Dev)
GATEWAY_URL=${GATEWAY_URL:-http://localhost:3000}
AUTH_ENDPOINT=${AUTH_ENDPOINT:-/api/auth/token}
PROTECTED_ENDPOINT=${PROTECTED_ENDPOINT:-/api/users/me}
SKIP_PROTECTED=${SKIP_PROTECTED:-false}

printf "Using gateway URL: %s\n" "$GATEWAY_URL"

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# ---------------------------------------------------------
# STEP 1: LOGIN
# ---------------------------------------------------------
echo "1) Requesting token from auth endpoint: ${AUTH_ENDPOINT}"
# Use a valid JSON body (username is optional for dev, but good practice)
resp=$(curl -sk -X POST "$GATEWAY_URL${AUTH_ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -d '{"username":"ci_user", "userId":"999"}' || true)

echo "Raw response:" >&2
echo "$resp" >&2

# Extract token using jq or fallback grep/sed
token=$(echo "$resp" | jq -r '.accessToken // .token // .data.accessToken // empty' 2>/dev/null || true)

if [ -z "$token" ] || [ "$token" = "null" ]; then
  echo "❌ No access token found in response. Response may be placeholder or endpoint missing." >&2
  exit 2
fi

echo "✅ Obtained token: ${token:0:20}..." 

# ---------------------------------------------------------
# STEP 2: DECODE
# ---------------------------------------------------------
echo
echo "2) Decoding token payload (if JWT)"
if [[ $(awk -F. '{print NF-1}' <<<"$token") -ne 2 ]]; then
  echo "⚠️ Token is not a JWT (does not contain two dots)." >&2
else
  payload=$(printf '%s' "$token" | cut -d. -f2)
  # Padding for base64
  mod=$(( ${#payload} % 4 ))
  if [ $mod -ne 0 ]; then
    padding=$((4-mod))
    payload="$payload$(printf '%*s' $padding | tr ' ' '=')"
  fi
  decoded=$(printf '%s' "$payload" | base64 --decode 2>/dev/null || echo "" )
  
  if [ -z "$decoded" ]; then
    echo "❌ Failed to base64-decode JWT payload." >&2
  else
    # Check for expiration claim
    exp=$(echo "$decoded" | jq -r '.exp // empty' 2>/dev/null || true)
    sub=$(echo "$decoded" | jq -r '.sub // .userId // empty' 2>/dev/null || true)
    echo "   exp: ${exp:-(not present)}"
    echo "   sub: ${sub:-(not present)}"
    echo "✅ JWT Payload looks valid."
  fi
fi

# ---------------------------------------------------------
# STEP 3: PROTECTED ROUTE (Conditional)
# ---------------------------------------------------------
echo
if [ "$SKIP_PROTECTED" = "true" ]; then
  echo "3) ⏭️  Skipping protected route check (SKIP_PROTECTED=true)"
else
  echo "3) Using token to call protected endpoint: ${PROTECTED_ENDPOINT}"
  http_status=$(curl -sk -o "$tmpfile" -w "%{http_code}" -H "Authorization: Bearer $token" "$GATEWAY_URL${PROTECTED_ENDPOINT}" || true)
  echo "   HTTP status: $http_status"
  cat "$tmpfile" | jq '.' 2>/dev/null || cat "$tmpfile"
  
  # For now, we don't exit on failure here because User Service might be down
  if [ "$http_status" != "200" ]; then
     echo "   (Note: Non-200 status expected if User Service is not running)"
  fi
fi

# ---------------------------------------------------------
# STEP 4: SECURITY CHECK (Tampering)
# ---------------------------------------------------------
echo
echo "4) Testing invalid token (tampered)"
# Modify the last char of the signature
tampered="${token%?}$(printf '%s' x)"

http_status_bad=$(curl -sk -o "$tmpfile" -w "%{http_code}" -H "Authorization: Bearer $tampered" "$GATEWAY_URL${PROTECTED_ENDPOINT}" || true)
echo "   HTTP status with tampered token: $http_status_bad"

if [ "$http_status_bad" = "401" ] || [ "$http_status_bad" = "403" ]; then
  echo "✅ Gateway correctly rejected tampered token (status $http_status_bad)"
else
  echo "❌ Gateway DID NOT reject tampered token (status $http_status_bad) — investigate authentication validation!" >&2
  exit 1
fi

echo
echo "🎉 Test complete."
