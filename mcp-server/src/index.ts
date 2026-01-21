import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { homedir, platform } from 'os';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Platform detection
const isWindows = platform() === 'win32';
const isMac = platform() === 'darwin';

// Prompt template path (mcp-server has its own template)
const PROMPT_TEMPLATE_PATH = join(__dirname, '..', 'prompt-template.md');

import { generateToken } from './auth/tokenGenerator.js';
import { ChangeQueue } from './store/changeQueue.js';

// Types (defined early for use in formatting functions)
interface VisualChange {
  id: string;
  element: {
    selector: string;
    tag: string;
    id: string | null;
    classes: string[];
    computedStyles: Record<string, string>;
    sourceHint: string | null;
    smartSummary: string | null;
    screenshot: string | null;
  };
  feedback: string;
  visualAdjustments: Record<string, string>;
  cssFramework: string;
  originalUnits: Record<string, string>;
  timestamp: string;
  status: 'draft' | 'staged' | 'confirmed' | 'applied' | 'failed';
}

// Load prompt template from file
function loadPromptTemplate(): string | null {
  try {
    if (existsSync(PROMPT_TEMPLATE_PATH)) {
      const template = readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');
      const lineCount = template.split('\n').length;
      console.error(`Prompt template: ${PROMPT_TEMPLATE_PATH} (${lineCount} lines)`);
      console.error('--- Template ---');
      console.error(template);
      console.error('--- End Template ---\n');
      return template;
    }
  } catch (err) {
    console.error('Failed to load prompt template:', err);
  }
  console.error('Prompt template: using built-in fallback (no prompt-template.md found)');
  return null;
}

// Format a change using the prompt template
function formatChangeWithTemplate(change: VisualChange, template: string | null): string {
  if (!template) {
    // Default formatting without template
    return JSON.stringify({
      id: change.id,
      element: {
        selector: change.element.selector,
        tag: change.element.tag,
        classes: change.element.classes,
        currentStyles: change.element.computedStyles,
        sourceFile: change.element.sourceHint,
        description: change.element.smartSummary,
      },
      userFeedback: change.feedback,
      visualChanges: change.visualAdjustments,
      cssFramework: change.cssFramework,
      timestamp: change.timestamp,
      status: change.status,
    }, null, 2);
  }

  // Build optional sections
  let elementId = '';
  if (change.element.id) {
    elementId = `- **ID:** #${change.element.id}`;
  }

  let elementClasses = '';
  if (change.element.classes && change.element.classes.length > 0) {
    elementClasses = `- **Classes:** .${change.element.classes.join(', .')}`;
  }

  let computedStyles = '';
  if (change.element.computedStyles) {
    const styles = change.element.computedStyles;
    const styleLines = ['## Current Styles'];
    if (styles.width) styleLines.push(`- Width: ${styles.width}`);
    if (styles.height) styleLines.push(`- Height: ${styles.height}`);
    if (styles.backgroundColor) styleLines.push(`- Background: ${styles.backgroundColor}`);
    if (styles.color) styleLines.push(`- Text Color: ${styles.color}`);
    if (styles.fontSize) styleLines.push(`- Font Size: ${styles.fontSize}`);
    if (styles.display) styleLines.push(`- Display: ${styles.display}`);
    if (styles.position) styleLines.push(`- Position: ${styles.position}`);
    computedStyles = styleLines.join('\n');
  }

  // Replace placeholders
  let result = template
    .replace(/\{\{TASK_ID\}\}/g, change.id)
    .replace(/\{\{FEEDBACK\}\}/g, change.feedback)
    .replace(/\{\{ELEMENT_TAG\}\}/g, change.element.tag)
    .replace(/\{\{SELECTOR\}\}/g, change.element.selector || 'N/A')
    .replace(/\{\{ELEMENT_ID\}\}/g, elementId)
    .replace(/\{\{ELEMENT_CLASSES\}\}/g, elementClasses)
    .replace(/\{\{DOM_PATH\}\}/g, '')
    .replace(/\{\{COMPUTED_STYLES\}\}/g, computedStyles)
    .replace(/\{\{PAGE_URL\}\}/g, '')
    .replace(/\{\{BEAD_CONTEXT\}\}/g, '');

  // Clean up empty lines from unused placeholders
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

// Load template on startup
const promptTemplate = loadPromptTemplate();

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Server registry for auto-discovery
const REGISTRY_DIR = join(homedir(), '.visual-feedback');
const REGISTRY_FILE = join(REGISTRY_DIR, 'servers.json');

interface ServerEntry {
  token: string;
  projectPath: string;
  projectName: string;
  port: number;
  pid: number;
  startedAt: string;
}

function registerServer(token: string, port: number) {
  try {
    mkdirSync(REGISTRY_DIR, { recursive: true });

    let servers: Record<string, ServerEntry> = {};
    if (existsSync(REGISTRY_FILE)) {
      try {
        servers = JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));
      } catch {
        servers = {};
      }
    }

    // Clean up stale entries (servers that are no longer running)
    for (const [pid, entry] of Object.entries(servers)) {
      try {
        process.kill(parseInt(pid), 0); // Check if process exists
      } catch {
        delete servers[pid]; // Process doesn't exist, remove entry
      }
    }

    const projectPath = process.cwd();
    servers[process.pid.toString()] = {
      token,
      projectPath,
      projectName: basename(projectPath),
      port,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    };

    writeFileSync(REGISTRY_FILE, JSON.stringify(servers, null, 2));
    console.error(`Registered server for project: ${basename(projectPath)}`);
  } catch (error) {
    console.error('Failed to register server:', error);
  }
}

