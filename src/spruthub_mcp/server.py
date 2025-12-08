"""Main MCP server implementation for Sprut.hub."""

import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.types import TextContent, Tool

from .client import SprutHubClient
from .config import settings
from .tools import (
    handle_call_method,
    handle_control_accessory,
    handle_control_room,
    handle_get_accessory,
    handle_get_logs,
    handle_get_method_schema,
    handle_get_scenario,
    handle_list_accessories,
    handle_list_methods,
    handle_list_rooms,
    handle_list_scenarios,
    handle_run_scenario,
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.log_level.lower() == "debug" else logging.INFO,
    format="[%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


class SpruthubMCPServer:
    """MCP server for Sprut.hub smart home control."""

    def __init__(self):
        """Initialize the server."""
        self.server = Server("spruthub-mcp-server")
        self.client: SprutHubClient | None = None
        self._setup_handlers()

    def _setup_handlers(self):
        """Set up MCP request handlers."""

        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            """List available tools."""
            return [
                Tool(
                    name="spruthub_list_methods",
                    description="List all available Sprut.hub JSON-RPC API methods with their categories and descriptions",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "description": "Filter methods by category (hub, accessory, scenario, room, system)",
                            },
                        },
                    },
                ),
                Tool(
                    name="spruthub_get_method_schema",
                    description="Get detailed schema for a specific Sprut.hub API method including parameters, return type, examples",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "methodName": {
                                "type": "string",
                                "description": 'The method name (e.g., "accessory.search", "characteristic.update")',
                            },
                        },
                        "required": ["methodName"],
                    },
                ),
                Tool(
                    name="spruthub_call_method",
                    description="Execute any Sprut.hub JSON-RPC API method. IMPORTANT: You MUST call spruthub_get_method_schema first to understand the exact parameter structure before calling this method. Never guess parameters.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "methodName": {
                                "type": "string",
                                "description": 'The method name to call (e.g., "accessory.search", "characteristic.update")',
                            },
                            "parameters": {
                                "type": "object",
                                "description": "Method parameters exactly as defined in the method schema. MUST call spruthub_get_method_schema first to get the correct parameter structure. Do not guess parameter names or structure.",
                            },
                        },
                        "required": ["methodName"],
                    },
                ),
                Tool(
                    name="spruthub_list_accessories",
                    description="List all smart home accessories with shallow data (id, name, room, online status). Use this first to discover accessory IDs before controlling devices.",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                    },
                ),
                Tool(
                    name="spruthub_get_accessory",
                    description="Get full details for a single accessory including all services and characteristics. Requires accessory ID from spruthub_list_accessories.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number",
                                "description": "Accessory ID (use spruthub_list_accessories to find IDs)",
                            },
                        },
                        "required": ["id"],
                    },
                ),
                Tool(
                    name="spruthub_list_rooms",
                    description="List all rooms in the smart home. Use this to discover room IDs before room-wide control.",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                    },
                ),
                Tool(
                    name="spruthub_list_scenarios",
                    description="List all automation scenarios with shallow data (id, name, enabled). Use this to discover scenario IDs before running them.",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                    },
                ),
                Tool(
                    name="spruthub_get_scenario",
                    description="Get full details for a single scenario including triggers, conditions, and actions. Requires scenario ID from spruthub_list_scenarios.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number",
                                "description": "Scenario ID (use spruthub_list_scenarios to find IDs)",
                            },
                        },
                        "required": ["id"],
                    },
                ),
                Tool(
                    name="spruthub_get_logs",
                    description="Get recent system logs. Default 20 entries, max 100.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "count": {
                                "type": "number",
                                "description": "Number of log entries to retrieve (default: 20, max: 100)",
                            },
                        },
                    },
                ),
                Tool(
                    name="spruthub_control_accessory",
                    description="Control a single smart home device by setting a characteristic value. Requires accessory ID from spruthub_list_accessories.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number",
                                "description": "Accessory ID (use spruthub_list_accessories to find IDs)",
                            },
                            "characteristic": {
                                "type": "string",
                                "description": 'Characteristic type to set (e.g., "On", "Brightness", "TargetTemperature")',
                            },
                            "value": {
                                "description": "New value for the characteristic (type depends on characteristic)",
                            },
                        },
                        "required": ["id", "characteristic", "value"],
                    },
                ),
                Tool(
                    name="spruthub_control_room",
                    description="Control all devices in a room at once. Optionally filter by device type. Requires room ID from spruthub_list_rooms.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "roomId": {
                                "type": "number",
                                "description": "Room ID (use spruthub_list_rooms to find IDs)",
                            },
                            "characteristic": {
                                "type": "string",
                                "description": 'Characteristic type to set on all devices (e.g., "On", "Brightness")',
                            },
                            "value": {
                                "description": "New value for the characteristic",
                            },
                            "serviceType": {
                                "type": "string",
                                "description": 'Optional: filter by device type (e.g., "Lightbulb", "Switch", "Thermostat")',
                            },
                        },
                        "required": ["roomId", "characteristic", "value"],
                    },
                ),
                Tool(
                    name="spruthub_run_scenario",
                    description="Execute an automation scenario. Requires scenario ID from spruthub_list_scenarios.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number",
                                "description": "Scenario ID (use spruthub_list_scenarios to find IDs)",
                            },
                        },
                        "required": ["id"],
                    },
                ),
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
            """Handle tool calls."""
            logger.debug(f"Tool call: {name}, args: {arguments}")

            try:
                # Ensure connected for all tools except discovery tools
                if name not in ["spruthub_list_methods", "spruthub_get_method_schema"]:
                    await self._ensure_connected()

                # Route to appropriate handler
                if name == "spruthub_list_methods":
                    result = await handle_list_methods(arguments, self.client)
                elif name == "spruthub_get_method_schema":
                    result = await handle_get_method_schema(arguments, self.client)
                elif name == "spruthub_call_method":
                    result = await handle_call_method(arguments, self.client)
                elif name == "spruthub_list_accessories":
                    result = await handle_list_accessories(arguments, self.client)
                elif name == "spruthub_get_accessory":
                    result = await handle_get_accessory(arguments, self.client)
                elif name == "spruthub_list_rooms":
                    result = await handle_list_rooms(arguments, self.client)
                elif name == "spruthub_list_scenarios":
                    result = await handle_list_scenarios(arguments, self.client)
                elif name == "spruthub_get_scenario":
                    result = await handle_get_scenario(arguments, self.client)
                elif name == "spruthub_get_logs":
                    result = await handle_get_logs(arguments, self.client)
                elif name == "spruthub_control_accessory":
                    result = await handle_control_accessory(arguments, self.client)
                elif name == "spruthub_control_room":
                    result = await handle_control_room(arguments, self.client)
                elif name == "spruthub_run_scenario":
                    result = await handle_run_scenario(arguments, self.client)
                else:
                    raise ValueError(f"Unknown tool: {name}")

                # Convert result to TextContent list
                content_list = result.get("content", [])
                return [TextContent(type="text", text=item["text"]) for item in content_list]

            except Exception as e:
                logger.error(f"Tool execution failed: {e}")
                return [TextContent(type="text", text=f"Error: {str(e)}")]

    async def _ensure_connected(self):
        """Ensure connection to Sprut.hub server."""
        if not self.client:
            logger.info("Auto-connecting to Sprut.hub server...")

            try:
                self.client = SprutHubClient(
                    ws_url=settings.spruthub_ws_url,
                    email=settings.spruthub_email,
                    password=settings.spruthub_password,
                    serial=settings.spruthub_serial,
                )

                await self.client.connect()
                logger.info("Connected successfully")

            except Exception as e:
                logger.error(f"Failed to connect to Sprut.hub: {e}")
                self.client = None
                raise RuntimeError(f"Failed to connect: {e}")

    async def cleanup(self):
        """Clean up resources."""
        if self.client:
            try:
                await self.client.close()
                logger.info("Successfully disconnected from Sprut.hub server")
            except Exception as e:
                logger.error(f"Failed to disconnect gracefully: {e}")
            finally:
                self.client = None

    def get_server(self) -> Server:
        """Get the MCP server instance."""
        return self.server
