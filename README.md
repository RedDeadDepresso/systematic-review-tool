# Systematic Review Tool

## Overview

The aim of this project is to build a systematic literature review (SLR) tool that will help researchers to synthesise results on a specific research question from multiple academic research studies. The tool needs to create new SLR projects, and for each project to import sets of references in BibTex format, automatically remove duplicates, allow sets of papers to be allocated to different reviewers for screening, allow reviewers to code and theme included papers and pull out relevant results.

Systematic literature reviews select and evaluate published research studies in order to answer a clearly formulated question, and systematic mapping studies select and evaluate published research studies in order to identify the state-of-the-art in a particular research area. Both approaches require researchers to systematically search for relevant published papers and to screen papers in order to arrive at a final set of relevant articles. For SLRs analysis involves identifying and synthesizing results from the chosen set of papers, for SMSs analysis involves coding and theming the chosen set of papers. The process needs to be well-defined, well-documented and repeatable. Tools can be very useful to help research teams to manage the process. Although tools are available (i.e. Rayyan), their interfaces are poor and they are not well-designed for mapping reviews or coding/theming.

# Getting Started

This guide covers how to install and run the backend locally using Docker Compose.

## Prerequisites

Make sure the following are installed on your machine:

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [just](https://github.com/casey/just): a command runner (recommended, but optional)

## 1. Clone the Repository

```bash
git clone <repository-url>
cd <project-root>
```

## 2. Build and Start

### Using `just` (recommended)

The project ships with a `justfile` that wraps common Docker Compose commands.

```bash
# Build images
just build

# Start all services in the background
just up

# View logs (all services)
just logs

# View logs for a specific service
just logs django
```

### Using Docker Compose directly

```bash
docker compose -f docker-compose.local.yml build
docker compose -f docker-compose.local.yml up -d
```

## 3. Run Migrations

```bash
# Using just
just manage migrate

# Using Docker Compose directly
docker compose -f docker-compose.local.yml exec django python manage.py migrate
```

## 4. Create a Superuser (optional)

```bash
just manage createsuperuser
```

## 5. Access the Services

| Service        | URL                          | Notes                       |
| -------------- | ---------------------------- | --------------------------- |
| Django API     | http://localhost:8000/api/   | REST API                    |
| Django Admin   | http://localhost:8000/admin/ | Superuser login required    |
| React frontend | http://localhost:3000        | Vite dev server with HMR    |
| Mailpit        | http://localhost:8025        | Catches all outgoing emails |
| Flower         | http://localhost:5555        | Celery task monitor         |

## Available `just` Commands

Run `just` with no arguments to list all available commands:

```
build     Build python image
up        Start up containers
down      Stop containers
prune     Remove containers and their volumes
logs      View container logs
django    Execute any command in the django container
manage    Execute a manage.py command
pytest    Run the backend test suite with coverage
react     Execute any command in the react container
pnpm      Execute a pnpm command
vitest    Run the frontend test suite
```

### Examples

```bash
# Run a management command
just manage makemigrations

# Open a Django shell
just django python manage.py shell

# Install a new frontend package
just pnpm add some-package

# Run backend tests
just pytest

# Run frontend tests
just vitest
```