function unregisterServer() {
  try {
    if (existsSync(REGISTRY_FILE)) {
      const servers = JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));
      delete servers[process.pid.toString()];
      writeFileSync(REGISTRY_FILE, JSON.stringify(servers, null, 2));
    }
  } catch (error) {
    console.error('Failed to unregister server:', error);
  }
}

// Clean up on exit
process.on('exit', unregisterServer);
process.on('SIGINT', () => { unregisterServer(); process.exit(); });
process.on('SIGTERM', () => { unregisterServer(); process.exit(); });

// Auto-submit feedback to the running Claude Code terminal
// On macOS: Uses AppleScript to type into Terminal/iTerm2
// On Windows/Linux: Logs the message (terminal automation not supported)
function autoSubmitToTerminal(feedback: string, selector: string, classes: string[], tag: string) {
  // Build element representation with full class names
  const classAttr = classes.length > 0 ? ` class="${classes.join(' ')}"` : '';
  const elementHtml = `<${tag}${classAttr}>`;

  const message = `Add this feedback to ToDo: "${feedback}" on element ${elementHtml}`;

  console.error('📤 Submitting to Claude Code terminal...');
  console.error(`   Message: ${message}`);

  if (!isMac) {
    // On Windows/Linux, terminal automation is not supported
    // The message is queued and can be retrieved via get_visual_feedback MCP tool
    console.error('ℹ️  Terminal auto-submit not available on this platform');
    console.error('   Use get_visual_feedback MCP tool to retrieve pending changes');
    return;
  }

  // Use AppleScript to type into Terminal and press Enter (macOS only)
  const script = `
    tell application "Terminal"
      activate
      delay 0.5
      tell application "System Events"
        keystroke "${message.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
        delay 0.3
        key code 36
      end tell
    end tell
  `;

  exec(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Failed to submit to terminal:', error.message);
      // Try iTerm2 as fallback
      const itermScript = `
        tell application "iTerm"
          activate
          delay 0.3
          tell current session of current window
            write text "${message.replace(/"/g, '\\"')}"
          end tell
        end tell
      `;
      exec(`osascript -e '${itermScript.replace(/'/g, "'\"'\"'")}'`, (err2) => {
        if (err2) {
          console.error('❌ iTerm2 fallback also failed:', err2.message);
        } else {
          console.error('✅ Submitted via iTerm2');
        }
      });
    } else {
      console.error('✅ Submitted to Terminal');
    }
  });
}

