#!/usr/bin/env bash
set -euo pipefail

# Test JWT authentication flow against local gateway
# Usage: SKIP_PROTECTED=true ./scripts/test_jwt_flow.sh

# Default to http://localhost:3000 (Local Dev)
GATEWAY_URL=${GATEWAY_URL:-http://localhost:3000}
REGISTER_ENDPOINT=${REGISTER_ENDPOINT:-/api/auth/register}
LOGIN_ENDPOINT=${LOGIN_ENDPOINT:-/api/auth/login}
PROTECTED_ENDPOINT=${PROTECTED_ENDPOINT:-/api/users/me}
SKIP_PROTECTED=${SKIP_PROTECTED:-false}

# CI test user credentials
CI_USERNAME="ci_test_user_$(date +%s)"
CI_EMAIL="${CI_USERNAME}@test.local"
CI_PASSWORD="CiTest@123456"
CI_DOB="1990-01-01"

printf "Using gateway URL: %s\n" "$GATEWAY_URL"

tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# ---------------------------------------------------------
# STEP 0: WAIT FOR SERVICE HEALTH
# ---------------------------------------------------------
echo "0) Waiting for gateway to be ready..."
max_retries=30
retry=0
while [ $retry -lt $max_retries ]; do
  health_status=$(curl -sk -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health" 2>/dev/null || echo "000")
  # Accept any 2xx, 3xx, 4xx, or 5xx response as healthy (connection succeeded)
  # Reject only 000 which means curl failed to connect at all
  if [ "$health_status" != "000" ] && [ "$health_status" != "000000" ]; then
    echo "✅ Gateway is responding (status: $health_status)"
    break
  fi
  echo "   Attempt $((retry+1))/$max_retries - Gateway not responding yet (status: $health_status), retrying..."
  sleep 1
  retry=$((retry+1))
done

if [ $retry -eq $max_retries ]; then
  echo "❌ Gateway failed to become healthy after $max_retries attempts" >&2
  echo "   Final health check returned: $health_status" >&2
  exit 1
fi

# ---------------------------------------------------------
# STEP 1: REGISTER TEST USER
# ---------------------------------------------------------
echo "1) Registering test user: ${CI_USERNAME}"
register_resp=$(curl -sk -w "\n%{http_code}" -X POST "$GATEWAY_URL${REGISTER_ENDPOINT}" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${CI_USERNAME}\", \"email\":\"${CI_EMAIL}\", \"password\":\"${CI_PASSWORD}\", \"dob\":\"${CI_DOB}\"}" 2>&1 || true)

register_code=$(echo "$register_resp" | tail -1)
register_body=$(echo "$register_resp" | head -n -1)

echo "   Registration response (HTTP $register_code):" >&2
echo "$register_body" >&2

if [ "$register_code" = "201" ]; then
  echo "✅ Test user registered successfully"
elif [ "$register_code" = "409" ]; then
  echo "ℹ️  Test user already exists (continuing with login)"
else
  echo "❌ Failed to register test user (HTTP $register_code)" >&2
  exit 2
fi

# ---------------------------------------------------------
# STEP 2: LOGIN
# ---------------------------------------------------------
echo "2) Requesting token from login endpoint: ${LOGIN_ENDPOINT}"
# Add retry logic in case auth service is still initializing
retry=0
max_retries=10
while [ $retry -lt $max_retries ]; do
  resp=$(curl -sk -w "\n%{http_code}" -X POST "$GATEWAY_URL${LOGIN_ENDPOINT}" \
    -H 'Content-Type: application/json' \
    -d "{\"login\":\"${CI_USERNAME}\", \"password\":\"${CI_PASSWORD}\"}" 2>&1 || true)
  
  # Extract HTTP status code (last line)
  http_code=$(echo "$resp" | tail -1)
  # Get response body (all but last line)
  resp_body=$(echo "$resp" | head -n -1)
  
  echo "Raw response (HTTP $http_code):" >&2
  echo "$resp_body" >&2
  
  # If we got a response with 200 status, try to extract token
  if [ "$http_code" = "200" ]; then
    token=$(echo "$resp_body" | jq -r '.accessToken // .token // .data.accessToken // empty' 2>/dev/null || true)
    if [ -n "$token" ] && [ "$token" != "null" ]; then
      break
    fi
  fi
  
  # Retry if we got empty response or non-200 status
  if [ $retry -lt $((max_retries-1)) ]; then
    echo "   Retrying token request ($((retry+1))/$max_retries)..." >&2
    sleep 1
    retry=$((retry+1))
  else
    retry=$((retry+1))
    break
  fi
done

# Extract token using jq or fallback grep/sed
token=$(echo "$resp_body" | jq -r '.accessToken // .token // .data.accessToken // empty' 2>/dev/null || true)

if [ -z "$token" ] || [ "$token" = "null" ]; then
  echo "❌ No access token found in response after $max_retries attempts. Response may be placeholder or endpoint missing." >&2
  exit 2
fi

echo "✅ Obtained token: ${token:0:20}..." 

# ---------------------------------------------------------
# STEP 3: DECODE
# ---------------------------------------------------------
echo
echo "3) Decoding token payload (if JWT)"
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
# STEP 4: PROTECTED ROUTE (Conditional)
# ---------------------------------------------------------
echo
if [ "$SKIP_PROTECTED" = "true" ]; then
  echo "4) ⏭️  Skipping protected route check (SKIP_PROTECTED=true)"
else
  echo "4) Using token to call protected endpoint: ${PROTECTED_ENDPOINT}"
  http_status=$(curl -sk -o "$tmpfile" -w "%{http_code}" -H "Authorization: Bearer $token" "$GATEWAY_URL${PROTECTED_ENDPOINT}" || true)
  echo "   HTTP status: $http_status"
  cat "$tmpfile" | jq '.' 2>/dev/null || cat "$tmpfile"
  
  # For now, we don't exit on failure here because User Service might be down
  if [ "$http_status" != "200" ]; then
     echo "   (Note: Non-200 status expected if User Service is not running)"
  fi
fi

# ---------------------------------------------------------
# STEP 5: SECURITY CHECK (Tampering)
# ---------------------------------------------------------
echo
echo "5) Testing invalid token (tampered)"
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
