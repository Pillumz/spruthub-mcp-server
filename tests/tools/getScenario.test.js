// tests/tools/getScenario.test.js
import { handleGetScenario } from '../../src/tools/getScenario.js';

describe('handleGetScenario', () => {
  test('should return full scenario data for valid ID', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return {
          id: 10,
          name: 'Good Night',
          enabled: true,
          triggers: [{ type: 'time', time: '22:00' }],
          actions: [{ type: 'accessory', id: 5 }]
        };
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleGetScenario({ id: 10 }, mockClient, mockLogger);

    expect(capturedMethod).toBe('scenario.get');
    expect(capturedArgs).toEqual({
      scenario: { get: { id: 10 } }
    });
    expect(result.content[0].text).toContain('Good Night');
  });

  test('should throw error for missing ID', async () => {
    const mockClient = { callMethod: async () => {} };
    const mockLogger = { debug: () => {}, error: () => {} };

    await expect(handleGetScenario({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });
});
