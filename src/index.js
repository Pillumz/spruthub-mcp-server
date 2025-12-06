#!/usr/bin/env node

import 'dotenv/config';
import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Sprut, Schema } from 'spruthub-client';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';
import {
  handleListAccessories,
  handleGetAccessory,
  handleListRooms,
  handleListScenarios,
  handleGetScenario,
  handleGetLogs,
  handleControlAccessory,
  handleControlRoom,
  handleRunScenario
} from './tools/index.js';

const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

export class SpruthubMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'spruthub-mcp-server',
        version: packageJson.version,
        description: 'Spruthub MCP Server - Provides secure access to Sprut.hub smart home system via JSON-RPC API. Supports listing devices, controlling accessories, managing scenarios, and system administration.',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.logger = {
      info: (msg, ...args) => console.error('[INFO]', typeof msg === 'object' ? JSON.stringify(msg) : msg, ...args),
      error: (msg, ...args) => console.error('[ERROR]', typeof msg === 'object' ? JSON.stringify(msg) : msg, ...args),
      warn: (msg, ...args) => console.error('[WARN]', typeof msg === 'object' ? JSON.stringify(msg) : msg, ...args),
      debug: (msg, ...args) => process.env.LOG_LEVEL === 'debug' && console.error('[DEBUG]', typeof msg === 'object' ? JSON.stringify(msg) : msg, ...args)
    };

    this.sprutClient = null;
    
    this.setupToolHandlers();
    this.setupGracefulShutdown();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'spruthub_list_methods',
            description: 'List all available Sprut.hub JSON-RPC API methods with their categories and descriptions',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Filter methods by category (hub, accessory, scenario, room, system)',
                },
              },
            },
          },
          {
            name: 'spruthub_get_method_schema',
            description: 'Get detailed schema for a specific Sprut.hub API method including parameters, return type, examples',
            inputSchema: {
              type: 'object',
              properties: {
                methodName: {
                  type: 'string',
                  description: 'The method name (e.g., "accessory.search", "characteristic.update")',
                },
              },
              required: ['methodName'],
            },
          },
          {
            name: 'spruthub_call_method',
            description: 'Execute any Sprut.hub JSON-RPC API method. IMPORTANT: You MUST call spruthub_get_method_schema first to understand the exact parameter structure before calling this method. Never guess parameters.',
            inputSchema: {
              type: 'object',
              properties: {
                methodName: {
                  type: 'string',
                  description: 'The method name to call (e.g., "accessory.search", "characteristic.update")',
                },
                parameters: {
                  type: 'object',
                  description: 'Method parameters exactly as defined in the method schema. MUST call spruthub_get_method_schema first to get the correct parameter structure. Do not guess parameter names or structure.',
                },
              },
              required: ['methodName'],
            },
          },
          {
            name: 'spruthub_list_accessories',
            description: 'List all smart home accessories with shallow data (id, name, room, online status). Use this first to discover accessory IDs before controlling devices.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_get_accessory',
            description: 'Get full details for a single accessory including all services and characteristics. Requires accessory ID from spruthub_list_accessories.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Accessory ID (use spruthub_list_accessories to find IDs)',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'spruthub_list_rooms',
            description: 'List all rooms in the smart home. Use this to discover room IDs before room-wide control.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_list_scenarios',
            description: 'List all automation scenarios with shallow data (id, name, enabled). Use this to discover scenario IDs before running them.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'spruthub_get_scenario',
            description: 'Get full details for a single scenario including triggers, conditions, and actions. Requires scenario ID from spruthub_list_scenarios.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Scenario ID (use spruthub_list_scenarios to find IDs)',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'spruthub_get_logs',
            description: 'Get recent system logs. Default 20 entries, max 100.',
            inputSchema: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                  description: 'Number of log entries to retrieve (default: 20, max: 100)',
                },
              },
            },
          },
          {
            name: 'spruthub_control_accessory',
            description: 'Control a single smart home device by setting a characteristic value. Requires accessory ID from spruthub_list_accessories.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Accessory ID (use spruthub_list_accessories to find IDs)',
                },
                characteristic: {
                  type: 'string',
                  description: 'Characteristic type to set (e.g., "On", "Brightness", "TargetTemperature")',
                },
                value: {
                  description: 'New value for the characteristic (type depends on characteristic)',
                },
              },
              required: ['id', 'characteristic', 'value'],
            },
          },
          {
            name: 'spruthub_control_room',
            description: 'Control all devices in a room at once. Optionally filter by device type. Requires room ID from spruthub_list_rooms.',
            inputSchema: {
              type: 'object',
              properties: {
                roomId: {
                  type: 'number',
                  description: 'Room ID (use spruthub_list_rooms to find IDs)',
                },
                characteristic: {
                  type: 'string',
                  description: 'Characteristic type to set on all devices (e.g., "On", "Brightness")',
                },
                value: {
                  description: 'New value for the characteristic',
                },
                serviceType: {
                  type: 'string',
                  description: 'Optional: filter by device type (e.g., "Lightbulb", "Switch", "Thermostat")',
                },
              },
              required: ['roomId', 'characteristic', 'value'],
            },
          },
          {
            name: 'spruthub_run_scenario',
            description: 'Execute an automation scenario. Requires scenario ID from spruthub_list_scenarios.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: 'Scenario ID (use spruthub_list_scenarios to find IDs)',
                },
              },
              required: ['id'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.debug(`Tool call: ${name}, args: ${JSON.stringify(args)}`);

      try {
        switch (name) {
          case 'spruthub_list_methods':
            return await this.handleListMethods(args);
          case 'spruthub_get_method_schema':
            return await this.handleGetMethodSchema(args);
          case 'spruthub_call_method':
            return await this.handleCallMethod(args);
          case 'spruthub_list_accessories':
            await this.ensureConnected();
            return await handleListAccessories(args, this.sprutClient, this.logger);
          case 'spruthub_get_accessory':
            await this.ensureConnected();
            return await handleGetAccessory(args, this.sprutClient, this.logger);
          case 'spruthub_list_rooms':
            await this.ensureConnected();
            return await handleListRooms(args, this.sprutClient, this.logger);
          case 'spruthub_list_scenarios':
            await this.ensureConnected();
            return await handleListScenarios(args, this.sprutClient, this.logger);
          case 'spruthub_get_scenario':
            await this.ensureConnected();
            return await handleGetScenario(args, this.sprutClient, this.logger);
          case 'spruthub_get_logs':
            await this.ensureConnected();
            return await handleGetLogs(args, this.sprutClient, this.logger);
          case 'spruthub_control_accessory':
            await this.ensureConnected();
            return await handleControlAccessory(args, this.sprutClient, this.logger);
          case 'spruthub_control_room':
            await this.ensureConnected();
            return await handleControlRoom(args, this.sprutClient, this.logger);
          case 'spruthub_run_scenario':
            await this.ensureConnected();
            return await handleRunScenario(args, this.sprutClient, this.logger);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${error.message}`);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleListMethods(args = {}) {
    try {
      const { category } = args;
      
      let methods;
      if (category) {
        // Filter by category
        methods = Schema.getMethodsByCategory(category);
        if (Object.keys(methods).length === 0) {
          // Check if category exists
          const availableCategories = Schema.getCategories();
          if (!availableCategories.includes(category)) {
            throw new Error(`Unknown category: ${category}. Available categories: ${availableCategories.join(', ')}`);
          }
        }
      } else {
        // Get all methods
        const allMethodNames = Schema.getAvailableMethods();
        methods = {};
        allMethodNames.forEach(methodName => {
          methods[methodName] = Schema.getMethodSchema(methodName);
        });
      }

      // Format the response with method summaries
      const methodSummaries = Object.keys(methods).map(methodName => {
        const method = methods[methodName];
        return {
          name: methodName,
          category: method.category,
          description: method.description,
          hasRest: !!method.rest,
          restMapping: method.rest ? `${method.rest.method} ${method.rest.path}` : null
        };
      });

      const content = [
        {
          type: 'text',
          text: category ? 
            `Found ${methodSummaries.length} methods in category "${category}":` :
            `Found ${methodSummaries.length} available API methods:`,
        },
        {
          type: 'text',
          text: JSON.stringify(methodSummaries, null, 2),
        },
      ];

      return {
        content: this.processResponse(content),
        _meta: {
          methods: methodSummaries,
          totalCount: methodSummaries.length,
          category: category || 'all',
          availableCategories: Schema.getCategories()
        }
      };
    } catch (error) {
      this.logger.error(`Failed to list methods: ${error.message}`);
      throw new Error(`Failed to list methods: ${error.message}`);
    }
  }

  async handleGetMethodSchema(args) {
    try {
      const { methodName } = args;
      
      if (!methodName) {
        throw new Error('methodName parameter is required');
      }

      const schema = Schema.getMethodSchema(methodName);
      if (!schema) {
        const availableMethods = Schema.getAvailableMethods();
        throw new Error(`Method "${methodName}" not found. Available methods: ${availableMethods.slice(0, 10).join(', ')}${availableMethods.length > 10 ? '...' : ''}`);
      }

      const content = [
        {
          type: 'text',
          text: `Schema for "${methodName}":`,
        },
        {
          type: 'text',
          text: JSON.stringify(schema, null, 2),
        },
      ];

      return {
        content: this.processResponse(content),
        _meta: {
          methodName,
          schema,
          category: schema.category,
          hasRest: !!schema.rest,
          hasExamples: !!(schema.examples && schema.examples.length > 0)
        }
      };
    } catch (error) {
      this.logger.error(`Failed to get method schema: ${error.message}`);
      throw new Error(`Failed to get method schema: ${error.message}`);
    }
  }

  async handleCallMethod(args) {
    try {
      const { methodName, parameters = {} } = args;
      
      if (!methodName) {
        throw new Error('methodName parameter is required');
      }

      this.logger.debug(`Attempting to call method: ${methodName}`);
      this.logger.debug(`Parameters: ${JSON.stringify(parameters)}`);

      // Validate method exists in schema
      const schema = Schema.getMethodSchema(methodName);
      if (!schema) {
        const availableMethods = Schema.getAvailableMethods();
        this.logger.error(`Schema lookup failed for method: "${methodName}" (type: ${typeof methodName})`);
        throw new Error(`Method "${methodName}" not found. Available methods: ${availableMethods.slice(0, 10).join(', ')}${availableMethods.length > 10 ? '...' : ''}`);
      }

      // Ensure connection
      await this.ensureConnected();

      // Execute the method
      const result = await this.sprutClient.callMethod(methodName, parameters);

      const content = [
        {
          type: 'text',
          text: `Called ${methodName} successfully`,
        },
        {
          type: 'text',
          text: `Result: ${JSON.stringify(result, null, 2)}`,
        },
      ];

      return {
        content: this.processResponse(content),
        _meta: {
          methodName,
          parameters,
          result,
          schema: schema
        }
      };
    } catch (error) {
      this.logger.error(`Failed to call method: ${error.message}`);
      throw new Error(`Failed to call method: ${error.message}`);
    }
  }

  async ensureConnected() {
    if (!this.sprutClient) {
      const wsUrl = process.env.SPRUTHUB_WS_URL;
      const sprutEmail = process.env.SPRUTHUB_EMAIL;
      const sprutPassword = process.env.SPRUTHUB_PASSWORD;
      const serial = process.env.SPRUTHUB_SERIAL;

      if (!wsUrl || !sprutEmail || !sprutPassword || !serial) {
        throw new Error('Not connected and missing required connection parameters. Set environment variables: SPRUTHUB_WS_URL, SPRUTHUB_EMAIL, SPRUTHUB_PASSWORD, SPRUTHUB_SERIAL');
      }

      this.logger.info('Auto-connecting to Spruthub server...');
      
      try {
        this.sprutClient = new Sprut({
          wsUrl,
          sprutEmail,
          sprutPassword,
          serial,
          logger: this.logger,
        });

        await this.sprutClient.connected();
      } catch (error) {
        this.logger.error(`Failed to connect to Spruthub: ${error.message}`);
        throw new Error(`Failed to connect: ${error.message}`);
      }
    }
  }

  processResponse(content) {
    // Simple pass-through since we don't need token protection for schema tools
    return content;
  }


  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      if (this.sprutClient) {
        try {
          await this.sprutClient.close();
          this.logger.info('Successfully disconnected from Spruthub server');
        } catch (error) {
          this.logger.error(`Failed to disconnect gracefully: ${error.message}`);
        }
      }
      
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('exit', () => {
      if (this.sprutClient) {
        this.logger.info('Process exiting, cleaning up connection...');
      }
    });
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('Spruthub MCP server started (stdio mode)');
  }

  async runHTTP() {
    const httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      // Health check endpoint
      if (url.pathname === '/health' && req.method === 'GET') {
        const status = {
          status: 'ok',
          name: 'spruthub-mcp-server',
          version: packageJson.version,
          connected: !!this.sprutClient,
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
        return;
      }

      // MCP endpoint - handles both GET and POST via StreamableHTTP
      if (url.pathname === '/mcp' || url.pathname === '/sse') {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
        });

        await this.server.connect(transport);
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404).end('Not found');
    });

    httpServer.listen(PORT, HOST, () => {
      this.logger.info(`Spruthub MCP server running on http://${HOST}:${PORT}`);
      this.logger.info(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
      this.logger.info(`Health check: http://${HOST}:${PORT}/health`);
    });
  }
}

// This check is crucial for allowing the script to be executed directly via `node`
// and also correctly when installed and run via `npx`.
//
// `import.meta.url` provides the file URL of the current module.
// `process.argv[1]` is the path to the executed script.
// When run with `npx`, process.argv[1] points to a symlink. We need to resolve
// this to its real path to compare it with the module's actual file path.
const isMainModule = () => {
  try {
    // Get the path of the script that was executed.
    const mainPath = fs.realpathSync(process.argv[1]);
    // Get the path of the current module.
    const modulePath = fileURLToPath(import.meta.url);
    // Compare the two. If they are the same, this is the main module.
    return mainPath === modulePath;
  } catch (error) {
    // If realpathSync fails (e.g., file not found), it's not the main module.
    console.error(`[DEBUG] Error in isMainModule check: ${error.message}`);
    return false;
  }
};

if (isMainModule()) {
  const server = new SpruthubMCPServer();
  const mode = process.argv[2] || 'stdio';

  const run = async () => {
    if (mode === 'sse' || mode === 'http') {
      await server.runHTTP();
    } else {
      await server.runStdio();
    }
  };

  run().catch((error) => {
    console.error('Server failed to start:', error);
    process.exit(1);
  });
}