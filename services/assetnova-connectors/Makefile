.PHONY: install test lint run up down
install:
	python -m pip install -e '.[dev]'
test:
	pytest -q
lint:
	ruff check src tests
run:
	uvicorn assetnova_connectors.api:app --reload --port 8080
up:
	docker compose up --build -d
down:
	docker compose down

