// tests/tools/controlAccessory.test.js
import { handleControlAccessory } from '../../src/tools/controlAccessory.js';

describe('handleControlAccessory', () => {
  test('should update characteristic successfully', async () => {
    let calledWith = null;
    const mockClient = {
      callMethod: async (method, params) => {
        calledWith = { method, params };
        return { success: true };
      }
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    const result = await handleControlAccessory(
      { id: 5, characteristic: 'On', value: true },
      mockClient,
      mockLogger
    );

    expect(calledWith.method).toBe('characteristic.update');
    expect(calledWith.params.id).toBe(5);
    expect(calledWith.params.characteristic).toBe('On');
    expect(calledWith.params.value).toBe(true);
    expect(result.content[0].text).toContain('success');
  });

  test('should throw error for missing id', async () => {
    const mockClient = {
      callMethod: async () => ({})
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    await expect(handleControlAccessory(
      { characteristic: 'On', value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('id parameter is required');
  });

  test('should throw error for missing characteristic', async () => {
    const mockClient = {
      callMethod: async () => ({})
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    await expect(handleControlAccessory(
      { id: 5, value: true },
      mockClient,
      mockLogger
    )).rejects.toThrow('characteristic parameter is required');
  });

  test('should throw error for missing value', async () => {
    const mockClient = {
      callMethod: async () => ({})
    };
    const mockLogger = {
      debug: () => {},
      error: () => {}
    };

    await expect(handleControlAccessory(
      { id: 5, characteristic: 'On' },
      mockClient,
      mockLogger
    )).rejects.toThrow('value parameter is required');
  });
});
