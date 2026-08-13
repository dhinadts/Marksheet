.PHONY: install dev build lint typecheck test up down

install:
	npm install
	python -m pip install -e "./ai-service[dev]"
	cd mobile && flutter pub get

dev:
	docker compose up --build

build:
	npm run build

lint:
	npm run lint
	python -m ruff check ai-service
	cd mobile && flutter analyze

typecheck:
	npm run typecheck
	python -m mypy ai-service/app

test:
	npm test
	python -m pytest ai-service/tests
	cd mobile && flutter test

up:
	docker compose up -d --build

down:
	docker compose down

