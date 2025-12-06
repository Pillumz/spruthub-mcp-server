// src/tools/listAccessories.js
export async function handleListAccessories(args, sprutClient, logger) {
  logger.debug('Listing accessories with shallow data');

  const result = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 100,
    expand: 'none'
  });

  // API returns { isSuccess, code, message, data: { accessories: [...] } }
  const data = result.data || result;
  logger.debug(`Found ${(data.accessories || []).length} accessories`);
  const accessories = (data.accessories || []).map(acc => ({
    id: acc.id,
    name: acc.name,
    room: acc.room?.name || null,
    roomId: acc.room?.id || null,
    online: acc.online ?? true,
    manufacturer: acc.manufacturer || null,
    serviceTypes: (acc.services || []).map(s => s.type).filter(Boolean)
  }));

  const content = [
    {
      type: 'text',
      text: `Found ${accessories.length} accessories:`
    },
    {
      type: 'text',
      text: JSON.stringify(accessories, null, 2)
    }
  ];

  return { content };
}
