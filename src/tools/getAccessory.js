// src/tools/getAccessory.js
export async function handleGetAccessory(args, sprutClient, logger) {
  const { id } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_accessories to find accessory IDs.');
  }

  logger.debug(`Getting accessory details for ID: ${id}`);

  const result = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 100,
    expand: 'characteristics'
  });

  // API returns { isSuccess, code, message, data: { accessories: [...] } }
  const data = result.data || result;
  // Filter by ID since accessory.search may not support direct ID filter
  const accessory = (data.accessories || []).find(a => a.id === id);

  if (!accessory) {
    throw new Error(`Accessory with ID ${id} not found`);
  }

  const content = [
    {
      type: 'text',
      text: `Accessory "${accessory.name}" (ID: ${accessory.id}):`
    },
    {
      type: 'text',
      text: JSON.stringify(accessory, null, 2)
    }
  ];

  return { content };
}