// Auto-apply changes using a headless Claude process (deprecated)
function autoApplyChanges(changeId: string, feedback: string, selector: string) {
  // Single line prompt to avoid shell escaping issues
  const prompt = `VISUAL FEEDBACK: "${feedback}" on element ${selector}. Use get_visual_feedback tool, find the source file, make the edit, then call mark_change_applied with changeId "${changeId}". Do not ask for confirmation.`;

  // Platform-specific Claude path
  const claudePath = isWindows
    ? join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd')
    : join(homedir(), '.local', 'bin', 'claude');
  const workDir = process.cwd();

  console.error('🔄 Spawning Claude to apply changes...');
  console.error(`   Working dir: ${workDir}`);
  console.error(`   Feedback: "${feedback}"`);
  console.error(`   Selector: ${selector}`);

  // Use spawn with args array to properly handle the prompt
  const { spawn } = require('child_process');

  // Platform-specific environment
  const spawnEnv = isWindows
    ? { ...process.env }
    : { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' };

  const child = spawn(claudePath, ['-p', prompt, '--dangerously-skip-permissions'], {
    cwd: workDir,
    env: spawnEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });

  child.stdout?.on('data', (data: Buffer) => {
    console.error('[Claude]', data.toString().trim());
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error('[Claude stderr]', data.toString().trim());
  });

  child.on('close', (code: number) => {
    if (code === 0) {
      console.error('✅ Claude process completed successfully');
    } else {
      console.error(`❌ Claude process exited with code ${code}`);
      if (connectedClient?.readyState === WebSocket.OPEN) {
        connectedClient.send(JSON.stringify({
          type: 'AUTO_APPLY_FAILED',
          changeId,
          error: `Process exited with code ${code}`,
        }));
      }
    }
  });

  child.on('error', (error: Error) => {
    console.error('❌ Failed to spawn Claude:', error.message);
    if (connectedClient?.readyState === WebSocket.OPEN) {
      connectedClient.send(JSON.stringify({
        type: 'AUTO_APPLY_FAILED',
        changeId,
        error: error.message,
      }));
    }
  });
}

// Initialize change queue
const changeQueue = new ChangeQueue();

// Load or generate token (persisted for consistent connections)
const TOKEN_FILE = join(REGISTRY_DIR, 'token');

function loadOrCreateToken(): string {
  try {
    mkdirSync(REGISTRY_DIR, { recursive: true });
    if (existsSync(TOKEN_FILE)) {
      const savedToken = readFileSync(TOKEN_FILE, 'utf-8').trim();
      if (savedToken.length >= 16) {
        return savedToken;
      }
    }
  } catch {
    // Fall through to generate new token
  }

  const newToken = generateToken();
  try {
    writeFileSync(TOKEN_FILE, newToken);
  } catch (err) {
    console.error('Warning: Could not save token:', err);
  }
  return newToken;
}

const TOKEN = loadOrCreateToken();
console.error(`\n${'='.repeat(60)}`);
console.error('Visual Feedback MCP Server Started');
console.error(`${'='.repeat(60)}`);
console.error(`\nConnection Token: ${TOKEN}`);
console.error('\nEnter this token in the Visual Feedback extension to connect.');
console.error(`(Token is saved to ${TOKEN_FILE})`);
console.error(`${'='.repeat(60)}\n`);

// WebSocket server for extension communication
// Only start if we're the primary instance (not spawned by claude -p)
let wss: WebSocketServer | null = null;
let connectedClient: WebSocket | null = null;

function startWebSocketServer() {
  try {
    wss = new WebSocketServer({ port: 3847 });

    wss.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error('WebSocket port 3847 already in use (another MCP instance running)');
        wss = null;
      } else {
        console.error('WebSocket error:', error);
      }
    });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token');

      if (token !== TOKEN) {
        console.error('Connection rejected: Invalid token');
        ws.close(1008, 'Invalid token');
        return;
      }

      console.error('Extension connected');
      connectedClient = ws;

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          handleExtensionMessage(message, ws);
        } catch (error) {
          console.error('Failed to parse extension message:', error);
        }
      });

      ws.on('close', () => {
        console.error('Extension disconnected');
        if (connectedClient === ws) {
          connectedClient = null;
        }
      });
    });

    console.error('WebSocket server started on port 3847');

    // Register for auto-discovery
    registerServer(TOKEN, 3847);
  } catch (error) {
    console.error('Failed to start WebSocket server:', error);
  }
}

// Start WebSocket server
startWebSocketServer();

// SSE transport for MCP connections
let sseTransport: SSEServerTransport | null = null;

