// src/tools/listScenarios.js
export async function handleListScenarios(args, sprutClient, logger) {
  logger.debug('Listing all scenarios with shallow data');

  const result = await sprutClient.callMethod('scenario.list', {
    scenario: { list: {} }
  });

  const scenarios = (Array.isArray(result) ? result : []).map(s => ({
    id: s.id,
    name: s.name,
    enabled: s.enabled ?? true,
    description: s.description || null
  }));

  const content = [
    {
      type: 'text',
      text: `Found ${scenarios.length} scenarios:`
    },
    {
      type: 'text',
      text: JSON.stringify(scenarios, null, 2)
    }
  ];

  return { content };
}
