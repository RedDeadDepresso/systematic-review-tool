#!/bin/bash

# =========================
# ARGUMENT VALIDATION
# =========================

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 [dev|prod]"
    exit 1
fi

MODE="$1"

if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ]; then
    echo "Invalid argument: $MODE"
    echo "Usage: $0 [dev|prod]"
    exit 1
fi

# =========================
# DEPENDENCY CHECKS
# =========================

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Failed to find Docker"
    echo "Please install Docker - https://docs.docker.com/get-started/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    echo "Failed to find Docker Compose"
    echo "Please install Docker Compose - https://docs.docker.com/get-started/get-docker/"
    exit 1
fi

# =========================
# MODE CONFIGURATION
# =========================

if [ "$MODE" = "dev" ]; then
    ENV_FILE=".dev.env"
    COMPOSE_FILE="docker-compose-dev.yaml"
elif [ "$MODE" = "prod" ]; then
    ENV_FILE=".env"
    COMPOSE_FILE="docker-compose-prod.yaml"
fi

# =========================
# ENV FILE CHECK
# =========================

if [ ! -f "$ENV_FILE" ]; then
    echo "Failed to find $ENV_FILE"
    exit 1
fi

# =========================
# DOCKER EXECUTION
# =========================

echo "Starting containers in $MODE mode..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

if [ $? -ne 0 ]; then
    echo "Failed to start Docker containers"
    exit 1
fi

# =========================
# PROD-ONLY: SSL SETUP
# =========================

if [ "$MODE" = "prod" ]; then

    SITE_DOMAIN=$(grep -oP '^SITE_DOMAIN=\K.+' "$ENV_FILE")

    if [ -z "$SITE_DOMAIN" ]; then
        echo "Error: SITE_DOMAIN is not set in $ENV_FILE"
        exit 1
    fi

    echo "Running Certbot for domain: $SITE_DOMAIN"

    docker exec certbot certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        -d "$SITE_DOMAIN"

    if [ $? -ne 0 ]; then
        echo "Failed to obtain SSL certificate"
        exit 1
    fi

    echo "Restarting Nginx..."
    docker restart nginx

    if [ $? -ne 0 ]; then
        echo "Failed to restart Nginx"
        exit 1
    fi
fi

# =========================
# FINISH
# =========================

echo "Setup complete!"

if [ "$MODE" = "dev" ]; then
    echo "Open your browser and visit http://localhost:3000/"
else
    echo "Open your browser and visit https://$SITE_DOMAIN/"
fi
