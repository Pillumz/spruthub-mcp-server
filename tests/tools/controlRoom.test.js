// tests/tools/controlRoom.test.js
import { handleControlRoom } from '../../src/tools/controlRoom.js';

describe('handleControlRoom', () => {
  test('should control all matching accessories in room', async () => {
    const callLog = [];
    const mockClient = {
      callMethod: async (method, params) => {
        callLog.push({ method, params });
        if (method === 'accessory.search') {
          return {
            accessories: [
              { id: 1, name: 'Light 1', room: { id: 10 }, services: [{ type: 'Lightbulb' }] },
              { id: 2, name: 'Light 2', room: { id: 10 }, services: [{ type: 'Lightbulb' }] },
              { id: 3, name: 'Sensor', room: { id: 10 }, services: [{ type: 'MotionSensor' }] }
            ]
          };
        }
        return { success: true };
      }
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false, serviceType: 'Lightbulb' },
      mockClient,
      mockLogger
    );

    // Should call accessory.search first, then characteristic.update for each matching device
    expect(callLog).toHaveLength(3);
    expect(callLog[0].method).toBe('accessory.search');

    const response = JSON.parse(result.content[0].text);
    expect(response.affected).toHaveLength(2);
    expect(response.affected[0].name).toBe('Light 1');
    expect(response.affected[1].name).toBe('Light 2');
  });

  test('should throw error for missing roomId', async () => {
    const mockClient = {
      callMethod: async () => ({})
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    await expect(handleControlRoom(
      { characteristic: 'On', value: false },
      mockClient,
      mockLogger
    )).rejects.toThrow('roomId parameter is required');
  });

  test('should handle no matching devices gracefully', async () => {
    const mockClient = {
      callMethod: async () => ({ accessories: [] })
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false },
      mockClient,
      mockLogger
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.affected).toHaveLength(0);
  });

  test('should handle partial failures gracefully', async () => {
    const callLog = [];
    const mockClient = {
      callMethod: async (method, params) => {
        callLog.push({ method, params });
        if (method === 'accessory.search') {
          return {
            accessories: [
              { id: 1, name: 'Light 1', room: { id: 10 }, services: [{ type: 'Lightbulb' }] },
              { id: 2, name: 'Light 2', room: { id: 10 }, services: [{ type: 'Lightbulb' }] }
            ]
          };
        }
        // Fail on second update
        if (params.id === 2) {
          throw new Error('Device offline');
        }
        return { success: true };
      }
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false },
      mockClient,
      mockLogger
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.affected).toHaveLength(1);
    expect(response.affected[0].id).toBe(1);
    expect(response.failed).toHaveLength(1);
    expect(response.failed[0].id).toBe(2);
    expect(response.failed[0].error).toBe('Device offline');
  });
});
