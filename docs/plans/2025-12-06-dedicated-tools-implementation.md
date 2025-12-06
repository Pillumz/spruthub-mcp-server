# Dedicated MCP Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 dedicated MCP tools with controlled response sizes to prevent context overflow.

**Architecture:** Tool handlers in `src/tools/` directory, registered in main `index.js`. Each tool wraps underlying API calls with response shaping.

**Tech Stack:** Node.js ES modules, spruthub-client library, Jest for testing.

---

## Task 1: Create tools directory structure

**Files:**
- Create: `src/tools/index.js`

**Step 1: Create the tools barrel file**

```javascript
// src/tools/index.js
export { handleListAccessories } from './listAccessories.js';
export { handleGetAccessory } from './getAccessory.js';
export { handleListRooms } from './listRooms.js';
export { handleListScenarios } from './listScenarios.js';
export { handleGetScenario } from './getScenario.js';
export { handleGetLogs } from './getLogs.js';
export { handleControlAccessory } from './controlAccessory.js';
export { handleControlRoom } from './controlRoom.js';
export { handleRunScenario } from './runScenario.js';
```

**Step 2: Commit**

```bash
git add src/tools/index.js
git commit -m "feat: add tools directory structure"
```

---

## Task 2: Implement listAccessories tool

**Files:**
- Create: `src/tools/listAccessories.js`
- Create: `tests/tools/listAccessories.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/listAccessories.test.js
import { handleListAccessories } from '../../src/tools/listAccessories.js';

describe('handleListAccessories', () => {
  test('should return shallow accessory data', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({
        accessories: [
          {
            id: 1,
            name: 'Test Light',
            room: { id: 10, name: 'Bedroom' },
            online: true,
            manufacturer: 'Philips',
            services: [{ type: 'Lightbulb', characteristics: [] }]
          }
        ],
        total: 1,
        page: 1,
        limit: 100
      })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleListAccessories({}, mockClient, mockLogger);

    expect(result.content[0].type).toBe('text');
    expect(mockClient.callMethod).toHaveBeenCalledWith('accessory.search', {
      page: 1,
      limit: 100,
      expand: 'none'
    });

    const accessories = JSON.parse(result.content[1].text);
    expect(accessories[0]).toHaveProperty('id');
    expect(accessories[0]).toHaveProperty('name');
    expect(accessories[0]).toHaveProperty('room');
    expect(accessories[0]).toHaveProperty('roomId');
    expect(accessories[0]).toHaveProperty('online');
    expect(accessories[0]).not.toHaveProperty('services');
    expect(accessories[0]).not.toHaveProperty('characteristics');
  });

  test('should extract serviceTypes from services', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({
        accessories: [
          {
            id: 1,
            name: 'Multi Service',
            room: { id: 10, name: 'Room' },
            online: true,
            services: [
              { type: 'Lightbulb' },
              { type: 'Switch' }
            ]
          }
        ],
        total: 1
      })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleListAccessories({}, mockClient, mockLogger);
    const accessories = JSON.parse(result.content[1].text);

    expect(accessories[0].serviceTypes).toEqual(['Lightbulb', 'Switch']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/listAccessories.test.js`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```javascript
// src/tools/listAccessories.js
export async function handleListAccessories(args, sprutClient, logger) {
  logger.debug('Listing accessories with shallow data');

  const result = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 100,
    expand: 'none'
  });

  const accessories = (result.accessories || []).map(acc => ({
    id: acc.id,
    name: acc.name,
    room: acc.room?.name || null,
    roomId: acc.room?.id || null,
    online: acc.online ?? true,
    manufacturer: acc.manufacturer || null,
    serviceTypes: (acc.services || []).map(s => s.type).filter(Boolean)
  }));

  const content = [
    {
      type: 'text',
      text: `Found ${accessories.length} accessories:`
    },
    {
      type: 'text',
      text: JSON.stringify(accessories, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/listAccessories.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/listAccessories.js tests/tools/listAccessories.test.js
git commit -m "feat: add listAccessories tool with shallow response"
```

---

## Task 3: Implement getAccessory tool

