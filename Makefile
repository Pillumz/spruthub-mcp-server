# Makefile for spruthub-mcp

MODULE := spruthub_mcp
PORT := 9084

.PHONY: help install dev run run-http test lint format clean

help:
	@echo "Available targets:"
	@echo "  install    - Install dependencies with uv"
	@echo "  dev        - Install with dev dependencies"
	@echo "  run        - Run server in stdio mode"
	@echo "  run-http   - Run server in HTTP mode"
	@echo "  test       - Run tests"
	@echo "  lint       - Run linter"
	@echo "  format     - Format code"
	@echo "  clean      - Clean build artifacts"

install:
	uv sync --no-dev

dev:
	uv sync

run:
	uv run python -m $(MODULE)

run-http:
	uv run python -m $(MODULE) http

test:
	uv run pytest

lint:
	uv run ruff check src/

format:
	uv run ruff format src/

clean:
	rm -rf .venv/ .pytest_cache/ __pycache__/ dist/ *.egg-info/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