// HTTP server for discovery and SSE MCP transport
const httpServer = createServer(async (req, res) => {
  // CORS headers for extension and MCP client access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint for MCP transport
  if (req.url === '/sse' && req.method === 'GET') {
    console.error('SSE connection request received');

    // Create SSE transport - messages will be POSTed to /messages
    sseTransport = new SSEServerTransport('/messages', res);

    // Create a new MCP server for this SSE connection
    const sseServer = createMcpServer();

    try {
      await sseServer.connect(sseTransport);
      console.error('MCP server connected via SSE transport');
    } catch (error) {
      console.error('Failed to connect MCP server via SSE:', error);
    }

    // Don't end the response - SSE keeps it open
    return;
  }

  // Messages endpoint for SSE transport
  if (req.url?.startsWith('/messages') && req.method === 'POST') {
    if (!sseTransport) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No SSE connection established' }));
      return;
    }

    try {
      await sseTransport.handlePostMessage(req, res);
    } catch (error) {
      console.error('Error handling SSE message:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to handle message' }));
      }
    }
    return;
  }

  if (req.url === '/status') {
    // Status endpoint for extension compatibility
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running', wsPort: 3847, requiresToken: true, sseEndpoint: '/sse' }));
  } else if (req.url === '/servers' && req.method === 'GET') {
    try {
      let servers: Record<string, ServerEntry> = {};
      if (existsSync(REGISTRY_FILE)) {
        servers = JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'));

        // Filter out stale servers
        for (const [pid, entry] of Object.entries(servers)) {
          try {
            process.kill(parseInt(pid), 0);
          } catch {
            delete servers[pid];
          }
        }
        // Update file with cleaned entries
        writeFileSync(REGISTRY_FILE, JSON.stringify(servers, null, 2));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(Object.values(servers)));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read servers' }));
    }
  } else if (req.url === '/tasks' && req.method === 'GET') {
    // Return pending visual feedback tasks for Claude Code hooks
    try {
      const pendingChanges = changeQueue.getPending(false);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        count: pendingChanges.length,
        tasks: pendingChanges.map((change) => ({
          id: change.id,
          feedback: change.feedback,
          element: {
            tag: change.element.tag,
            selector: change.element.selector,
            classes: change.element.classes,
          },
          timestamp: change.timestamp,
          status: change.status,
        })),
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to get tasks' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

httpServer.listen(3848, () => {
  console.error('Discovery server started on port 3848');
  console.error('SSE MCP endpoint available at http://localhost:3848/sse');
});

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error('Discovery port 3848 already in use');
  }
});

// Handle messages from extension
function handleExtensionMessage(message: { type: string; payload?: any }, ws: WebSocket) {
  console.error('Received:', message.type);

  // Handle keep-alive pings silently
  if (message.type === 'ping') {
    return;
  }

  // Handle visual feedback from extension (matches standalone server)
  if (message.type === 'visual_feedback' && message.payload) {
    const { id, feedback, element, projectPath, pageUrl, model } = message.payload;
    const taskId = id || Date.now().toString();

    console.error(`\n${'═'.repeat(50)}`);
    console.error('📝 VISUAL FEEDBACK RECEIVED');
    console.error(`${'═'.repeat(50)}`);
    console.error(`Feedback: "${feedback}"`);
    console.error(`Project: ${projectPath}`);
    console.error(`Model: ${model}`);
    console.error(`Element: <${element.tag}> ${element.selector || ''}`);
    if (pageUrl) console.error(`Page: ${pageUrl}`);
    console.error(`${'═'.repeat(50)}\n`);

    // Build change object for queue
    const change: VisualChange = {
      id: taskId,
      element: {
        selector: element.selector,
        tag: element.tag,
        id: element.id || null,
        classes: element.classes || [],
        computedStyles: element.computedStyles || {},
        sourceHint: null,
        smartSummary: null,
        screenshot: element.screenshot || null,
      },
      feedback,
      visualAdjustments: {},
      cssFramework: '',
      originalUnits: {},
      timestamp: new Date().toISOString(),
      status: 'confirmed',
    };

    changeQueue.add(change);

    // Build task object for status updates
    const task = {
      id: taskId,
      feedback,
      element: {
        tag: element.tag,
        classes: element.classes || [],
        selector: element.selector,
        id: element.id
      },
      projectPath,
      pageUrl,
      model,
      status: 'queued',
      startedAt: new Date().toISOString(),
      completedAt: null,
      log: 'Task queued. Use get_visual_feedback MCP tool to retrieve.',
      exitCode: null,
      commitHash: null,
      commitUrl: null
    };

    // Send task_update so extension toast updates (matches standalone server)
    console.error('Sending task_update with status:', task.status, 'for task:', task.id);
    console.error('Full task object:', JSON.stringify(task, null, 2));
    const taskUpdateMsg = JSON.stringify({ type: 'task_update', task });
    console.error('Sending message:', taskUpdateMsg.substring(0, 200) + '...');
    ws.send(taskUpdateMsg);

    // Also send success response
    ws.send(JSON.stringify({
      success: true,
      taskId,
    }));

    // Auto-submit to the running Claude Code terminal (macOS only)
    setTimeout(() => {
      autoSubmitToTerminal(
        feedback,
        element.selector,
        element.classes || [],
        element.tag || 'div'
      );
    }, 500);
  } else if (message.type === 'get_tasks') {
    // Return queued tasks
    const changes = changeQueue.getPending(true);
    ws.send(JSON.stringify({ type: 'tasks', tasks: changes }));
  }
}

