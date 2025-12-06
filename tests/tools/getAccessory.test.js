// tests/tools/getAccessory.test.js
import { handleGetAccessory } from '../../src/tools/getAccessory.js';

describe('handleGetAccessory', () => {
  test('should return full accessory data for valid ID', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return {
          accessories: [
            {
              id: 5,
              name: 'Ceiling Light',
              room: { id: 1, name: 'Bedroom' },
              services: [{ type: 'Lightbulb', characteristics: [{ type: 'On', value: true }] }]
            }
          ]
        };
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleGetAccessory({ id: 5 }, mockClient, mockLogger);

    expect(capturedMethod).toBe('accessory.search');
    expect(capturedArgs).toEqual({
      page: 1,
      limit: 1,
      expand: 'characteristics'
    });
    expect(result.content[0].text).toContain('Ceiling Light');
  });

  test('should throw error for missing ID', async () => {
    const mockClient = { callMethod: async () => {} };
    const mockLogger = { debug: () => {}, error: () => {} };

    await expect(handleGetAccessory({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });

  test('should throw error when accessory not found', async () => {
    const mockClient = {
      callMethod: async () => ({ accessories: [] })
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    await expect(handleGetAccessory({ id: 999 }, mockClient, mockLogger))
      .rejects.toThrow('Accessory with ID 999 not found');
  });
});