**Files:**
- Create: `src/tools/getAccessory.js`
- Create: `tests/tools/getAccessory.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/getAccessory.test.js
import { handleGetAccessory } from '../../src/tools/getAccessory.js';

describe('handleGetAccessory', () => {
  test('should return full accessory data for valid ID', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({
        accessories: [
          {
            id: 5,
            name: 'Ceiling Light',
            room: { id: 1, name: 'Bedroom' },
            services: [{ type: 'Lightbulb', characteristics: [{ type: 'On', value: true }] }]
          }
        ]
      })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleGetAccessory({ id: 5 }, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('accessory.search', {
      page: 1,
      limit: 1,
      expand: 'characteristics'
    });
    expect(result.content[0].text).toContain('Ceiling Light');
  });

  test('should throw error for missing ID', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleGetAccessory({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });

  test('should throw error when accessory not found', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({ accessories: [] })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleGetAccessory({ id: 999 }, mockClient, mockLogger))
      .rejects.toThrow('Accessory with ID 999 not found');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/getAccessory.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/getAccessory.js
export async function handleGetAccessory(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_accessories to find accessory IDs.');
  }

  logger.debug(`Getting accessory details for ID: ${id}`);

  const result = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 1,
    expand: 'characteristics'
  });

  // Filter by ID since accessory.search may not support direct ID filter
  const accessory = (result.accessories || []).find(a => a.id === id);

  if (!accessory) {
    throw new Error(`Accessory with ID ${id} not found`);
  }

  const content = [
    {
      type: 'text',
      text: `Accessory "${accessory.name}" (ID: ${accessory.id}):`
    },
    {
      type: 'text',
      text: JSON.stringify(accessory, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/getAccessory.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/getAccessory.js tests/tools/getAccessory.test.js
git commit -m "feat: add getAccessory tool for full device details"
```

---

## Task 4: Implement listRooms tool

**Files:**
- Create: `src/tools/listRooms.js`
- Create: `tests/tools/listRooms.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/listRooms.test.js
import { handleListRooms } from '../../src/tools/listRooms.js';

describe('handleListRooms', () => {
  test('should return all rooms', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue([
        { id: 1, name: 'Bedroom', icon: 'bed' },
        { id: 2, name: 'Kitchen', icon: 'kitchen' }
      ])
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleListRooms({}, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('room.list', {
      room: { list: {} }
    });
    expect(result.content[0].text).toContain('2 rooms');
  });

  test('should handle empty rooms list', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue([])
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleListRooms({}, mockClient, mockLogger);
    const rooms = JSON.parse(result.content[1].text);

    expect(rooms).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/listRooms.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/listRooms.js
export async function handleListRooms(args, sprutClient, logger) {
  logger.debug('Listing all rooms');

  const result = await sprutClient.callMethod('room.list', {
    room: { list: {} }
  });

  const rooms = Array.isArray(result) ? result : [];

  const content = [
    {
      type: 'text',
      text: `Found ${rooms.length} rooms:`
    },
    {
      type: 'text',
      text: JSON.stringify(rooms, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/listRooms.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/listRooms.js tests/tools/listRooms.test.js
git commit -m "feat: add listRooms tool"
```

---

## Task 5: Implement listScenarios tool

**Files:**
- Create: `src/tools/listScenarios.js`
- Create: `tests/tools/listScenarios.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/listScenarios.test.js
import { handleListScenarios } from '../../src/tools/listScenarios.js';

describe('handleListScenarios', () => {
  test('should return shallow scenario data', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Good Night',
          enabled: true,
          description: 'Turn off all lights',
          triggers: [{ type: 'time' }],
          actions: [{ type: 'accessory' }]
        }
      ])
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleListScenarios({}, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('scenario.list', {
      scenario: { list: {} }
    });

    const scenarios = JSON.parse(result.content[1].text);
    expect(scenarios[0]).toHaveProperty('id');
    expect(scenarios[0]).toHaveProperty('name');
    expect(scenarios[0]).toHaveProperty('enabled');
    expect(scenarios[0]).not.toHaveProperty('triggers');
    expect(scenarios[0]).not.toHaveProperty('actions');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/listScenarios.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/listScenarios.js
export async function handleListScenarios(args, sprutClient, logger) {
  logger.debug('Listing all scenarios with shallow data');

  const result = await sprutClient.callMethod('scenario.list', {
    scenario: { list: {} }
  });

  const scenarios = (Array.isArray(result) ? result : []).map(s => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled ?? true,
    description: s.description || null
  }));

  const content = [
    {
      type: 'text',
      text: `Found ${scenarios.length} scenarios:`
    },
    {
      type: 'text',
      text: JSON.stringify(scenarios, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/listScenarios.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/listScenarios.js tests/tools/listScenarios.test.js
git commit -m "feat: add listScenarios tool with shallow response"
```

