// src/tools/getLogs.js
const DEFAULT_COUNT = 20;
const MAX_COUNT = 100;

export async function handleGetLogs(args, sprutClient, logger) {
  const requestedCount = args.count || DEFAULT_COUNT;
  const count = Math.min(Math.max(1, requestedCount), MAX_COUNT);

  logger.debug(`Getting ${count} log entries`);

  const result = await sprutClient.callMethod('log.list', {
    log: { list: { count } }
  });

  const logs = Array.isArray(result) ? result : [];

  const content = [
    {
      type: 'text',
      text: `Retrieved ${logs.length} log entries:`
    },
    {
      type: 'text',
      text: JSON.stringify(logs, null, 2)
    }
  ];

  return { content };
}
