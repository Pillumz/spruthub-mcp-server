// src/tools/controlAccessory.js
export async function handleControlAccessory(args, sprutClient, logger) {
  const { id, characteristic, value } = args;

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

  await sprutClient.callMethod('characteristic.update', {
    id,
    characteristic,
    value
  });

  const content = [
    {
      type: 'text',
      text: JSON.stringify({
        success: true,
        accessoryId: id,
        characteristic,
        value
      }, null, 2)
    }
  ];

  return { content };
}
