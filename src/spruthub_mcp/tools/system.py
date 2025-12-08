"""System-related tools for Sprut.hub."""

import logging
from typing import Any

from ..client import SprutHubClient

logger = logging.getLogger(__name__)


async def handle_get_logs(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Get recent system logs.

    Args:
        args: Tool arguments (count optional, default 20, max 100)
        client: Sprut.hub client instance

    Returns:
        Tool response with logs
    """
    count = args.get("count", 20)

    if count > 100:
        count = 100
        logger.warning(f"Requested count exceeds maximum, limiting to {count}")

    logger.debug(f"Getting {count} log entries")

    result = await client.call_method("log.list", {"count": count})

    # API returns { isSuccess, code, message, data: [...] } or array directly
    data = result.get("data", result)
    logs = data if isinstance(data, list) else data.get("logs", [])

    return {
        "content": [
            {"type": "text", "text": f"Retrieved {len(logs)} log entries:"},
            {"type": "text", "text": str(logs)},
        ]
    }
