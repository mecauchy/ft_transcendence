#!/bin/sh

if [ -n "$JWT_SECRET_FILE" ] && [ -f "$JWT_SECRET_FILE" ]; then
  export JWT_SECRET=$(cat "$JWT_SECRET_FILE")
else
  echo "❗ JWT secret file not found: $JWT_SECRET_FILE"
  exit 1
fi
# Ensure SESSION_SECRET is set and long enough for @fastify/session (>=32 bytes)
if [ -z "${SESSION_SECRET:-}" ]; then
  # Default SESSION_SECRET to JWT_SECRET; if too short, repeat to reach 32 chars
  SESSION_SECRET="$JWT_SECRET"
  len=${#SESSION_SECRET}
  if [ "$len" -lt 32 ]; then
    # Repeat the secret until it's at least 32 chars, then truncate
    while [ ${#SESSION_SECRET} -lt 32 ]; do
      SESSION_SECRET="$SESSION_SECRET$SESSION_SECRET"
    done
    SESSION_SECRET=$(printf "%s" "$SESSION_SECRET" | cut -c1-32)
  fi
  export SESSION_SECRET
fi
exec "$@"
