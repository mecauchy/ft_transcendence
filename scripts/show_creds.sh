#!/usr/bin/env bash
# Development Environment Credentials - Development Use Only
# This script aggregates locally-stored development credentials. DO NOT use in production.
set -eo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS_DIR="$ROOT_DIR/infra/secret"

# CLI options
REVEAL=false

usage(){
  cat <<EOF
Usage: $(basename "$0") [--reveal] [--help]

Options:
  --reveal   Show secret values (development use only). Use with caution.
  --help     Show this help message.

This script is intended for local development only. Do NOT use in production.
EOF
}

# parse args
while [ "$#" -gt 0 ]; do
  case "$1" in
    --reveal) REVEAL=true; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# Small header printed at start
print_header() {
  echo
  echo "Development Credentials (local)"
  echo "Repository: $ROOT_DIR"
  echo
}

# Read a secret file and return its contents without trailing newline(s).
read_secret() {
  local f="$1"
  if [[ -f "$f" ]]; then
    # print file contents without adding extra newlines
    awk 'BEGIN{ORS=""} {print}' "$f" 2>/dev/null || cat "$f" 2>/dev/null
  else
    echo ""
  fi
}

# (Removed duplicate reveal function and stray lines.)

pad() { printf "%-22s" "$1"; }

print_table() {
  pad "Service"; pad "Username"; pad "Password Source (File)"; echo " Login URL"
  printf '%.0s-' {1..100}
  echo
  local i
  for i in "${!SERVICES[@]}"; do
    svc="${SERVICES[$i]}"
    user="${USERNAMES[$i]}"
    file="${FILES[$i]}"
    url="${URLS[$i]}"

    # resolve file path relative to repo
    src=""
    if [ -n "$file" ]; then
      if [ -f "$file" ]; then
        src="$file"
      elif [ -f "$SECRETS_DIR/$file" ]; then
        src="$SECRETS_DIR/$file"
      else
        src="Not Found"
      fi
    else
      src="-"
    fi

    pad "$svc"
    pad "${user:--}"
    pad "$src"
    echo " $url"
  done
  echo
}

print_revealed() {
  echo
  echo "Revealed credentials (development only) - handle with care"
  echo
  # Print header
  printf "%-25s %-20s %-40s %s\n" "Service" "Username" "Password" "Login URL"
  printf "%-25s %-20s %-40s %s\n" "-------" "--------" "--------" "---------"

  local i file src val svc user url
  for i in "${!SERVICES[@]}"; do
    svc="${SERVICES[$i]}"
    user="${USERNAMES[$i]:-"(none)"}"
    file="${FILES[$i]:-""}"
    url="${URLS[$i]:-"(none)"}"

    src=""
    if [ -n "$file" ]; then
      if [ -f "$file" ]; then
        src="$file"
      elif [ -f "$SECRETS_DIR/$file" ]; then
        src="$SECRETS_DIR/$file"
      fi
    fi

    if [ -n "$src" ]; then
      val=$(read_secret "$src")
      val=$(printf "%s" "$val")
    else
      val="(missing)"
    fi

    # Print a single line per service: no file paths shown
    printf "%-25s %-20s %-40s %s\n" "$svc" "$user" "$val" "$url"
  done
  echo
}

main() {
  print_header

  # Discover common usernames from docker-compose or defaults
  # Grafana admin username (fallback to grafana_admin)
  gf_user=$(grep -E "GF_SECURITY_ADMIN_USER\s*=|GF_SECURITY_ADMIN_USER" "$ROOT_DIR/docker-compose.yml" 2>/dev/null | head -1 | sed -E 's/.*GF_SECURITY_ADMIN_USER[=: ]*//g' | tr -d '\"') || true
  gf_user=${gf_user:-grafana_admin}

  # Postgres user (from Makefile or compose)
  pg_user=$(grep -E "POSTGRES_USER" "$ROOT_DIR/docker-compose.yml" 2>/dev/null | head -1 | sed -E 's/.*POSTGRES_USER[=: ]*//g' | tr -d '\"') || true
  if [ -z "$pg_user" ]; then
    pg_user=$(grep -E "POSTGRES_USER" "$ROOT_DIR/Makefile" 2>/dev/null | head -1 | sed -E 's/.*POSTGRES_USER\s*:=\s*//g' || true)
  fi
  pg_user=${pg_user:-root_admin}

  # Build arrays for display: service, username, secret-file, login-url
  SERVICES=("Grafana" "Vault (token)" "Postgres" "Redis" "Uptime-Kuma" "Auth DB" "User DB" "Game DB" "Chat DB")
  USERNAMES=("$gf_user" "-" "$pg_user" "-" "kuma_admin" "-" "-" "-" "-")
  FILES=("grafana_pass.txt" "vault_token.txt" "postgres_db_pass.txt" "redis_password.txt" "kuma_pass.txt" "auth_db_pass.txt" "user_db_pass.txt" "game_db_pass.txt" "chat_db_pass.txt")
  URLS=("http://localhost:3002 (grafana)" "http://localhost:8200 (vault)" "(container) postgres:5432" "(container) redis:6379" "http://localhost:3001 (kuma)" "(container) postgres:5432" "(container) postgres:5432" "(container) postgres:5432" "(container) postgres:5432")

  # Print the table header + rows
  print_table

  echo "Detailed secrets (raw values) are available in: $SECRETS_DIR"
  echo "You can view a secret file with: cat $SECRETS_DIR/<file>"
  echo
  echo "Security: This output is for development only. Do NOT commit these values or expose them." 

  if [ "$REVEAL" = true ]; then
    print_revealed
  fi
}

main
