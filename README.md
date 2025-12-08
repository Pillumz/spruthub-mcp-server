# Sprut.hub MCP Server

Python MCP server for controlling Sprut.hub smart home devices with dynamic JSON-RPC API discovery.

## Features

- Full WebSocket-based communication with Sprut.hub
- 12 MCP tools for smart home control
- Discovery tools for exploring the API
- Device control (accessories, rooms)
- Scenario automation
- System logging

## Installation

```fish
cd /opt/mcp/spruthub-mcp
make install
```

## Configuration

Edit `.env` file:

```env
SPRUTHUB_WS_URL=wss://web.spruthub.ru/spruthub
SPRUTHUB_EMAIL=your-email@example.com
SPRUTHUB_PASSWORD=your-password
SPRUTHUB_SERIAL=your-serial-number
LOG_LEVEL=info
HOST=127.0.0.1
PORT=9084
```

## Usage

### Stdio mode (for Claude Desktop):

```fish
make run
```

### HTTP mode (for server deployment):

```fish
make run-http
```

### As systemd service:

```fish
sudo cp spruthub-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable spruthub-mcp
sudo systemctl start spruthub-mcp
sudo systemctl status spruthub-mcp
```

## Available Tools

1. **spruthub_list_methods** - List available JSON-RPC methods
2. **spruthub_get_method_schema** - Get method schema
3. **spruthub_call_method** - Call any JSON-RPC method
4. **spruthub_list_accessories** - List all devices
5. **spruthub_get_accessory** - Get device details
6. **spruthub_list_rooms** - List all rooms
7. **spruthub_list_scenarios** - List automation scenarios
8. **spruthub_get_scenario** - Get scenario details
9. **spruthub_get_logs** - Get system logs
10. **spruthub_control_accessory** - Control a device
11. **spruthub_control_room** - Control all devices in a room
12. **spruthub_run_scenario** - Run an automation scenario

## Development

```fish
make dev        # Install with dev dependencies
make test       # Run tests
make lint       # Run linter
make format     # Format code
```

## Architecture

- **client.py** - WebSocket client for Sprut.hub API
- **config.py** - Settings management
- **schema.py** - API schema definitions
- **server.py** - MCP server implementation
- **tools/** - Tool implementations
  - discovery.py - API exploration tools
  - accessories.py - Device control
  - rooms.py - Room control
  - scenarios.py - Automation
  - system.py - System logs

## License

MIT
