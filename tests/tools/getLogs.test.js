// tests/tools/getLogs.test.js
import { handleGetLogs } from '../../src/tools/getLogs.js';

describe('handleGetLogs', () => {
  test('should return logs with default count of 20', async () => {
    const mockLogs = Array(20).fill(null).map((_, i) => ({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Log entry ${i}`
    }));
    let capturedMethod, capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedMethod = method;
        capturedArgs = args;
        return mockLogs;
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    const result = await handleGetLogs({}, mockClient, mockLogger);

    expect(capturedMethod).toBe('log.list');
    expect(capturedArgs).toEqual({
      log: { list: { count: 20 } }
    });
    expect(result.content[0].text).toContain('20');
  });

  test('should accept custom count parameter', async () => {
    let capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedArgs = args;
        return [];
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    await handleGetLogs({ count: 50 }, mockClient, mockLogger);

    expect(capturedArgs).toEqual({
      log: { list: { count: 50 } }
    });
  });

  test('should cap count at 100', async () => {
    let capturedArgs;
    const mockClient = {
      callMethod: async (method, args) => {
        capturedArgs = args;
        return [];
      }
    };
    const mockLogger = { debug: () => {}, error: () => {} };

    await handleGetLogs({ count: 500 }, mockClient, mockLogger);

    expect(capturedArgs).toEqual({
      log: { list: { count: 100 } }
    });
  });
});
