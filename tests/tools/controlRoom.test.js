// tests/tools/controlRoom.test.js
import { handleControlRoom } from '../../src/tools/controlRoom.js';

describe('handleControlRoom', () => {
  test('should control all matching accessories in room', async () => {
    const updateCalls = [];
    const mockClient = {
      callMethod: async (method, args) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 10,
                  name: 'Light 1',
                  roomId: 1,
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 10, sId: 13, cId: 15, control: { type: 'On', write: true } }
                      ]
                    }
                  ]
                },
                {
                  id: 11,
                  name: 'Light 2',
                  roomId: 1,
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 11, sId: 13, cId: 15, control: { type: 'On', write: true } }
                      ]
                    }
                  ]
                },
                {
                  id: 12,
                  name: 'Other Room Light',
                  roomId: 2,
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 12, sId: 13, cId: 15, control: { type: 'On', write: true } }
                      ]
                    }
                  ]
                }
              ]
            }
          };
        }
        if (method === 'characteristic.update') {
          updateCalls.push(args);
          return { success: true };
        }
      }
    };
    const mockLogger = { debug: () => {} };

    const result = await handleControlRoom(
      { roomId: 1, characteristic: 'On', value: false },
      mockClient,
      mockLogger
    );

    // Should only update 2 accessories in room 1
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0].characteristic.update.aId).toBe(10);
    expect(updateCalls[1].characteristic.update.aId).toBe(11);
    expect(updateCalls[0].characteristic.update.control.value).toEqual({ boolValue: false });

    const response = JSON.parse(result.content[0].text);
    expect(response.affected).toHaveLength(2);
  });

  test('should throw error for missing roomId', async () => {
    const mockClient = { callMethod: async () => ({}) };
    const mockLogger = { debug: () => {} };

    await expect(handleControlRoom(
      { characteristic: 'On', value: false },
      mockClient,
      mockLogger
    )).rejects.toThrow('roomId parameter is required');
  });

  test('should handle no matching devices gracefully', async () => {
    const mockClient = {
      callMethod: async () => ({ data: { accessories: [] } })
    };
    const mockLogger = { debug: () => {} };

    const result = await handleControlRoom(
      { roomId: 10, characteristic: 'On', value: false },
      mockClient,
      mockLogger
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.affected).toHaveLength(0);
  });

  test('should skip accessories without matching characteristic', async () => {
    const mockClient = {
      callMethod: async (method) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 10,
                  name: 'Sensor',
                  roomId: 1,
                  services: [
                    {
                      type: 'TemperatureSensor',
                      characteristics: [
                        { aId: 10, sId: 13, cId: 15, control: { type: 'CurrentTemperature', write: false } }
                      ]
                    }
                  ]
                }
              ]
            }
          };
        }
      }
    };
    const mockLogger = { debug: () => {} };

    const result = await handleControlRoom(
      { roomId: 1, characteristic: 'On', value: true },
      mockClient,
      mockLogger
    );

    const response = JSON.parse(result.content[0].text);
    expect(response.affected).toHaveLength(0);
    expect(response.skipped).toHaveLength(1);
  });

  test('should filter by serviceType when specified', async () => {
    const updateCalls = [];
    const mockClient = {
      callMethod: async (method, args) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 10,
                  name: 'Light',
                  roomId: 1,
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 10, sId: 13, cId: 15, control: { type: 'On', write: true } }
                      ]
                    }
                  ]
                },
                {
                  id: 11,
                  name: 'Outlet',
                  roomId: 1,
                  services: [
                    {
                      type: 'Outlet',
                      characteristics: [
                        { aId: 11, sId: 13, cId: 15, control: { type: 'On', write: true } }
                      ]
                    }
                  ]
                }
              ]
            }
          };
        }
        if (method === 'characteristic.update') {
          updateCalls.push(args);
          return { success: true };
        }
      }
    };
    const mockLogger = { debug: () => {} };

    await handleControlRoom(
      { roomId: 1, characteristic: 'On', value: true, serviceType: 'Lightbulb' },
      mockClient,
      mockLogger
    );

    // Should only update the Lightbulb, not the Outlet
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].characteristic.update.aId).toBe(10);
  });
});
