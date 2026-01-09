#!/bin/bash
# Entrypoint for detecting and setting up Docker environment
# This initializes environment variables for docker-compose

set -e

# Run the initialization script
/goinfre/mcauchy-/ft_transcendence/scripts/init-docker-env.sh

# If a main entrypoint was specified, run it
if [ -n "$1" ]; then
    exec "$@"
fi
