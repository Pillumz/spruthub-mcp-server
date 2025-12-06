// tests/tools/runScenario.test.js
import { handleRunScenario } from '../../src/tools/runScenario.js';

describe('handleRunScenario', () => {
  test('should run scenario successfully', async () => {
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return { success: true };
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleRunScenario({ id: 10 }, mockClient, mockLogger);

    expect(capturedMethod).toBe('scenario.run');
    expect(capturedArgs).toEqual({
      scenario: { run: { id: 10 } }
    });

    const response = JSON.parse(result.content[0].text);
    expect(response.success).toBe(true);
    expect(response.scenarioId).toBe(10);
  });

  test('should throw error for missing id', async () => {
    const mockClient = { callMethod: async () => {} };
    const mockLogger = { debug: () => {}, error: () => {} };

    await expect(handleRunScenario({}, mockClient, mockLogger))
      .rejects.toThrow('id parameter is required');
  });
});
