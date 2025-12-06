// src/tools/controlRoom.js
export async function handleControlRoom(args, sprutClient, logger) {
  const { roomId, characteristic, value, serviceType } = args;

  if (!roomId) {
    throw new Error('roomId parameter is required. Use spruthub_list_rooms to find room IDs.');
  }
  if (!characteristic) {
    throw new Error('characteristic parameter is required (e.g., "On", "Brightness").');
  }
  if (value === undefined) {
    throw new Error('value parameter is required.');
  }

  logger.debug(`Controlling room ${roomId}: ${characteristic} = ${value}, filter: ${serviceType || 'all'}`);

  // Get accessories in this room
  const searchResult = await sprutClient.callMethod('accessory.search', {
    roomId,
    page: 1,
    limit: 100,
    expand: 'services'
  });

  let accessories = searchResult.accessories || [];

  // Filter by service type if specified
  if (serviceType) {
    accessories = accessories.filter(acc =>
      (acc.services || []).some(s => s.type === serviceType)
    );
  }

  const affected = [];
  const failed = [];

  // Update each accessory
  for (const acc of accessories) {
    try {
      await sprutClient.callMethod('characteristic.update', {
        id: acc.id,
        characteristic,
        value
      });
      affected.push({
        id: acc.id,
        name: acc.name,
        characteristic,
        value
      });
    } catch (error) {
      failed.push({
        id: acc.id,
        name: acc.name,
        error: error.message
      });
    }
  }

  const response = {
    success: true,
    roomId,
    characteristic,
    value,
    serviceType: serviceType || null,
    affected,
    failed: failed.length > 0 ? failed : undefined
  };

  const content = [
    {
      type: 'text',
      text: JSON.stringify(response, null, 2)
    }
  ];

  return { content };
}
