#!/bin/bash
# Initialize Docker mode detection and environment configuration
# This script is sourced by make commands to set up environment variables

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect Docker mode
if docker info 2>/dev/null | grep -q "rootless"; then
    DOCKER_MODE="rootless"
    DOCKER_ROOT=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo "")
    
    if [ -z "$DOCKER_ROOT" ]; then
        # Fallback: try common rootless paths
        if [ -d "$HOME/.local/share/docker" ]; then
            DOCKER_ROOT="$HOME/.local/share/docker"
        elif [ -d "/run/user/$(id -u)/docker" ]; then
            DOCKER_ROOT="/run/user/$(id -u)/docker"
        else
            # Last resort: try to find it in /goinfre (42 school)
            DOCKER_ROOT=$(find /goinfre -maxdepth 3 -name docker -type d 2>/dev/null | head -1)
        fi
    fi
    
    DOCKER_SOCKET="/run/user/$(id -u)/docker.sock"
else
    DOCKER_MODE="root"
    DOCKER_ROOT="/var/lib/docker"
    DOCKER_SOCKET="/var/run/docker.sock"
fi

# Create .env file for docker-compose
cat > "$PROJECT_ROOT/.env" << EOF
# Generated Docker mode configuration
DOCKER_MODE=$DOCKER_MODE
DOCKER_ROOT_DIR=$DOCKER_ROOT
DOCKER_SOCKET_PATH=$DOCKER_SOCKET

# Compose project name
COMPOSE_PROJECT_NAME=ft_transcendence

# Elastic Stack
ELASTICSEARCH_PASSWORD=changeme123
KIBANA_PASSWORD=changeme123
EOF

# Also export for current shell
export DOCKER_MODE
export DOCKER_ROOT_DIR="$DOCKER_ROOT"
export DOCKER_SOCKET_PATH="$DOCKER_SOCKET"

echo "✓ Docker mode: $DOCKER_MODE"
echo "✓ Docker root: $DOCKER_ROOT"
echo "✓ Docker socket: $DOCKER_SOCKET"
echo "✓ .env file generated at $PROJECT_ROOT/.env"