---

## Task 6: Implement getScenario tool

**Files:**
- Create: `src/tools/getScenario.js`
- Create: `tests/tools/getScenario.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/getScenario.test.js
import { handleGetScenario } from '../../src/tools/getScenario.js';

describe('handleGetScenario', () => {
  test('should return full scenario data for valid ID', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({
        id: 10,
        name: 'Good Night',
        enabled: true,
        triggers: [{ type: 'time', time: '22:00' }],
        actions: [{ type: 'accessory', id: 5 }]
      })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleGetScenario({ id: 10 }, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('scenario.get', {
      scenario: { get: { id: 10 } }
    });
    expect(result.content[0].text).toContain('Good Night');
  });

  test('should throw error for missing ID', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleGetScenario({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/getScenario.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/getScenario.js
export async function handleGetScenario(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_scenarios to find scenario IDs.');
  }

  logger.debug(`Getting scenario details for ID: ${id}`);

  const result = await sprutClient.callMethod('scenario.get', {
    scenario: { get: { id } }
  });

  if (!result || !result.id) {
    throw new Error(`Scenario with ID ${id} not found`);
  }

  const content = [
    {
      type: 'text',
      text: `Scenario "${result.name}" (ID: ${result.id}):`
    },
    {
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/getScenario.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/getScenario.js tests/tools/getScenario.test.js
git commit -m "feat: add getScenario tool for full scenario details"
```

---

## Task 7: Implement getLogs tool

