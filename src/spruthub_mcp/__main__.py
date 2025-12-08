"""Entry point for Sprut.hub MCP server.

Supports both stdio and HTTP transports.
"""

import argparse
import asyncio
import logging
import sys

import mcp.server.stdio
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route

from .config import settings
from .server import SpruthubMCPServer

logger = logging.getLogger(__name__)


async def run_stdio():
    """Run server in stdio mode."""
    server_instance = SpruthubMCPServer()
    server = server_instance.get_server()

    logger.info("Sprut.hub MCP server started (stdio mode)")

    try:
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(),
            )
    finally:
        await server_instance.cleanup()


async def run_http():
    """Run server in HTTP mode with SSE transport."""
    import uvicorn

    server_instance = SpruthubMCPServer()
    server = server_instance.get_server()

    sse = SseServerTransport("/messages")

    async def handle_sse(request):
        """Handle SSE endpoint."""
        async with sse.connect_sse(
            request.scope,
            request.receive,
            request._send,
        ) as streams:
            await server.run(
                streams[0],
                streams[1],
                server.create_initialization_options(),
            )

    async def handle_messages(request):
        """Handle messages endpoint."""
        await sse.handle_post_message(request.scope, request.receive, request._send)

    async def handle_health(request):
        """Health check endpoint."""
        from starlette.responses import JSONResponse

        return JSONResponse(
            {
                "status": "ok",
                "name": "spruthub-mcp-server",
                "version": "2.0.0",
                "connected": server_instance.client is not None,
            }
        )

    app = Starlette(
        debug=settings.log_level.lower() == "debug",
        routes=[
            Route("/sse", endpoint=handle_sse),
            Route("/messages", endpoint=handle_messages, methods=["POST"]),
            Route("/health", endpoint=handle_health),
        ],
    )

    logger.info(f"Sprut.hub MCP server running on http://{settings.host}:{settings.port}")
    logger.info(f"SSE endpoint: http://{settings.host}:{settings.port}/sse")
    logger.info(f"Health check: http://{settings.host}:{settings.port}/health")

    config = uvicorn.Config(
        app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )
    server_http = uvicorn.Server(config)

    try:
        await server_http.serve()
    finally:
        await server_instance.cleanup()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Sprut.hub MCP Server")
    parser.add_argument(
        "mode",
        nargs="?",
        default="stdio",
        choices=["stdio", "http", "sse"],
        help="Server mode (default: stdio)",
    )
    args = parser.parse_args()

    # Map 'sse' to 'http' since they're the same thing
    mode = "http" if args.mode in ["http", "sse"] else "stdio"

    try:
        if mode == "http":
            asyncio.run(run_http())
        else:
            asyncio.run(run_stdio())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Server failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
