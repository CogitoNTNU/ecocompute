.DEFAULT_GOAL := help

PYTHON := .venv/bin/python
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 5173

.PHONY: help setup browsers dev backend frontend build test test-backend test-frontend test-e2e lint format check terraform-check require-setup

help:
	@printf '%s\n' \
	  'make setup           Install dependencies and Chromium; preserve existing .env' \
	  'make dev             Start both local servers; Ctrl+C stops both' \
	  'make backend         Start just the API with reload' \
	  'make frontend        Start just Vite with hot reload' \
	  'make test            Run backend and frontend unit/API tests (mocked Azure)' \
	  'make test-e2e        Run browser tests (mocked Azure)' \
	  'make check           Run formatting checks, build and all application tests' \
	  'make build           Build the production React bundle' \
	  'make format          Format Python, React and CSS source' \
	  'make terraform-check Initialize providers and validate; never deploy' \
	  'Ports: make dev BACKEND_PORT=8001 FRONTEND_PORT=5174'

setup:
	@test -d .venv || uv venv
	uv pip install --python $(PYTHON) -r backend/requirements-dev.txt
	npm --prefix frontend ci
	@test -f .env || cp .env.example .env
	$(MAKE) browsers

browsers:
	cd frontend && npx --no-install playwright install chromium

require-setup:
	@test -x $(PYTHON) && test -d frontend/node_modules || \
	  { printf '%s\n' 'Dependencies are missing. Run make setup first.'; exit 1; }

dev: require-setup
	$(PYTHON) scripts/dev.py --backend-port $(BACKEND_PORT) --frontend-port $(FRONTEND_PORT)

backend: require-setup
	$(PYTHON) -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port $(BACKEND_PORT) --reload --reload-dir backend

frontend: require-setup
	API_PROXY_TARGET=http://127.0.0.1:$(BACKEND_PORT) npm --prefix frontend run dev -- --port $(FRONTEND_PORT) --strictPort

build: require-setup
	npm --prefix frontend run build

test: test-backend test-frontend

test-backend: require-setup
	$(PYTHON) -m pytest -c backend/pyproject.toml backend/tests

test-frontend: require-setup
	npm --prefix frontend test

test-e2e: require-setup
	npm --prefix frontend run test:e2e

lint: require-setup
	$(PYTHON) -m ruff check backend scripts
	$(PYTHON) -m ruff format --check backend scripts
	npm --prefix frontend run format:check

format: require-setup
	$(PYTHON) -m ruff format backend scripts
	npm --prefix frontend run format

check: lint build test test-e2e

terraform-check:
	terraform -chdir=infra/terraform/azure fmt -check -recursive
	terraform -chdir=infra/terraform/azure init -backend=false
	terraform -chdir=infra/terraform/azure validate
