"""Accessory-related tools for Sprut.hub."""

import logging
from typing import Any

from ..client import SprutHubClient

logger = logging.getLogger(__name__)


def wrap_value(value: Any) -> dict[str, Any]:
    """Wrap a value in the Sprut.hub format.

    API expects: { boolValue: X } or { intValue: X } or { floatValue: X } or { stringValue: X }

    Args:
        value: Value to wrap

    Returns:
        Wrapped value dictionary
    """
    if isinstance(value, bool):
        return {"boolValue": value}
    elif isinstance(value, int):
        return {"intValue": value}
    elif isinstance(value, float):
        return {"floatValue": value}
    elif isinstance(value, str):
        # Try to parse as boolean or number
        if value == "true":
            return {"boolValue": True}
        if value == "false":
            return {"boolValue": False}
        try:
            num = float(value)
            if num.is_integer():
                return {"intValue": int(num)}
            else:
                return {"floatValue": num}
        except ValueError:
            return {"stringValue": value}
    else:
        return {"stringValue": str(value)}


async def handle_list_accessories(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """List all smart home accessories with shallow data.

    Args:
        args: Tool arguments (none required)
        client: Sprut.hub client instance

    Returns:
        Tool response with accessory list
    """
    logger.debug("Listing accessories with shallow data")

    result = await client.call_method(
        "accessory.search",
        {"page": 1, "limit": 100, "expand": "none"},
    )

    # API returns { isSuccess, code, message, data: { accessories: [...] } }
    data = result.get("data", result)
    accessories_raw = data.get("accessories", [])

    logger.debug(f"Found {len(accessories_raw)} accessories")

    accessories = [
        {
            "id": acc.get("id"),
            "name": acc.get("name"),
            "room": acc.get("room", {}).get("name") if acc.get("room") else None,
            "roomId": acc.get("room", {}).get("id") if acc.get("room") else None,
            "online": acc.get("online", True),
            "manufacturer": acc.get("manufacturer"),
            "serviceTypes": [s.get("type") for s in acc.get("services", []) if s.get("type")],
        }
        for acc in accessories_raw
    ]

    return {
        "content": [
            {"type": "text", "text": f"Found {len(accessories)} accessories:"},
            {"type": "text", "text": str(accessories)},
        ]
    }


async def handle_get_accessory(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Get full details for a single accessory.

    Args:
        args: Tool arguments (id required)
        client: Sprut.hub client instance

    Returns:
        Tool response with accessory details
    """
    accessory_id = args.get("id")

    if not accessory_id:
        raise ValueError("id parameter is required. Use spruthub_list_accessories to find accessory IDs.")

    logger.debug(f"Getting accessory {accessory_id}")

    result = await client.call_method(
        "accessory.search",
        {"page": 1, "limit": 100, "expand": "characteristics"},
    )

    data = result.get("data", result)
    accessories = data.get("accessories", [])
    accessory = next((acc for acc in accessories if acc.get("id") == accessory_id), None)

    if not accessory:
        raise ValueError(f"Accessory with ID {accessory_id} not found")

    return {
        "content": [
            {"type": "text", "text": f"Accessory {accessory_id}:"},
            {"type": "text", "text": str(accessory)},
        ]
    }


async def handle_control_accessory(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Control a single smart home device.

    Args:
        args: Tool arguments (id, characteristic, value required; serviceType optional)
        client: Sprut.hub client instance

    Returns:
        Tool response with control result
    """
    accessory_id = args.get("id")
    characteristic = args.get("characteristic")
    value = args.get("value")
    service_type = args.get("serviceType")

    if not accessory_id:
        raise ValueError("id parameter is required. Use spruthub_list_accessories to find accessory IDs.")
    if not characteristic:
        raise ValueError('characteristic parameter is required (e.g., "On", "Brightness", "TargetTemperature").')
    if value is None:
        raise ValueError("value parameter is required.")

    logger.debug(f"Controlling accessory {accessory_id}: {characteristic} = {value}")

    # First, fetch the accessory to find service and characteristic IDs
    search_result = await client.call_method(
        "accessory.search",
        {"page": 1, "limit": 100, "expand": "characteristics"},
    )

    data = search_result.get("data", search_result)
    accessories = data.get("accessories", [])
    accessory = next((acc for acc in accessories if acc.get("id") == accessory_id), None)

    if not accessory:
        raise ValueError(f"Accessory with ID {accessory_id} not found")

    # Find the characteristic by type name
    found_characteristic = None
    found_service = None

    for service in accessory.get("services", []):
        # If serviceType specified, filter by it
        if service_type and service.get("type") != service_type:
            continue

        for char in service.get("characteristics", []):
            char_type = char.get("control", {}).get("type") or char.get("type")
            if char_type == characteristic:
                found_characteristic = char
                found_service = service
                break

        if found_characteristic:
            break

    if not found_characteristic:
        service_hint = f' in service type "{service_type}"' if service_type else ""
        raise ValueError(
            f'Characteristic "{characteristic}" not found on accessory {accessory_id}{service_hint}. '
            "Use spruthub_get_accessory to see available characteristics."
        )

    # Check if characteristic is writable
    if found_characteristic.get("control", {}).get("write") is False:
        raise ValueError(f'Characteristic "{characteristic}" is read-only and cannot be controlled.')

    # Build the API payload
    payload = {
        "characteristic": {
            "update": {
                "aId": found_characteristic.get("aId"),
                "sId": found_characteristic.get("sId"),
                "cId": found_characteristic.get("cId"),
                "control": {"value": wrap_value(value)},
            }
        }
    }

    logger.debug(f"Sending characteristic.update: {payload}")

    result = await client.call_method("characteristic.update", payload)

    response_data = {
        "success": True,
        "accessoryId": accessory_id,
        "accessoryName": accessory.get("name"),
        "service": found_service.get("type"),
        "characteristic": characteristic,
        "value": value,
        "payload": payload,
    }

    return {
        "content": [
            {"type": "text", "text": str(response_data)},
        ]
    }
