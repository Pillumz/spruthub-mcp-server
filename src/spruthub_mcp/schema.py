"""Sprut.hub API schema definitions.

This module provides basic schema information for Sprut.hub JSON-RPC methods.
For full schema support, integrate with the actual Sprut.hub API documentation.
"""

from typing import Any

# Basic method catalog - this is a simplified version
# In production, this should be loaded from Sprut.hub API documentation
METHODS_CATALOG: dict[str, dict[str, Any]] = {
    # Accessory methods
    "accessory.search": {
        "category": "accessory",
        "description": "Search for accessories with filtering and pagination",
        "params": {
            "page": "Page number (default: 1)",
            "limit": "Results per page (default: 100)",
            "expand": "Expansion level: 'none', 'services', 'characteristics' (default: 'none')",
        },
    },
    "accessory.get": {
        "category": "accessory",
        "description": "Get full details for a specific accessory",
        "params": {
            "id": "Accessory ID (required)",
        },
    },
    "characteristic.update": {
        "category": "accessory",
        "description": "Update a characteristic value",
        "params": {
            "characteristic": {
                "update": {
                    "aId": "Accessory ID",
                    "sId": "Service ID",
                    "cId": "Characteristic ID",
                    "control": {"value": "Value wrapper (boolValue, intValue, floatValue, or stringValue)"},
                }
            }
        },
    },
    # Room methods
    "room.list": {
        "category": "room",
        "description": "List all rooms",
        "params": {
            "room": {"list": {}},
        },
    },
    # Scenario methods
    "scenario.search": {
        "category": "scenario",
        "description": "Search for scenarios",
        "params": {
            "page": "Page number (default: 1)",
            "limit": "Results per page (default: 100)",
        },
    },
    "scenario.get": {
        "category": "scenario",
        "description": "Get full details for a specific scenario",
        "params": {
            "id": "Scenario ID (required)",
        },
    },
    "scenario.run": {
        "category": "scenario",
        "description": "Execute a scenario",
        "params": {
            "scenario": {"run": {"id": "Scenario ID"}},
        },
    },
    # System methods
    "log.list": {
        "category": "system",
        "description": "Get system logs",
        "params": {
            "count": "Number of log entries (default: 20, max: 100)",
        },
    },
    # Auth methods
    "auth": {
        "category": "system",
        "description": "Authenticate with Sprut.hub server",
        "params": {
            "email": "User email",
            "password": "User password",
            "serial": "Device serial number",
        },
    },
}


def get_available_methods() -> list[str]:
    """Get list of all available method names."""
    return list(METHODS_CATALOG.keys())


def get_categories() -> list[str]:
    """Get list of all available categories."""
    categories = {method_data["category"] for method_data in METHODS_CATALOG.values()}
    return sorted(categories)


def get_methods_by_category(category: str) -> dict[str, dict[str, Any]]:
    """Get all methods in a specific category.

    Args:
        category: Category name

    Returns:
        Dictionary of method names to their schema data
    """
    return {
        method_name: method_data
        for method_name, method_data in METHODS_CATALOG.items()
        if method_data["category"] == category
    }


def get_method_schema(method_name: str) -> dict[str, Any] | None:
    """Get schema for a specific method.

    Args:
        method_name: Method name

    Returns:
        Method schema or None if not found
    """
    return METHODS_CATALOG.get(method_name)
