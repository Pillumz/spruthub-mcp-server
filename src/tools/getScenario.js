// src/tools/getScenario.js
export async function handleGetScenario(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_scenarios to find scenario IDs.');
  }

  logger.debug(`Getting scenario details for ID: ${id}`);

  const result = await sprutClient.callMethod('scenario.get', {
    scenario: { get: { id } }
  });

  // API may return { isSuccess, code, message, data: {...} } or scenario directly
  const scenario = result.data || result;

  if (!scenario || !scenario.id) {
    throw new Error(`Scenario with ID ${id} not found`);
  }

  const content = [
    {
      type: 'text',
      text: `Scenario "${scenario.name}" (ID: ${scenario.id}):`
    },
    {
      type: 'text',
      text: JSON.stringify(scenario, null, 2)
    }
  ];

  return { content };
}
