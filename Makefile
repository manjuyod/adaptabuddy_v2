.PHONY: help install supabase-start supabase-status supabase-stop supabase-reset supabase-lint supabase-link supabase-pull-schema supabase-pull-data supabase-import-remote-data supabase-clean-artifacts dev-api dev-health dev build-api build-health build lint lint-health typecheck typecheck-health test test-health test-backend ci-quality docker-config docker-build api-container-build api-container-start api-container-stop api-container-logs api-container-status

help:
	@echo "Targets:"
	@echo "  install              npm install"
	@echo "  supabase-start       Start local Supabase CLI stack"
	@echo "  supabase-status      Show local Supabase CLI status"
	@echo "  supabase-stop        Stop local Supabase CLI stack"
	@echo "  supabase-reset       Reset local Supabase database"
	@echo "  supabase-lint        Lint local Supabase database"
	@echo "  supabase-link        Link CLI to read-only target project ref"
	@echo "  supabase-pull-schema Dump remote schema snapshot to ignored schema.remote.sql"
	@echo "  supabase-pull-data   Dump remote data to ignored seed.remote.sql"
	@echo "  supabase-import-remote-data Reset local DB and import ignored remote data dump"
	@echo "  supabase-clean-artifacts Remove local Supabase artifacts (.branches, .temp)"
	@echo "  dev-api              Run Rust API server"
	@echo "  dev-health           Run health web app"
	@echo "  dev                  Run API and health app separately as documented"
	@echo "  build-api            Build Rust API server"
	@echo "  build-health         Build health web app"
	@echo "  lint                 Lint apps/web"
	@echo "  lint-health          Lint frontend/health-app workspace facade"
	@echo "  typecheck            Typecheck apps/web"
	@echo "  typecheck-health     Typecheck frontend/health-app workspace facade"
	@echo "  test                 Run tests across workspaces"
	@echo "  test-health          Run tests via frontend/health-app facade"
	@echo "  test-backend         Run backend workspace tests"
	@echo "  ci-quality           Run repository quality gate"
	@echo "  docker-config        Validate compose configuration"
	@echo "  docker-build         Build compose services"
	@echo "  api-container-build  Build Rust API container"
	@echo "  api-container-start  Start Rust API container"
	@echo "  api-container-stop   Stop Rust API container"
	@echo "  api-container-logs   Follow Rust API container logs"
	@echo "  api-container-status Show Rust API container status"

install:
	npm install

supabase-start:
	npx supabase start

supabase-status:
	npx supabase status

supabase-stop:
	npx supabase stop

supabase-reset:
	npx supabase db reset

supabase-lint:
	npx supabase db lint --local --fail-on warning

supabase-link:
	npx supabase link --project-ref vezfyhbrrpokheqipepa

supabase-pull-schema:
	npx supabase db dump --linked --schema public,auth,storage --file supabase/schema.remote.sql

supabase-pull-data:
	npx supabase db dump --linked --data-only --schema public,auth,storage --file supabase/seed.remote.sql

supabase-import-remote-data:
	npm run supabase:import:remote-data

supabase-clean-artifacts:
	@node -e "const fs = require('fs'); const targets = ['supabase/.branches', 'supabase/.temp']; for (const target of targets) { if (fs.existsSync(target)) { fs.rmSync(target, { recursive: true, force: true }); } }"

dev-api:
	npm run dev:api

dev-health:
	npm run dev:health-app

dev:
	@echo "Run 'make supabase-start', then run 'make dev-api' and 'make dev-health' in separate terminals."

build-api:
	npm run build:api

build-health:
	npm run build:health-app

build: build-api build-health

lint:
	npm run lint

lint-health:
	npm run lint:health-app

typecheck:
	npm run typecheck

typecheck-health:
	npm run typecheck:health-app

test:
	npm run test

test-health:
	npm run test:health-app

test-backend:
	npm run test:backend

ci-quality:
	npm run ci:quality

docker-config:
	docker compose -f infra/docker-compose.yml config

docker-build:
	docker compose -f infra/docker-compose.yml build

api-container-build:
	docker compose -f infra/docker-compose.yml build api

api-container-start:
	docker compose -f infra/docker-compose.yml up -d api

api-container-stop:
	docker compose -f infra/docker-compose.yml stop api

api-container-logs:
	docker compose -f infra/docker-compose.yml logs -f api

api-container-status:
	docker compose -f infra/docker-compose.yml ps api