**Files:**
- Create: `src/tools/getLogs.js`
- Create: `tests/tools/getLogs.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/getLogs.test.js
import { handleGetLogs } from '../../src/tools/getLogs.js';

describe('handleGetLogs', () => {
  test('should return logs with default count of 20', async () => {
    const mockLogs = Array(20).fill(null).map((_, i) => ({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Log entry ${i}`
    }));
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue(mockLogs)
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleGetLogs({}, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('log.list', {
      log: { list: { count: 20 } }
    });
    expect(result.content[0].text).toContain('20');
  });

  test('should accept custom count parameter', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue([])
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await handleGetLogs({ count: 50 }, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('log.list', {
      log: { list: { count: 50 } }
    });
  });

  test('should cap count at 100', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue([])
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await handleGetLogs({ count: 500 }, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('log.list', {
      log: { list: { count: 100 } }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/getLogs.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/getLogs.js
const DEFAULT_COUNT = 20;
const MAX_COUNT = 100;

export async function handleGetLogs(args, sprutClient, logger) {
  const requestedCount = args.count || DEFAULT_COUNT;
  const count = Math.min(Math.max(1, requestedCount), MAX_COUNT);

  logger.debug(`Getting ${count} log entries`);

  const result = await sprutClient.callMethod('log.list', {
    log: { list: { count } }
  });

  const logs = Array.isArray(result) ? result : [];

  const content = [
    {
      type: 'text',
      text: `Retrieved ${logs.length} log entries:`
    },
    {
      type: 'text',
      text: JSON.stringify(logs, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/getLogs.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/getLogs.js tests/tools/getLogs.test.js
git commit -m "feat: add getLogs tool with bounded count"
```

---

## Task 8: Implement controlAccessory tool

**Files:**
- Create: `src/tools/controlAccessory.js`
- Create: `tests/tools/controlAccessory.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/controlAccessory.test.js
import { handleControlAccessory } from '../../src/tools/controlAccessory.js';

describe('handleControlAccessory', () => {
  test('should update characteristic successfully', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({ success: true })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleControlAccessory(
      { id: 5, characteristic: 'On', value: true },
      mockClient,
      mockLogger
    );

    expect(mockClient.callMethod).toHaveBeenCalledWith('characteristic.update', {
      id: 5,
      characteristic: 'On',
      value: true
    });
    expect(result.content[0].text).toContain('success');
  });

  test('should throw error for missing id', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleControlAccessory(
      { characteristic: 'On', value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('id parameter is required');
  });

  test('should throw error for missing characteristic', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleControlAccessory(
      { id: 5, value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('characteristic parameter is required');
  });

  test('should throw error for missing value', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleControlAccessory(
      { id: 5, characteristic: 'On' },
      mockClient,
      mockLogger
    )).rejects.toThrow('value parameter is required');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/controlAccessory.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/controlAccessory.js
export async function handleControlAccessory(args, sprutClient, logger) {
  const { id, characteristic, value } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_accessories to find accessory IDs.');
  }
  if (!characteristic) {
    throw new Error('characteristic parameter is required (e.g., "On", "Brightness", "TargetTemperature").');
  }
  if (value === undefined) {
    throw new Error('value parameter is required.');
  }

  logger.debug(`Controlling accessory ${id}: ${characteristic} = ${value}`);

  await sprutClient.callMethod('characteristic.update', {
    id,
    characteristic,
    value
  });

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        accessoryId: id,
        characteristic,
        value
      }, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/controlAccessory.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/controlAccessory.js tests/tools/controlAccessory.test.js
git commit -m "feat: add controlAccessory tool for device control"
```

---

## Task 9: Implement controlRoom tool

**Files:**
- Create: `src/tools/controlRoom.js`
- Create: `tests/tools/controlRoom.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/controlRoom.test.js
import { handleControlRoom } from '../../src/tools/controlRoom.js';

describe('handleControlRoom', () => {
  test('should control all matching accessories in room', async () => {
    const mockClient = {
      callMethod: jest.fn()
        .mockResolvedValueOnce({
          accessories: [
            { id: 1, name: 'Light 1', room: { id: 10 }, services: [{ type: 'Lightbulb' }] },
            { id: 2, name: 'Light 2', room: { id: 10 }, services: [{ type: 'Lightbulb' }] },
            { id: 3, name: 'Sensor', room: { id: 10 }, services: [{ type: 'MotionSensor' }] }
          ]
        })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false, serviceType: 'Lightbulb' },
      mockClient,
      mockLogger
    );

    // Should call accessory.search first, then characteristic.update for each matching device
    expect(mockClient.callMethod).toHaveBeenCalledTimes(3);
    expect(mockClient.callMethod).toHaveBeenNthCalledWith(1, 'accessory.search', expect.any(Object));

    const response = JSON.parse(result.content[0].text);
    expect(response.affected).toHaveLength(2);
    expect(response.affected[0].name).toBe('Light 1');
  });

  test('should throw error for missing roomId', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleControlRoom(
      { characteristic: 'On', value: false },
      mockClient,
      mockLogger
    )).rejects.toThrow('roomId parameter is required');
  });

  test('should handle no matching devices gracefully', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({ accessories: [] })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false },
      mockClient,
      mockLogger
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.affected).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/controlRoom.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/controlRoom.js
export async function handleControlRoom(args, sprutClient, logger) {
  const { roomId, characteristic, value, serviceType } = args;

  if (!roomId) {
    throw new Error('roomId parameter is required. Use spruthub_list_rooms to find room IDs.');
  }
  if (!characteristic) {
    throw new Error('characteristic parameter is required (e.g., "On", "Brightness").');
  }
  if (value === undefined) {
    throw new Error('value parameter is required.');
  }

  logger.debug(`Controlling room ${roomId}: ${characteristic} = ${value}, filter: ${serviceType || 'all'}`);

  // Get accessories in this room
  const searchResult = await sprutClient.callMethod('accessory.search', {
    roomId,
    page: 1,
    limit: 100,
    expand: 'services'
  });

  let accessories = searchResult.accessories || [];

  // Filter by service type if specified
  if (serviceType) {
    accessories = accessories.filter(acc =>
      (acc.services || []).some(s => s.type === serviceType)
    );
  }

  const affected = [];
  const failed = [];

  // Update each accessory
  for (const acc of accessories) {
    try {
      await sprutClient.callMethod('characteristic.update', {
        id: acc.id,
        characteristic,
        value
      });
      affected.push({
        id: acc.id,
        name: acc.name,
        characteristic,
        value
      });
    } catch (error) {
      failed.push({
        id: acc.id,
        name: acc.name,
        error: error.message
      });
    }
  }

  const response = {
    success: true,
    roomId,
    characteristic,
    value,
    serviceType: serviceType || null,
    affected,
    failed: failed.length > 0 ? failed : undefined
  };

  const content = [
    {
      type: 'text',
      text: JSON.stringify(response, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/controlRoom.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/controlRoom.js tests/tools/controlRoom.test.js
git commit -m "feat: add controlRoom tool for room-wide control"
```

---

## Task 10: Implement runScenario tool

**Files:**
- Create: `src/tools/runScenario.js`
- Create: `tests/tools/runScenario.test.js`

**Step 1: Write the failing test**

```javascript
// tests/tools/runScenario.test.js
import { handleRunScenario } from '../../src/tools/runScenario.js';

describe('handleRunScenario', () => {
  test('should run scenario successfully', async () => {
    const mockClient = {
      callMethod: jest.fn().mockResolvedValue({ success: true })
    };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    const result = await handleRunScenario({ id: 10 }, mockClient, mockLogger);

    expect(mockClient.callMethod).toHaveBeenCalledWith('scenario.run', {
      scenario: { run: { id: 10 } }
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.scenarioId).toBe(10);
  });

  test('should throw error for missing id', async () => {
    const mockClient = { callMethod: jest.fn() };
    const mockLogger = { debug: jest.fn(), error: jest.fn() };

    await expect(handleRunScenario({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/tools/runScenario.test.js`
Expected: FAIL

**Step 3: Write minimal implementation**

```javascript
// src/tools/runScenario.js
export async function handleRunScenario(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_scenarios to find scenario IDs.');
  }

  logger.debug(`Running scenario ${id}`);

  await sprutClient.callMethod('scenario.run', {
    scenario: { run: { id } }
  });

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        scenarioId: id
      }, null, 2)
    }
  ];

  return { content };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/tools/runScenario.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/runScenario.js tests/tools/runScenario.test.js
git commit -m "feat: add runScenario tool"
```

---

## Task 11: Register all new tools in index.js

**Files:**
- Modify: `src/index.js`

**Step 1: Add imports at top of file (after line 17)**

```javascript
import {
  handleListAccessories,
  handleGetAccessory,
  handleListRooms,
  handleListScenarios,
  handleGetScenario,
  handleGetLogs,
  handleControlAccessory,
  handleControlRoom,
  handleRunScenario
} from './tools/index.js';
```

**Step 2: Add tool definitions to ListToolsRequestSchema handler (after line 101, before the closing bracket)**

Add these tools to the `tools` array:

```javascript
          {
            name: 'spruthub_list_accessories',
            description: 'List all smart home accessories with shallow data (id, name, room, online status). Use this first to discover accessory IDs before controlling devices.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_get_accessory',
            description: 'Get full details for a single accessory including all services and characteristics. Requires accessory ID from spruthub_list_accessories.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Accessory ID (use spruthub_list_accessories to find IDs)',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'spruthub_list_rooms',
            description: 'List all rooms in the smart home. Use this to discover room IDs before room-wide control.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_list_scenarios',
            description: 'List all automation scenarios with shallow data (id, name, enabled). Use this to discover scenario IDs before running them.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_get_scenario',
            description: 'Get full details for a single scenario including triggers, conditions, and actions. Requires scenario ID from spruthub_list_scenarios.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Scenario ID (use spruthub_list_scenarios to find IDs)',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'spruthub_get_logs',
            description: 'Get recent system logs. Default 20 entries, max 100.',
            inputSchema: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                  description: 'Number of log entries to retrieve (default: 20, max: 100)',
                },
              },
            },
          },
          {
            name: 'spruthub_control_accessory',
            description: 'Control a single smart home device by setting a characteristic value. Requires accessory ID from spruthub_list_accessories.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Accessory ID (use spruthub_list_accessories to find IDs)',
                },
                characteristic: {
                  type: 'string',
                  description: 'Characteristic type to set (e.g., "On", "Brightness", "TargetTemperature")',
                },
                value: {
                  description: 'New value for the characteristic (type depends on characteristic)',
                },
              },
              required: ['id', 'characteristic', 'value'],
            },
          },
          {
            name: 'spruthub_control_room',
            description: 'Control all devices in a room at once. Optionally filter by device type. Requires room ID from spruthub_list_rooms.',
            inputSchema: {
              type: 'object',
              properties: {
                roomId: {
                  type: 'number',
                  description: 'Room ID (use spruthub_list_rooms to find IDs)',
                },
                characteristic: {
                  type: 'string',
                  description: 'Characteristic type to set on all devices (e.g., "On", "Brightness")',
                },
                value: {
                  description: 'New value for the characteristic',
                },
                serviceType: {
                  type: 'string',
                  description: 'Optional: filter by device type (e.g., "Lightbulb", "Switch", "Thermostat")',
                },
              },
              required: ['roomId', 'characteristic', 'value'],
            },
          },
          {
            name: 'spruthub_run_scenario',
            description: 'Execute an automation scenario. Requires scenario ID from spruthub_list_scenarios.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Scenario ID (use spruthub_list_scenarios to find IDs)',
                },
              },
              required: ['id'],
            },
          },
```

**Step 3: Add cases to CallToolRequestSchema switch statement (after line 118)**

```javascript
          case 'spruthub_list_accessories':
            await this.ensureConnected();
            return await handleListAccessories(args, this.sprutClient, this.logger);
          case 'spruthub_get_accessory':
            await this.ensureConnected();
            return await handleGetAccessory(args, this.sprutClient, this.logger);
          case 'spruthub_list_rooms':
            await this.ensureConnected();
            return await handleListRooms(args, this.sprutClient, this.logger);
          case 'spruthub_list_scenarios':
            await this.ensureConnected();
            return await handleListScenarios(args, this.sprutClient, this.logger);
          case 'spruthub_get_scenario':
            await this.ensureConnected();
            return await handleGetScenario(args, this.sprutClient, this.logger);
          case 'spruthub_get_logs':
            await this.ensureConnected();
            return await handleGetLogs(args, this.sprutClient, this.logger);
          case 'spruthub_control_accessory':
            await this.ensureConnected();
            return await handleControlAccessory(args, this.sprutClient, this.logger);
          case 'spruthub_control_room':
            await this.ensureConnected();
            return await handleControlRoom(args, this.sprutClient, this.logger);
          case 'spruthub_run_scenario':
            await this.ensureConnected();
            return await handleRunScenario(args, this.sprutClient, this.logger);
```

**Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/index.js
git commit -m "feat: register all 9 new tools in MCP server"
```

---

## Task 12: Update existing tests and verify

**Files:**
- Modify: `tests/SpruthubMCPServer.test.js`

**Step 1: Update tool count expectation**

Change line 53 from:
```javascript
    expect(expectedTools).toHaveLength(3);
```

To:
```javascript
    expect(expectedTools).toHaveLength(12);
```

And update the expectedTools array to include all 12 tools.

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/SpruthubMCPServer.test.js
git commit -m "test: update tests for 12 tools"
```

---

## Task 13: Final verification and push

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 2: Run all tests with coverage**

Run: `npm run test:coverage`
Expected: All tests pass, good coverage

**Step 3: Push to fork**

```bash
git push origin feature/dedicated-tools
```

**Step 4: Verify on GitHub**

Visit: https://github.com/Pillumz/spruthub-mcp-server/tree/feature/dedicated-tools