// Factory function to create MCP server with all tool handlers
function createMcpServer(): Server {
  const mcpServer = new Server(
    {
      name: 'visual-feedback-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tools
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_visual_feedback',
          description: `Get pending visual feedback from the browser extension.
Returns a list of visual changes made by the user including:
- Element information (selector, tag, classes, computed styles)
- User's text feedback describing what they want changed
- Visual adjustments they made (resize, spacing, colors)
- Element screenshot
- Detected CSS framework (Tailwind, CSS Modules, etc.)

Call this tool when you want to see what visual changes the user has requested.`,
          inputSchema: {
            type: 'object',
            properties: {
              includeApplied: {
                type: 'boolean',
                description: 'Include already applied changes in the response',
                default: false,
              },
            },
          },
        },
        {
          name: 'mark_change_applied',
          description: `Mark a visual change as successfully applied.
Call this after you have made the code changes to implement the user's visual feedback.`,
          inputSchema: {
            type: 'object',
            properties: {
              changeId: {
                type: 'string',
                description: 'The ID of the change to mark as applied',
              },
            },
            required: ['changeId'],
          },
        },
        {
          name: 'mark_change_failed',
          description: `Mark a visual change as failed to apply.
Call this if you were unable to implement the user's visual feedback.`,
          inputSchema: {
            type: 'object',
            properties: {
              changeId: {
                type: 'string',
                description: 'The ID of the change to mark as failed',
              },
              reason: {
                type: 'string',
                description: 'Reason for the failure',
              },
            },
            required: ['changeId'],
          },
        },
        {
          name: 'get_change_details',
          description: `Get detailed information about a specific visual change.`,
          inputSchema: {
            type: 'object',
            properties: {
              changeId: {
                type: 'string',
                description: 'The ID of the change to get details for',
              },
            },
            required: ['changeId'],
          },
        },
        {
          name: 'clear_all_tasks',
          description: `Clear all visual feedback tasks from the queue.
Use this to reset the queue when you want to start fresh.`,
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // Handle tool calls
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_visual_feedback': {
        const includeApplied = (args as { includeApplied?: boolean })?.includeApplied ?? false;
        const changes = changeQueue.getPending(includeApplied);

        if (changes.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No pending visual feedback. The user has not made any visual changes in the extension yet.',
              },
            ],
          };
        }

        // Format each change using the prompt template (if available)
        const formattedChanges = changes.map((change) => formatChangeWithTemplate(change, promptTemplate));

        return {
          content: [
            {
              type: 'text',
              text: `Found ${changes.length} pending visual change(s):\n\n${formattedChanges.join('\n\n---\n\n')}`,
            },
          ],
        };
      }

      case 'mark_change_applied': {
        const { changeId } = args as { changeId: string };
        const success = changeQueue.markApplied(changeId);

        if (success) {
          // Notify extension
          try {
            if (connectedClient?.readyState === WebSocket.OPEN) {
              connectedClient.send(JSON.stringify({
                type: 'CHANGE_APPLIED',
                changeId,
              }));
            }
          } catch (e) {
            console.error('Failed to notify extension:', e);
          }

          return {
            content: [
              {
                type: 'text',
                text: `Change ${changeId} marked as applied.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Change ${changeId} not found.`,
            },
          ],
        };
      }

      case 'mark_change_failed': {
        const { changeId, reason } = args as { changeId: string; reason?: string };
        const success = changeQueue.markFailed(changeId, reason);

        // Notify extension for auto-retry
        try {
          if (connectedClient?.readyState === WebSocket.OPEN) {
            connectedClient.send(JSON.stringify({
              type: 'CHANGE_FAILED',
              changeId,
              reason,
            }));
          }
        } catch (e) {
          console.error('Failed to notify extension:', e);
        }

        return {
          content: [
            {
              type: 'text',
              text: success
                ? `Change ${changeId} marked as failed. The extension may auto-retry.`
                : `Change ${changeId} not found.`,
            },
          ],
        };
      }

      case 'get_change_details': {
        const { changeId } = args as { changeId: string };
        const change = changeQueue.get(changeId);

        if (!change) {
          return {
            content: [
              {
                type: 'text',
                text: `Change ${changeId} not found.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Change details:\n\n${JSON.stringify(change, null, 2)}`,
            },
          ],
        };
      }

      case 'clear_all_tasks': {
        const counts = changeQueue.getStatusCounts();
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        changeQueue.clear();

        return {
          content: [
            {
              type: 'text',
              text: `Cleared ${total} task(s) from the queue.`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  });

  return mcpServer;
}

// Start the MCP server with stdio transport (for Claude Code subprocess mode)
async function main() {
  // Check if we should skip stdio (when running standalone for SSE only)
  if (process.env.SSE_ONLY === 'true') {
    console.error('Running in SSE-only mode (stdio disabled)');
    console.error('Connect via: http://localhost:3848/sse');
    return;
  }

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
