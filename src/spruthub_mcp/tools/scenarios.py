"""Scenario-related tools for Sprut.hub."""

import logging
from typing import Any

from ..client import SprutHubClient

logger = logging.getLogger(__name__)


async def handle_list_scenarios(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """List all automation scenarios.

    Args:
        args: Tool arguments (none required)
        client: Sprut.hub client instance

    Returns:
        Tool response with scenario list
    """
    logger.debug("Listing scenarios with shallow data")

    result = await client.call_method(
        "scenario.search",
        {"page": 1, "limit": 100},
    )

    # API returns { isSuccess, code, message, data: { scenarios: [...] } }
    data = result.get("data", result)
    scenarios_raw = data.get("scenarios", [])

    logger.debug(f"Found {len(scenarios_raw)} scenarios")

    scenarios = [
        {
            "id": scen.get("id"),
            "name": scen.get("name"),
            "enabled": scen.get("enabled", True),
        }
        for scen in scenarios_raw
    ]

    return {
        "content": [
            {"type": "text", "text": f"Found {len(scenarios)} scenarios:"},
            {"type": "text", "text": str(scenarios)},
        ]
    }


async def handle_get_scenario(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Get full details for a single scenario.

    Args:
        args: Tool arguments (id required)
        client: Sprut.hub client instance

    Returns:
        Tool response with scenario details
    """
    scenario_id = args.get("id")

    if not scenario_id:
        raise ValueError("id parameter is required. Use spruthub_list_scenarios to find scenario IDs.")

    logger.debug(f"Getting scenario {scenario_id}")

    result = await client.call_method(
        "scenario.search",
        {"page": 1, "limit": 100},
    )

    data = result.get("data", result)
    scenarios = data.get("scenarios", [])
    scenario = next((scen for scen in scenarios if scen.get("id") == scenario_id), None)

    if not scenario:
        raise ValueError(f"Scenario with ID {scenario_id} not found")

    return {
        "content": [
            {"type": "text", "text": f"Scenario {scenario_id}:"},
            {"type": "text", "text": str(scenario)},
        ]
    }


async def handle_run_scenario(args: dict[str, Any], client: SprutHubClient) -> dict[str, Any]:
    """Execute an automation scenario.

    Args:
        args: Tool arguments (id required)
        client: Sprut.hub client instance

    Returns:
        Tool response with run result
    """
    scenario_id = args.get("id")

    if not scenario_id:
        raise ValueError("id parameter is required. Use spruthub_list_scenarios to find scenario IDs.")

    logger.debug(f"Running scenario {scenario_id}")

    await client.call_method(
        "scenario.run",
        {"scenario": {"run": {"id": scenario_id}}},
    )

    response_data = {
        "success": True,
        "scenarioId": scenario_id,
    }

    return {
        "content": [
            {"type": "text", "text": str(response_data)},
        ]
    }
