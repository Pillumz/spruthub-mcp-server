// tests/tools/listAccessories.test.js
import { handleListAccessories } from '../../src/tools/listAccessories.js';

describe('handleListAccessories', () => {
  test('should return shallow accessory data', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return {
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
        };
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleListAccessories({}, mockClient, mockLogger);

    expect(result.content[0].type).toBe('text');
    expect(capturedMethod).toBe('accessory.search');
    expect(capturedArgs).toEqual({
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
      callMethod: async () => ({
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
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleListAccessories({}, mockClient, mockLogger);
    const accessories = JSON.parse(result.content[1].text);

    expect(accessories[0].serviceTypes).toEqual(['Lightbulb', 'Switch']);
  });
});
