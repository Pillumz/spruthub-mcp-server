"""WebSocket client for Sprut.hub JSON-RPC API."""

import asyncio
import json
import logging
from typing import Any

import websockets
from websockets.protocol import State

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
        self._token: str | None = None
        self._pending_requests: dict[int, asyncio.Future] = {}
        self._connected_event = asyncio.Event()
        self._receive_task: asyncio.Task | None = None

    @property
    def is_connected(self) -> bool:
        """Check if connected and authenticated."""
        return self._connected_event.is_set()

    async def connect(self) -> None:
        """Connect to Sprut.hub WebSocket server and authenticate."""
        if self.ws and self.ws.state == State.OPEN:
            logger.debug("Already connected")
            return

        logger.info(f"Connecting to {self.ws_url}...")
        self.ws = await websockets.connect(self.ws_url)

        # Start receiving messages
        self._receive_task = asyncio.create_task(self._receive_loop())

        # Authenticate using 3-step flow
        await self._authenticate()

        self._connected_event.set()
        logger.info("Connected and authenticated successfully")

    async def _authenticate(self) -> None:
        """Authenticate with Sprut.hub server using 3-step challenge-response."""
        # Step 1: Initial auth request
        auth_result = await self._send_raw_request({
            "account": {"auth": {"params": []}}
        })

        status = self._get_nested(auth_result, ["account", "auth", "status"])
        question_type = self._get_nested(auth_result, ["account", "auth", "question", "type"])

        if status != "ACCOUNT_RESPONSE_SUCCESS" or question_type != "QUESTION_TYPE_EMAIL":
            raise RuntimeError(f"Auth step 1 failed: expected email question, got {question_type}")

        logger.debug("Auth step 1: email question received")

        # Step 2: Send email
        email_result = await self._send_raw_request({
            "account": {"answer": {"data": self.email}}
        })

        question_type = self._get_nested(email_result, ["account", "answer", "question", "type"])

        if question_type != "QUESTION_TYPE_PASSWORD":
            raise RuntimeError(f"Auth step 2 failed: expected password question, got {question_type}")

        logger.debug("Auth step 2: password question received")

        # Step 3: Send password
        pwd_result = await self._send_raw_request({
            "account": {"answer": {"data": self.password}}
        })

        status = self._get_nested(pwd_result, ["account", "answer", "status"])
        token = self._get_nested(pwd_result, ["account", "answer", "token"])

        if status != "ACCOUNT_RESPONSE_SUCCESS" or not token:
            raise RuntimeError(f"Auth step 3 failed: {status}")

        self._token = token
        logger.info("Authentication successful, token received")

    def _get_nested(self, data: dict, keys: list[str]) -> Any:
        """Get nested value from dict."""
        for key in keys:
            if not isinstance(data, dict):
                return None
            data = data.get(key)
        return data

    def _get_request_id(self) -> int:
        """Get next request ID."""
        self._request_id += 1
        return self._request_id

    async def _send_raw_request(self, params: dict[str, Any]) -> dict[str, Any]:
        """Send raw request with Sprut.hub message format.

        Args:
            params: The params payload to send

        Returns:
            The result from response
        """
        if not self.ws or self.ws.state != State.OPEN:
            raise RuntimeError("Not connected to Sprut.hub server")

        request_id = self._get_request_id()
        payload = {
            "jsonrpc": "2.0",
            "params": params,
            "id": request_id,
            "token": self._token,
            "serial": self.serial,
        }

        future: asyncio.Future = asyncio.Future()
        self._pending_requests[request_id] = future

        logger.debug(f"Sending request {request_id}")
        await self.ws.send(json.dumps(payload))

        try:
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
                        # Notification or unsolicited message (like streaming events)
                        logger.debug(f"Received notification: {data}")

                except json.JSONDecodeError:
                    logger.warning(f"Failed to decode message: {message}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self._connected_event.clear()
            self._token = None
        except Exception as e:
            logger.error(f"Error in receive loop: {e}")
            self._connected_event.clear()

    async def call_method(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Call a Sprut.hub JSON-RPC method.

        The method string is converted to nested params format.
        E.g., "accessory.search" with params {"query": "light"} becomes:
        {"accessory": {"search": {"query": "light"}}}

        Args:
            method: Method name (e.g., "accessory.search", "room.list")
            params: Method parameters (optional)

        Returns:
            Method result

        Raises:
            RuntimeError: If not connected or method call fails
        """
        await self._connected_event.wait()

        # Convert method string to nested structure
        # e.g., "accessory.search" -> {"accessory": {"search": params}}
        parts = method.split(".")
        nested_params: dict[str, Any] = params or {}

        for part in reversed(parts):
            nested_params = {part: nested_params}

        result = await self._send_raw_request(nested_params)
        return result

    async def close(self) -> None:
        """Close WebSocket connection."""
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass

        if self.ws and self.ws.state == State.OPEN:
            await self.ws.close()
            logger.info("Disconnected from Sprut.hub")

        self._connected_event.clear()
        self._token = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
