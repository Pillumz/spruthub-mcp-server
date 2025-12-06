# Dedicated MCP Tools Design

## Problem

The generic `spruthub_call_method` tool can return massive responses (e.g., all accessories with full characteristics) that fill the agent's context in a single call.

## Solution

Add 9 dedicated tools with controlled response sizes, using a two-phase pattern:

1. **Discover** - List tools return shallow data (all items, minimal fields)
2. **Act** - Get/control tools operate on specific items by ID

All control tools require IDs, forcing discovery first. This ensures agents always know what they're controlling.

## Tools Overview

| Tool | Type | Purpose |
|------|------|---------|
| `spruthub_list_accessories` | Read | Shallow list of all devices |
| `spruthub_get_accessory` | Read | Full details for one device |
| `spruthub_list_rooms` | Read | List all rooms |
| `spruthub_list_scenarios` | Read | Shallow list of scenarios |
| `spruthub_get_scenario` | Read | Full details for one scenario |
| `spruthub_get_logs` | Read | Recent logs (default 20) |
| `spruthub_control_accessory` | Write | Control single device by ID |
| `spruthub_control_room` | Write | Control all matching devices in room |
| `spruthub_run_scenario` | Write | Execute scenario by ID |

Existing tools (`spruthub_list_methods`, `spruthub_get_method_schema`, `spruthub_call_method`) remain unchanged for advanced users.

## Read Tools

### Discovery Tools (Shallow Data)

#### `spruthub_list_accessories`

Returns shallow data for all accessories (~100-200 bytes per device).

```javascript
// Input
{ }  // No parameters

// Output
[
  {
    id: 5,
    name: "Ceiling Light",
    room: "Bedroom",
    roomId: 1,
    online: true,
    manufacturer: "Philips",
    serviceTypes: ["Lightbulb"]
  },
  ...
]
```

#### `spruthub_list_rooms`

Returns all rooms (usually small dataset).

```javascript
// Input
{ }

// Output
[ { id: 1, name: "Bedroom", icon: "bed" }, ... ]
```

#### `spruthub_list_scenarios`

Returns shallow scenario data.

```javascript
// Input
{ }

// Output
[ { id: 10, name: "Good Night", enabled: true }, ... ]
```

### Detail Tools (Full Data, Single Item)

#### `spruthub_get_accessory`

Returns full details including services and characteristics for one device.

```javascript
// Input
{ id: 5 }

// Output
{
  id: 5,
  name: "Ceiling Light",
  ...,
  services: [...],
  characteristics: [...]
}
```

#### `spruthub_get_scenario`

Returns full scenario details including triggers, conditions, and actions.

```javascript
// Input
{ id: 10 }

// Output
{ id: 10, name: "Good Night", triggers: [...], conditions: [...], actions: [...] }
```

#### `spruthub_get_logs`

Returns recent log entries with configurable count.

```javascript
// Input
{ count: 20 }  // Optional, default 20

// Output
[ { timestamp: "...", level: "info", message: "..." }, ... ]
```

## Write Tools

#### `spruthub_control_accessory`

Control a single device by ID.

```javascript
// Input
{
  id: 5,                      // Required - accessory ID from list
  characteristic: "On",       // Characteristic type name
  value: true                 // New value
}

// Output
{ success: true, accessory: "Ceiling Light", characteristic: "On", value: true }
```

#### `spruthub_control_room`

Control all matching devices in a room.

```javascript
// Input
{
  roomId: 1,                  // Required - room ID from list
  characteristic: "On",       // Characteristic to set
  value: false,               // New value
  serviceType: "Lightbulb"    // Optional filter - only affect specific device types
}

// Output
{
  success: true,
  room: "Bedroom",
  affected: [
    { id: 5, name: "Ceiling Light", characteristic: "On", value: false },
    { id: 7, name: "Bedside Lamp", characteristic: "On", value: false }
  ],
  skipped: 1
}
```

#### `spruthub_run_scenario`

Execute a scenario by ID.

```javascript
// Input
{ id: 10 }

// Output
{ success: true, scenario: "Good Night" }
```

## Implementation

### File Structure

```
src/
  index.js              # Main server - add new tool definitions
  tools/                # New folder for tool handlers
    listAccessories.js
    getAccessory.js
    listRooms.js
    listScenarios.js
    getScenario.js
    getLogs.js
    controlAccessory.js
    controlRoom.js
    runScenario.js
```

### Underlying API Calls

| Tool | Underlying API Call | Post-processing |
|------|---------------------|-----------------|
| `list_accessories` | `accessory.search` with `expand: "none"` | Extract shallow fields only |
| `get_accessory` | `accessory.search` with `id` filter | Return single item with full expansion |
| `list_rooms` | `room.list` | Pass through (already small) |
| `list_scenarios` | `scenario.list` | Extract shallow fields only |
| `get_scenario` | `scenario.get` | Pass through |
| `get_logs` | `log.list` with `count: 20` default | Pass through |
| `control_accessory` | `characteristic.update` | Format confirmation |
| `control_room` | Loop: find accessories, `characteristic.update` each | Aggregate results |
| `run_scenario` | `scenario.run` | Format confirmation |

## Error Handling

### Discovery Errors

```javascript
// No accessories found
{ accessories: [], message: "No accessories found in the system" }

// Connection error
{ error: "Not connected to Sprut.hub. Check connection settings." }
```

### Control Errors

```javascript
// Invalid ID
{ success: false, error: "Accessory with ID 999 not found" }

// Characteristic not found on device
{ success: false, error: "Accessory 'Motion Sensor' does not have characteristic 'On'" }

// Value type mismatch
{ success: false, error: "Characteristic 'Brightness' expects number (0-100), got 'bright'" }
```

### Room Control Edge Cases

```javascript
// No devices match filter
{
  success: true,
  room: "Bathroom",
  affected: [],
  message: "No devices with serviceType 'Lightbulb' found in room"
}

// Partial success (some devices offline)
{
  success: true,
  affected: [...],
  failed: [{ id: 7, name: "Bedside Lamp", error: "Device offline" }]
}
```

## Tool Descriptions

Each tool description explicitly guides discovery-first usage:

- "Requires accessory ID. Use spruthub_list_accessories first to discover IDs."
- "Requires room ID. Use spruthub_list_rooms first to discover IDs."
- "Requires scenario ID. Use spruthub_list_scenarios first to discover IDs."
