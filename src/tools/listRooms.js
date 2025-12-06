// src/tools/listRooms.js
export async function handleListRooms(args, sprutClient, logger) {
  logger.debug('Listing all rooms');

  const result = await sprutClient.callMethod('room.list', {
    room: { list: {} }
  });

  // API may return { isSuccess, code, message, data: [...] } or array directly
  const data = result.data || result;
  const rooms = Array.isArray(data) ? data : (data.rooms || []);

  const content = [
    {
      type: 'text',
      text: `Found ${rooms.length} rooms:`
    },
    {
      type: 'text',
      text: JSON.stringify(rooms, null, 2)
    }
  ];

  return { content };
}
