"""Room-related tools for Sprut.hub."""

import logging
from typing import Any

from ..client import SprutHubClient
from .accessories import wrap_value

logger = logging.getLogger(__name__)


async def handle_list_rooms(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """List all rooms in the smart home.

    Args:
        args: Tool arguments (none required)
        client: Sprut.hub client instance

    Returns:
        Tool response with room list
    """
    logger.debug("Listing all rooms")

    result = await client.call_method("room.list", {"room": {"list": {}}})

    # API may return { isSuccess, code, message, data: [...] } or array directly
    data = result.get("data", result)
    rooms = data if isinstance(data, list) else data.get("rooms", [])

    return {
        "content": [
            {"type": "text", "text": f"Found {len(rooms)} rooms:"},
            {"type": "text", "text": str(rooms)},
        ]
    }


async def handle_control_room(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Control all devices in a room at once.

    Args:
        args: Tool arguments (roomId, characteristic, value required; serviceType optional)
        client: Sprut.hub client instance

    Returns:
        Tool response with control result
    """
    room_id = args.get("roomId")
    characteristic = args.get("characteristic")
    value = args.get("value")
    service_type = args.get("serviceType")

    if not room_id:
        raise ValueError("roomId parameter is required. Use spruthub_list_rooms to find room IDs.")
    if not characteristic:
        raise ValueError('characteristic parameter is required (e.g., "On", "Brightness").')
    if value is None:
        raise ValueError("value parameter is required.")

    logger.debug(f"Controlling room {room_id}: {characteristic} = {value}")

    # First, get all accessories in the room
    search_result = await client.call_method(
        "accessory.search",
        {"page": 1, "limit": 100, "expand": "characteristics"},
    )

    data = search_result.get("data", search_result)
    all_accessories = data.get("accessories", [])

    # Filter accessories by room
    room_accessories = [acc for acc in all_accessories if acc.get("room", {}).get("id") == room_id]

    if not room_accessories:
        raise ValueError(f"No accessories found in room {room_id}")

    logger.debug(f"Found {len(room_accessories)} accessories in room {room_id}")

    # Control each accessory
    controlled = []
    errors = []

    for accessory in room_accessories:
        try:
            # Find the characteristic
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
                logger.debug(
                    f"Characteristic '{characteristic}' not found on accessory {accessory.get('id')} "
                    f"({accessory.get('name')})"
                )
                continue

            # Check if characteristic is writable
            if found_characteristic.get("control", {}).get("write") is False:
                logger.debug(
                    f"Characteristic '{characteristic}' is read-only on accessory {accessory.get('id')} "
                    f"({accessory.get('name')})"
                )
                continue

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

            await client.call_method("characteristic.update", payload)

            controlled.append(
                {
                    "id": accessory.get("id"),
                    "name": accessory.get("name"),
                    "service": found_service.get("type"),
                }
            )

        except Exception as e:
            errors.append(
                {
                    "id": accessory.get("id"),
                    "name": accessory.get("name"),
                    "error": str(e),
                }
            )
            logger.error(f"Failed to control accessory {accessory.get('id')}: {e}")

    response_data = {
        "success": True,
        "roomId": room_id,
        "characteristic": characteristic,
        "value": value,
        "controlled": controlled,
        "controlledCount": len(controlled),
        "errors": errors,
    }

    return {
        "content": [
            {"type": "text", "text": str(response_data)},
        ]
    }
