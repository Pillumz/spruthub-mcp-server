"""WebSocket client for Sprut.hub JSON-RPC API."""

import asyncio
import json
import logging
from typing import Any

import websockets
from websockets.client import WebSocketClientProtocol

logger = logging.getLogger(__name__)


class SprutHubClient:
    """WebSocket-based client for Sprut.hub smart home system."""

    def __init__(
        self,
        ws_url: str,
        email: str,
        password: str,
        serial: str,
    ):
        """Initialize Sprut.hub client.

        Args:
            ws_url: WebSocket URL (e.g., wss://web.spruthub.ru/spruthub)
            email: Email for authentication
            password: Password for authentication
            serial: Device serial number
        """
        self.ws_url = ws_url
        self.email = email
        self.password = password
        self.serial = serial
        self.ws: WebSocketClientProtocol | None = None
        self._request_id = 0
        self._pending_requests: dict[int, asyncio.Future] = {}
        self._connected_event = asyncio.Event()
        self._receive_task: asyncio.Task | None = None

    async def connect(self) -> None:
        """Connect to Sprut.hub WebSocket server and authenticate."""
        if self.ws and not self.ws.closed:
            logger.debug("Already connected")
            return

        logger.info(f"Connecting to {self.ws_url}...")
        self.ws = await websockets.connect(self.ws_url)

        # Start receiving messages
        self._receive_task = asyncio.create_task(self._receive_loop())

        # Authenticate
        await self._authenticate()

        self._connected_event.set()
        logger.info("Connected and authenticated successfully")

    async def _authenticate(self) -> None:
        """Authenticate with Sprut.hub server."""
        auth_payload = {
            "jsonrpc": "2.0",
            "method": "auth",
            "params": {
                "email": self.email,
                "password": self.password,
                "serial": self.serial,
            },
            "id": self._get_request_id(),
        }

        result = await self._send_request(auth_payload)

        if not result.get("isSuccess"):
            raise RuntimeError(f"Authentication failed: {result.get('message', 'Unknown error')}")

        logger.debug("Authentication successful")

    def _get_request_id(self) -> int:
        """Get next request ID."""
        self._request_id += 1
        return self._request_id

    async def _send_request(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Send JSON-RPC request and wait for response.

        Args:
            payload: JSON-RPC request payload

        Returns:
            Response data

        Raises:
            RuntimeError: If not connected or request fails
        """
        if not self.ws or self.ws.closed:
            raise RuntimeError("Not connected to Sprut.hub server")

        request_id = payload["id"]
        future: asyncio.Future = asyncio.Future()
        self._pending_requests[request_id] = future

        logger.debug(f"Sending request {request_id}: {payload['method']}")
        await self.ws.send(json.dumps(payload))

        try:
            # Wait for response with timeout
            result = await asyncio.wait_for(future, timeout=30.0)
            return result
        except asyncio.TimeoutError:
            self._pending_requests.pop(request_id, None)
            raise RuntimeError(f"Request {request_id} timed out")

    async def _receive_loop(self) -> None:
        """Continuously receive messages from WebSocket."""
        try:
            async for message in self.ws:
                try:
                    data = json.loads(message)

                    # Handle JSON-RPC response
                    if "id" in data and data["id"] in self._pending_requests:
                        future = self._pending_requests.pop(data["id"])

                        if "error" in data:
                            future.set_exception(
                                RuntimeError(f"JSON-RPC error: {data['error']}")
                            )
                        else:
                            future.set_result(data.get("result", {}))
                    else:
                        # Notification or unsolicited message
                        logger.debug(f"Received notification: {data}")

                except json.JSONDecodeError:
                    logger.warning(f"Failed to decode message: {message}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self._connected_event.clear()
        except Exception as e:
            logger.error(f"Error in receive loop: {e}")
            self._connected_event.clear()

    async def call_method(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Call a Sprut.hub JSON-RPC method.

        Args:
            method: Method name (e.g., "accessory.search")
            params: Method parameters (optional)

        Returns:
            Method result

        Raises:
            RuntimeError: If not connected or method call fails
        """
        await self._connected_event.wait()

        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self._get_request_id(),
        }

        result = await self._send_request(payload)
        return result

    async def close(self) -> None:
        """Close WebSocket connection."""
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("Disconnected from Sprut.hub")

        self._connected_event.clear()

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
