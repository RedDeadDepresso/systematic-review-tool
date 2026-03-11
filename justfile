export COMPOSE_FILE := "docker-compose.local.yml"

## Just does not yet manage signals for subprocesses reliably, which can lead to unexpected behavior.
## Exercise caution before expanding its usage in production environments.
## For more information, see https://github.com/casey/just/issues/2473 .


# Default command to list all available commands.
default:
    @just --list

# build: Build python image.
build *args:
    @echo "Building python image..."
    @docker compose build {{args}}

# up: Start up containers.
up *args:
    @echo "Starting up containers..."
    @docker compose up -d --remove-orphans {{args}}

# down: Stop containers.
down:
    @echo "Stopping containers..."
    @docker compose down

# prune: Remove containers and their volumes.
prune *args:
    @echo "Killing containers and removing volumes..."
    @docker compose down -v {{args}}

# logs: View container logs
logs *args:
    @docker compose logs -f {{args}}

# django: Executes any command in django container.
django +args:
    @docker compose exec django sh -c 'export DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB} && {{args}}'

# manage: Executes `manage.py` command.
manage +args:
    @docker compose exec django sh -c 'export DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB} && python ./manage.py {{args}}'

# pytest: Executes `pytest` command.
pytest *args:
    @docker compose exec django sh -c 'export DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB} && coverage run -m pytest -n auto --cov=slrt_project {{args}}'

# react: Executes any command in react container.
react +args:
    @docker compose exec react sh -c '{{args}}'

# pnpm: Executes `pnpm` command.
pnpm *args:
    @docker compose exec react sh -c 'pnpm {{args}}'

# test: Executes `pnpm test` command.
vitest *args:
    @docker compose exec react sh -c 'pnpm test {{args}}'