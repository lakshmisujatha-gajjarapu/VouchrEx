SHELL := /bin/zsh

COMPOSE ?= docker compose
YARN ?= corepack yarn
API_WORKSPACE ?= couponbazaar-api
MOBILE_WORKSPACE ?= couponbazaar-mobile
COMPOSE_PROJECT_NAME ?= couponbazaar

export COMPOSE_PROJECT_NAME

.PHONY: help install infra-up infra-down up down build ps logs api-dev mobile-dev migrate migrate-deploy push seed studio lint typecheck test check clean reset-infra

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install workspace dependencies
	$(YARN) install

infra-up: ## Start Postgres, Redis, and MinIO in the background
	$(COMPOSE) up -d db redis minio

infra-down: ## Stop Postgres, Redis, and MinIO
	$(COMPOSE) stop db redis minio

up: ## Start the full local stack in the background
	$(COMPOSE) up -d

down: ## Stop and remove the local stack
	$(COMPOSE) down

build: ## Build all workspaces
	$(YARN) build

clean: ## Remove workspace build artifacts and local Expo cache
	$(YARN) clean

ps: ## Show compose service status
	$(COMPOSE) ps

logs: ## Follow compose logs
	$(COMPOSE) logs -f

api-dev: infra-up ## Run the API directly with local env loading
	$(YARN) workspace $(API_WORKSPACE) start:dev

mobile-dev: ## Run the Expo React Native app
	$(YARN) workspace $(MOBILE_WORKSPACE) start

migrate: ## Apply Prisma migrations in development
	$(YARN) workspace $(API_WORKSPACE) prisma:migrate:dev

migrate-deploy: ## Apply checked-in Prisma migrations
	$(YARN) workspace $(API_WORKSPACE) prisma:migrate:deploy

push: ## Push Prisma schema without creating a migration
	$(YARN) workspace $(API_WORKSPACE) prisma:push

seed: ## Seed starter brands into the database
	$(YARN) workspace $(API_WORKSPACE) prisma:seed

studio: ## Start Prisma Studio via compose dev profile
	$(COMPOSE) --profile dev up -d prisma-studio

lint: ## Run ESLint
	$(YARN) lint

typecheck: ## Run TypeScript typechecking
	$(YARN) typecheck

test: ## Run the API service-level test suite
	$(YARN) test

check: ## Run lint, typecheck, and tests
	$(MAKE) lint
	$(MAKE) typecheck
	$(MAKE) test

reset-infra: ## Remove local compose services and volumes for this project
	$(COMPOSE) down -v
