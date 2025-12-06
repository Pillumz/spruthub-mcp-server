# Spruthub MCP Server

[![npm version](https://badge.fury.io/js/spruthub-mcp-server.svg)](https://badge.fury.io/js/spruthub-mcp-server)
[![npm](https://img.shields.io/npm/dm/spruthub-mcp-server.svg)](https://www.npmjs.com/package/spruthub-mcp-server)

A Model Context Protocol (MCP) server for controlling [Sprut.hub](https://spruthub.ru/) smart home devices. This server provides Claude and other MCP-compatible clients with dynamic access to the complete Sprut.hub JSON-RPC API through schema autodiscovery.

## Features

- **Dynamic API Discovery** - Automatically discovers and exposes all available Spruthub JSON-RPC methods
- **Schema Validation** - Built-in parameter validation and documentation for all API methods
- **Full API Coverage** - Access to all Spruthub functionality including devices, rooms, scenarios, and system administration
- **WebSocket Connection** - Secure connection to Spruthub server with authentication
- **Method Categories** - Organized API methods by category (hub, accessory, scenario, room, system)
- **Real-time Schema Updates** - Schema information updated with spruthub-client library versions
- **Structured Responses** - JSON-formatted responses optimized for AI integration

## Installation

### Using npx (Recommended)

Run the MCP server directly using npx:

```bash
npx spruthub-mcp-server
```

### Using Claude Desktop

Add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "spruthub": {
      "command": "npx",
      "args": ["spruthub-mcp-server"],
      "env": {
        "SPRUTHUB_WS_URL": "wss://your-spruthub-server.com/ws",
        "SPRUTHUB_EMAIL": "your-email@example.com",
        "SPRUTHUB_PASSWORD": "your-password",
        "SPRUTHUB_SERIAL": "your-device-serial"
      }
    }
  }
}
```

### Development

For development or local modifications:

```bash
git clone https://github.com/shady2k/spruthub-mcp-server.git
cd spruthub-mcp-server
npm install
```

## Usage

### As an MCP Server

Add this server to your MCP client configuration. For Claude Desktop, add to your `claude_desktop_config.json`:

#### Using npm package (recommended):
```json
{
  "mcpServers": {
    "spruthub-mcp-server": {
      "command": "npx",
      "args": [
        "spruthub-mcp-server@1.3.9"
      ],
      "env": {
        "SPRUTHUB_WS_URL": "ws://192.168.0.100/spruthub",
        "SPRUTHUB_EMAIL": "your_email@example.com",
        "SPRUTHUB_PASSWORD": "your_password",
        "SPRUTHUB_SERIAL": "AAABBBCCCDDDEEEF"
      }
    }
  }
}
```

#### For local development:
```json
{
  "mcpServers": {
    "spruthub-mcp-server": {
      "command": "node",
      "args": ["/path/to/spruthub-mcp-server/src/index.js"],
      "env": {
        "SPRUTHUB_WS_URL": "ws://192.168.0.100/spruthub",
        "SPRUTHUB_EMAIL": "your_email@example.com", 
        "SPRUTHUB_PASSWORD": "your_password",
        "SPRUTHUB_SERIAL": "AAABBBCCCDDDEEEF"
      }
    }
  }
}
```

**Note:** Replace the environment variables with your actual Spruthub server details:
- `SPRUTHUB_WS_URL`: WebSocket URL of your Spruthub server
- `SPRUTHUB_EMAIL`: Your Spruthub account email  
- `SPRUTHUB_PASSWORD`: Your Spruthub account password
- `SPRUTHUB_SERIAL`: Your Spruthub hub serial number

**Security Best Practice:** For sensitive values like `SPRUTHUB_PASSWORD`, consider using your system's environment variables instead of hardcoding them in the config file:

```json
{
  "mcpServers": {
    "spruthub-mcp-server": {
      "command": "npx",
      "args": ["spruthub-mcp-server@1.3.9"],
      "env": {
        "SPRUTHUB_WS_URL": "ws://192.168.0.100/spruthub",
        "SPRUTHUB_EMAIL": "your_email@example.com",
        "SPRUTHUB_PASSWORD": "$SPRUTHUB_PASSWORD",
        "SPRUTHUB_SERIAL": "AAABBBCCCDDDEEEF"
      }
    }
  }
}
```

Then set the password in your system environment:
```bash
export SPRUTHUB_PASSWORD="your_actual_password"
```

### Available Tools

This server provides 12 tools for smart home control:

#### Dedicated Tools (Recommended)

These tools provide controlled response sizes and a simple discovery-first workflow:

| Tool | Description |
|------|-------------|
| `spruthub_list_accessories` | List all devices (shallow data: id, name, room, status) |
| `spruthub_get_accessory` | Get full details for one device by ID |
| `spruthub_list_rooms` | List all rooms |
| `spruthub_list_scenarios` | List all automation scenarios (shallow data) |
| `spruthub_get_scenario` | Get full scenario details by ID |
| `spruthub_get_logs` | Get recent system logs (default 20, max 100) |
| `spruthub_control_accessory` | Control a single device by ID |
| `spruthub_control_room` | Control all devices in a room |
| `spruthub_run_scenario` | Execute an automation scenario |

#### Generic API Tools (Advanced)

For direct API access when you need methods not covered by dedicated tools:

| Tool | Description |
|------|-------------|
| `spruthub_list_methods` | Discover all available API methods |
| `spruthub_get_method_schema` | Get detailed schema for any method |
| `spruthub_call_method` | Execute any JSON-RPC method directly |

### Common Workflows

**1. Turn on a light:**
```
spruthub_list_accessories → find device ID
spruthub_control_accessory(id: 5, characteristic: "On", value: true)
```

**2. Turn off all lights in a room:**
```
spruthub_list_rooms → find room ID
spruthub_control_room(roomId: 1, characteristic: "On", value: false, serviceType: "Lightbulb")
```

**3. Run a scenario:**
```
spruthub_list_scenarios → find scenario ID
spruthub_run_scenario(id: 10)
```

**4. Get device details:**
```
spruthub_list_accessories → find device ID
spruthub_get_accessory(id: 5) → see all services and characteristics
```

**5. Advanced API access:**
```
spruthub_list_methods → spruthub_get_method_schema → spruthub_call_method
```

## Efficient API Usage

The schema-based approach provides efficient access to Spruthub functionality:

### Recommended Workflow
1. **Discovery Phase**: Use `spruthub_list_methods` to explore available functionality
2. **Schema Phase**: Use `spruthub_get_method_schema` to understand method requirements  
3. **Execution Phase**: Use `spruthub_call_method` with proper parameters

### Best Practices
- **Filter by category** when exploring: Use `category` parameter in `spruthub_list_methods`
- **Always get schema first**: Never guess API parameters - use `spruthub_get_method_schema`
- **Use specific methods**: The API provides targeted methods for efficient operations
- **Check method categories**: 
  - `hub` - Hub management and status
  - `accessory` - Device discovery and control  
  - `scenario` - Automation and scenes
  - `room` - Room management
  - `system` - System administration

### Schema-Driven Development
Each API method includes:
- Complete parameter specifications
- Return type definitions  
- Usage examples
- REST API mapping (where available)
- Category classification

## Development

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## Environment Variables

### Connection Settings
- `LOG_LEVEL`: Set logging level (default: 'info')
- `SPRUTHUB_WS_URL`: WebSocket URL for Spruthub server (required if auto-connecting)
- `SPRUTHUB_EMAIL`: Email for authentication (required if auto-connecting)
- `SPRUTHUB_PASSWORD`: Password for authentication (required if auto-connecting)
- `SPRUTHUB_SERIAL`: Device serial number (required if auto-connecting)

### Logging Settings  
- `LOG_LEVEL`: Set logging level (`info`, `debug`, `warn`, `error`) (default: 'info')

## License

MIT