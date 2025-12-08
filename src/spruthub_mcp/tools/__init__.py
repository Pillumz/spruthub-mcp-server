"""Tool implementations for Sprut.hub MCP server."""

from .accessories import (
    handle_control_accessory,
    handle_get_accessory,
    handle_list_accessories,
)
from .discovery import handle_call_method, handle_get_method_schema, handle_list_methods
from .rooms import handle_control_room, handle_list_rooms
from .scenarios import handle_get_scenario, handle_list_scenarios, handle_run_scenario
from .system import handle_get_logs

__all__ = [
    # Discovery
    "handle_list_methods",
    "handle_get_method_schema",
    "handle_call_method",
    # Accessories
    "handle_list_accessories",
    "handle_get_accessory",
    "handle_control_accessory",
    # Rooms
    "handle_list_rooms",
    "handle_control_room",
    # Scenarios
    "handle_list_scenarios",
    "handle_get_scenario",
    "handle_run_scenario",
    # System
    "handle_get_logs",
]
