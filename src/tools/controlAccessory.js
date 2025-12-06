// src/tools/controlAccessory.js

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

export async function handleControlAccessory(args, sprutClient, logger) {
  const { id, characteristic, value, serviceType } = args;

  if (!id) {
    throw new Error('id parameter is required. Use spruthub_list_accessories to find accessory IDs.');
  }
  if (!characteristic) {
    throw new Error('characteristic parameter is required (e.g., "On", "Brightness", "TargetTemperature").');
  }
  if (value === undefined) {
    throw new Error('value parameter is required.');
  }

  logger.debug(`Controlling accessory ${id}: ${characteristic} = ${value}`);

  // First, fetch the accessory to find service and characteristic IDs
  const searchResult = await sprutClient.callMethod('accessory.search', {
    page: 1,
    limit: 100,
    expand: 'characteristics'
  });

  const data = searchResult.data || searchResult;
  const accessory = (data.accessories || []).find(a => a.id === id);

  if (!accessory) {
    throw new Error(`Accessory with ID ${id} not found`);
  }

  // Find the characteristic by type name
  let foundCharacteristic = null;
  let foundService = null;

  for (const service of (accessory.services || [])) {
    // If serviceType specified, filter by it
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
    const serviceHint = serviceType ? ` in service type "${serviceType}"` : '';
    throw new Error(`Characteristic "${characteristic}" not found on accessory ${id}${serviceHint}. Use spruthub_get_accessory to see available characteristics.`);
  }

  // Check if characteristic is writable
  if (foundCharacteristic.control?.write === false) {
    throw new Error(`Characteristic "${characteristic}" is read-only and cannot be controlled.`);
  }

  // Build the API payload with aId, sId, cId
  const payload = {
    aId: foundCharacteristic.aId,
    sId: foundCharacteristic.sId,
    cId: foundCharacteristic.cId,
    control: {
      value: wrapValue(value)
    }
  };

  logger.debug(`Sending characteristic.update: ${JSON.stringify(payload)}`);

  const result = await sprutClient.callMethod('characteristic.update', payload);

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        accessoryId: id,
        accessoryName: accessory.name,
        service: foundService.type,
        characteristic,
        value,
        payload // Include for debugging
      }, null, 2)
    }
  ];

  return { content };
}
