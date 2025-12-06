// src/tools/controlRoom.js

/**
 * Wraps a value in the appropriate Sprut.hub format
 * API expects: { boolValue: X } or { intValue: X } or { stringValue: X }
 */
function wrapValue(value) {
  if (typeof value === 'boolean') {
    return { boolValue: value };
  } else if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { intValue: value };
    } else {
      return { floatValue: value };
    }
  } else if (typeof value === 'string') {
    // Try to parse as boolean or number
    if (value === 'true') return { boolValue: true };
    if (value === 'false') return { boolValue: false };
    const num = Number(value);
    if (!isNaN(num)) {
      return Number.isInteger(num) ? { intValue: num } : { floatValue: num };
    }
    return { stringValue: value };
  }
  return { stringValue: String(value) };
}

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

  // Get accessories with full characteristic data
  const searchResult = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 100,
    expand: 'characteristics'
  });

  // API returns { isSuccess, code, message, data: { accessories: [...] } }
  const searchData = searchResult.data || searchResult;
  let accessories = (searchData.accessories || []).filter(acc => acc.roomId === roomId);

  // Filter by service type if specified
  if (serviceType) {
    accessories = accessories.filter(acc =>
      (acc.services || []).some(s => s.type === serviceType)
    );
  }

  const affected = [];
  const failed = [];
  const skipped = [];

  // Update each accessory
  for (const acc of accessories) {
    // Find the characteristic in this accessory
    let foundCharacteristic = null;
    let foundService = null;

    for (const service of (acc.services || [])) {
      // If serviceType specified, only look in matching services
      if (serviceType && service.type !== serviceType) {
        continue;
      }

      for (const char of (service.characteristics || [])) {
        const charType = char.control?.type || char.type;
        if (charType === characteristic) {
          foundCharacteristic = char;
          foundService = service;
          break;
        }
      }
      if (foundCharacteristic) break;
    }

    if (!foundCharacteristic) {
      skipped.push({
        id: acc.id,
        name: acc.name,
        reason: `No "${characteristic}" characteristic found`
      });
      continue;
    }

    // Check if characteristic is writable
    if (foundCharacteristic.control?.write === false) {
      skipped.push({
        id: acc.id,
        name: acc.name,
        reason: `"${characteristic}" is read-only`
      });
      continue;
    }

    // Build the API payload
    const payload = {
      aId: foundCharacteristic.aId,
      sId: foundCharacteristic.sId,
      cId: foundCharacteristic.cId,
      control: {
        value: wrapValue(value)
      }
    };

    try {
      await sprutClient.callMethod('characteristic.update', payload);
      affected.push({
        id: acc.id,
        name: acc.name,
        service: foundService.type,
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
    skipped: skipped.length > 0 ? skipped : undefined,
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
