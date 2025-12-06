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

  if (!result || !result.id) {
    throw new Error(`Scenario with ID ${id} not found`);
  }

  const content = [
    {
      type: 'text',
      text: `Scenario "${result.name}" (ID: ${result.id}):`
    },
    {
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }
  ];

  return { content };
}
