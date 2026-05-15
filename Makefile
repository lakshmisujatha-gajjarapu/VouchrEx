SHELL := /bin/zsh

COMPOSE ?= docker compose
YARN ?= corepack yarn
API_WORKSPACE ?= vouchrex-api
MOBILE_WORKSPACE ?= vouchrex-mobile
ADMIN_WORKSPACE ?= vouchrex-admin
COMPOSE_PROJECT_NAME ?= vouchrex

export COMPOSE_PROJECT_NAME

.PHONY: help install infra-up infra-down up down build ps logs api-dev mobile-dev mobile-all mobile-ios mobile-android mobile-web mobile-build-all admin-dev admin-build mobile-build lint typecheck test check clean reset-infra migrate migrate-deploy push seed studio

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

mobile-dev: ## Start Expo dev server (press i=iOS, a=Android, w=web)
	$(YARN) workspace $(MOBILE_WORKSPACE) start

mobile-all: ## Start Expo dev server and open iOS simulator, Android emulator, and web
	$(YARN) workspace $(MOBILE_WORKSPACE) expo start --ios --android --web

mobile-ios: ## (One-time) Native build + install iOS dev client on simulator
	$(YARN) workspace $(MOBILE_WORKSPACE) expo run:ios

mobile-android: ## (One-time) Native build + install Android dev client on emulator
	$(YARN) workspace $(MOBILE_WORKSPACE) expo run:android

mobile-build-all: mobile-ios mobile-android ## (One-time) Native build for both iOS simulator and Android emulator

mobile-web: ## Start Expo web dev server in browser
	$(YARN) workspace $(MOBILE_WORKSPACE) web

mobile-build: ## Export the mobile app for web
	$(YARN) workspace $(MOBILE_WORKSPACE) build

admin-dev: ## Run the Next.js admin console (port 3011)
	$(YARN) workspace $(ADMIN_WORKSPACE) dev

admin-build: ## Build the admin console for production
	$(YARN) workspace $(ADMIN_WORKSPACE) build

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
