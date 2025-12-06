// tests/tools/listRooms.test.js
import { handleListRooms } from '../../src/tools/listRooms.js';

describe('handleListRooms', () => {
  test('should return all rooms', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return [
          { id: 1, name: 'Bedroom', icon: 'bed' },
          { id: 2, name: 'Kitchen', icon: 'kitchen' }
        ];
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleListRooms({}, mockClient, mockLogger);

    expect(capturedMethod).toBe('room.list');
    expect(capturedArgs).toEqual({
      room: { list: {} }
    });
    expect(result.content[0].text).toContain('2 rooms');
  });

  test('should handle empty rooms list', async () => {
    const mockClient = {
      callMethod: async () => []
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleListRooms({}, mockClient, mockLogger);
    const rooms = JSON.parse(result.content[1].text);

    expect(rooms).toEqual([]);
  });
});
