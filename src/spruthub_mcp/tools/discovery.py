"""Discovery tools for Sprut.hub API methods."""

import logging
from typing import Any

from ..client import SprutHubClient
from ..schema import get_available_methods, get_categories, get_method_schema, get_methods_by_category

logger = logging.getLogger(__name__)


async def handle_list_methods(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """List all available Sprut.hub JSON-RPC API methods.

    Args:
        args: Tool arguments (optional category filter)
        client: Sprut.hub client instance

    Returns:
        Tool response with method list
    """
    category = args.get("category")

    if category:
        # Filter by category
        methods = get_methods_by_category(category)
        if not methods:
            # Check if category exists
            available_categories = get_categories()
            if category not in available_categories:
                raise ValueError(
                    f"Unknown category: {category}. Available categories: {', '.join(available_categories)}"
                )
    else:
        # Get all methods
        all_method_names = get_available_methods()
        methods = {name: get_method_schema(name) for name in all_method_names}

    # Format method summaries
    method_summaries = [
        {
            "name": method_name,
            "category": method_data["category"],
            "description": method_data["description"],
        }
        for method_name, method_data in methods.items()
    ]

    text = (
        f"Found {len(method_summaries)} methods in category '{category}':"
        if category
        else f"Found {len(method_summaries)} available API methods:"
    )

    return {
        "content": [
            {"type": "text", "text": text},
            {"type": "text", "text": str(method_summaries)},
        ],
        "_meta": {
            "methods": method_summaries,
            "totalCount": len(method_summaries),
            "category": category or "all",
            "availableCategories": get_categories(),
        },
    }


async def handle_get_method_schema(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Get detailed schema for a specific Sprut.hub API method.

    Args:
        args: Tool arguments (methodName required)
        client: Sprut.hub client instance

    Returns:
        Tool response with method schema
    """
    method_name = args.get("methodName")

    if not method_name:
        raise ValueError("methodName parameter is required")

    schema = get_method_schema(method_name)
    if not schema:
        available_methods = get_available_methods()
        preview = ", ".join(available_methods[:10])
        if len(available_methods) > 10:
            preview += "..."
        raise ValueError(f"Method '{method_name}' not found. Available methods: {preview}")

    return {
        "content": [
            {"type": "text", "text": f"Schema for '{method_name}':"},
            {"type": "text", "text": str(schema)},
        ],
        "_meta": {
            "methodName": method_name,
            "schema": schema,
            "category": schema["category"],
        },
    }


async def handle_call_method(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Execute any Sprut.hub JSON-RPC API method.

    Args:
        args: Tool arguments (methodName and parameters)
        client: Sprut.hub client instance

    Returns:
        Tool response with method result
    """
    method_name = args.get("methodName")
    parameters = args.get("parameters", {})

    if not method_name:
        raise ValueError("methodName parameter is required")

    logger.debug(f"Calling method: {method_name}")
    logger.debug(f"Parameters: {parameters}")

    # Validate method exists in schema
    schema = get_method_schema(method_name)
    if not schema:
        available_methods = get_available_methods()
        preview = ", ".join(available_methods[:10])
        if len(available_methods) > 10:
            preview += "..."
        raise ValueError(f"Method '{method_name}' not found. Available methods: {preview}")

    # Execute the method
    result = await client.call_method(method_name, parameters)

    return {
        "content": [
            {"type": "text", "text": f"Called {method_name} successfully"},
            {"type": "text", "text": f"Result: {result}"},
        ],
        "_meta": {
            "methodName": method_name,
            "parameters": parameters,
            "result": result,
            "schema": schema,
        },
    }
