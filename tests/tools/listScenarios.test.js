// tests/tools/listScenarios.test.js
import { handleListScenarios } from '../../src/tools/listScenarios.js';

describe('handleListScenarios', () => {
  test('should return shallow scenario data', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return [
          {
            id: 1,
            name: 'Good Night',
            enabled: true,
            description: 'Turn off all lights',
            triggers: [{ type: 'time' }],
            actions: [{ type: 'accessory' }]
          }
        ];
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleListScenarios({}, mockClient, mockLogger);

    expect(capturedMethod).toBe('scenario.list');
    expect(capturedArgs).toEqual({
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
