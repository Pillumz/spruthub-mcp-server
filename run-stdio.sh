#!/bin/bash
cd /opt/mcp/spruthub-mcp
source .env
exec /opt/mcp/spruthub-mcp/.venv/bin/python -m spruthub_mcp stdio
