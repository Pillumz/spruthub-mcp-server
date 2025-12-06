// tests/tools/controlAccessory.test.js
import { handleControlAccessory } from '../../src/tools/controlAccessory.js';

describe('handleControlAccessory', () => {
  test('should control accessory with correct aId/sId/cId payload', async () => {
    let capturedUpdatePayload;
    const mockClient = {
      callMethod: async (method, args) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 5,
                  name: 'Test Light',
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        {
                          aId: 5,
                          sId: 13,
                          cId: 15,
                          control: { type: 'On', write: true }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          };
        }
        if (method === 'characteristic.update') {
          capturedUpdatePayload = args;
          return { success: true };
        }
      }
    };
    const mockLogger = { debug: () => {} };

    const result = await handleControlAccessory(
      { id: 5, characteristic: 'On', value: true },
      mockClient,
      mockLogger
    );

    expect(capturedUpdatePayload).toEqual({
      aId: 5,
      sId: 13,
      cId: 15,
      control: {
        value: { boolValue: true }
      }
    });
    expect(result.content[0].text).toContain('success');
  });

  test('should throw error for missing id', async () => {
    const mockClient = { callMethod: async () => ({}) };
    const mockLogger = { debug: () => {} };

    await expect(handleControlAccessory(
      { characteristic: 'On', value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('id parameter is required');
  });

  test('should throw error for missing characteristic', async () => {
    const mockClient = { callMethod: async () => ({}) };
    const mockLogger = { debug: () => {} };

    await expect(handleControlAccessory(
      { id: 5, value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('characteristic parameter is required');
  });

  test('should throw error for missing value', async () => {
    const mockClient = { callMethod: async () => ({}) };
    const mockLogger = { debug: () => {} };

    await expect(handleControlAccessory(
      { id: 5, characteristic: 'On' },
      mockClient,
      mockLogger
    )).rejects.toThrow('value parameter is required');
  });

  test('should throw error when characteristic not found', async () => {
    const mockClient = {
      callMethod: async (method) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 5,
                  name: 'Test Light',
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 5, sId: 13, cId: 15, control: { type: 'Brightness' } }
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

    await expect(handleControlAccessory(
      { id: 5, characteristic: 'On', value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('Characteristic "On" not found');
  });

  test('should wrap integer values correctly', async () => {
    let capturedPayload;
    const mockClient = {
      callMethod: async (method, args) => {
        if (method === 'accessory.search') {
          return {
            data: {
              accessories: [
                {
                  id: 5,
                  name: 'Test Light',
                  services: [
                    {
                      type: 'Lightbulb',
                      characteristics: [
                        { aId: 5, sId: 13, cId: 16, control: { type: 'Brightness', write: true } }
                      ]
                    }
                  ]
                }
              ]
            }
          };
        }
        if (method === 'characteristic.update') {
          capturedPayload = args;
          return { success: true };
        }
      }
    };
    const mockLogger = { debug: () => {} };

    await handleControlAccessory(
      { id: 5, characteristic: 'Brightness', value: 75 },
      mockClient,
      mockLogger
    );

    expect(capturedPayload.control.value).toEqual({ intValue: 75 });
  });
});
