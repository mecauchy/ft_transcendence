#!/bin/bash
# Detect Docker deployment mode (root vs rootless) and export appropriate paths
# This script sets environment variables for docker-compose to use the correct volume mounts

set -e

# Detect if Docker is running in rootless mode
if docker info 2>/dev/null | grep -q "rootless"; then
    echo "✓ Docker rootless mode detected"
    
    # Get Docker root directory from docker info
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
    
    export DOCKER_MODE="rootless"
    export DOCKER_ROOT_DIR="$DOCKER_ROOT"
    export DOCKER_CONTAINERS_PATH="$DOCKER_ROOT/containers"
    export FILEBEAT_VOLUME_HOST_PATH="$DOCKER_ROOT/containers"
    export FILEBEAT_VOLUME_CONTAINER_PATH="/var/lib/docker/containers"
    export DOCKER_SOCKET_PATH="/run/user/$(id -u)/docker.sock"
    
else
    echo "✓ Docker root mode detected"
    export DOCKER_MODE="root"
    export DOCKER_ROOT_DIR="/var/lib/docker"
    export DOCKER_CONTAINERS_PATH="/var/lib/docker/containers"
    export FILEBEAT_VOLUME_HOST_PATH="/var/lib/docker/containers"
    export FILEBEAT_VOLUME_CONTAINER_PATH="/var/lib/docker/containers"
    export DOCKER_SOCKET_PATH="/var/run/docker.sock"
fi

# Validate Docker root directory exists
if [ ! -d "$DOCKER_ROOT_DIR" ]; then
    echo "⚠ Warning: Docker root directory '$DOCKER_ROOT_DIR' does not exist or is not accessible"
fi

# Export all variables for docker-compose
export DOCKER_MODE
export DOCKER_ROOT_DIR
export DOCKER_CONTAINERS_PATH
export FILEBEAT_VOLUME_HOST_PATH
export FILEBEAT_VOLUME_CONTAINER_PATH
export DOCKER_SOCKET_PATH

# Also set these for use in Makefile
{
    echo "export DOCKER_MODE=$DOCKER_MODE"
    echo "export DOCKER_ROOT_DIR=$DOCKER_ROOT_DIR"
    echo "export DOCKER_CONTAINERS_PATH=$DOCKER_CONTAINERS_PATH"
    echo "export FILEBEAT_VOLUME_HOST_PATH=$FILEBEAT_VOLUME_HOST_PATH"
    echo "export FILEBEAT_VOLUME_CONTAINER_PATH=$FILEBEAT_VOLUME_CONTAINER_PATH"
    echo "export DOCKER_SOCKET_PATH=$DOCKER_SOCKET_PATH"
} > /tmp/docker-mode.env

echo "Export these variables for docker-compose:"
echo "  DOCKER_MODE=$DOCKER_MODE"
echo "  DOCKER_ROOT_DIR=$DOCKER_ROOT_DIR"
echo "  FILEBEAT_VOLUME_HOST_PATH=$FILEBEAT_VOLUME_HOST_PATH"
echo "  DOCKER_SOCKET_PATH=$DOCKER_SOCKET_PATH"
