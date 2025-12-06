// src/tools/runScenario.js
export async function handleRunScenario(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_scenarios to find scenario IDs.');
  }

  logger.debug(`Running scenario ${id}`);

  await sprutClient.callMethod('scenario.run', {
    scenario: { run: { id } }
  });

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        scenarioId: id
      }, null, 2)
    }
  ];

  return { content };
}
