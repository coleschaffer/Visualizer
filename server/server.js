#!/usr/bin/env node

const { WebSocketServer } = require('ws');
const { createServer } = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WS_PORT = 3847;
const HTTP_PORT = 3848;
const isWindows = os.platform() === 'win32';
const CLAUDE_PATH = isWindows
  ? path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd')
  : path.join(os.homedir(), '.local', 'bin', 'claude');
const SCREENSHOT_DIR = path.join(os.tmpdir(), 'visual-feedback-screenshots');
const TASKS_FILE = path.join(os.homedir(), '.visual-feedback-server', 'tasks.json');
const PROMPT_TEMPLATE_PATH = path.join(__dirname, 'prompt-template.md');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Ensure tasks directory exists
const TASKS_DIR = path.dirname(TASKS_FILE);
if (!fs.existsSync(TASKS_DIR)) {
  console.log(`Creating tasks directory: ${TASKS_DIR}`);
  fs.mkdirSync(TASKS_DIR, { recursive: true });
}

// Beads-style element memory system
// Stores context about previous changes to elements for continuity

function getBeadsDir(projectPath) {
  return path.join(projectPath, '.beads', 'elements');
}

function ensureBeadsDir(projectPath) {
  const beadsDir = getBeadsDir(projectPath);
  if (!fs.existsSync(beadsDir)) {
    fs.mkdirSync(beadsDir, { recursive: true });
  }
  return beadsDir;
}

// Generate a stable ID for an element based on its properties
function generateElementId(element) {
  const key = [
    element.tag,
    element.id || '',
    (element.classes || []).sort().join('.'),
    element.selector || ''
  ].join('|');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'el-' + Math.abs(hash).toString(16).slice(0, 8);
}

// Load bead history for an element
function loadElementBead(projectPath, element) {
  const beadsDir = getBeadsDir(projectPath);
  const elementId = generateElementId(element);
  const beadFile = path.join(beadsDir, `${elementId}.json`);

  if (fs.existsSync(beadFile)) {
    try {
      return JSON.parse(fs.readFileSync(beadFile, 'utf8'));
    } catch (err) {
      console.error('Failed to load bead:', err.message);
    }
  }
  return null;
}

// Save bead after a change
function saveElementBead(projectPath, element, feedback, taskId, success) {
  const beadsDir = ensureBeadsDir(projectPath);
  const elementId = generateElementId(element);
  const beadFile = path.join(beadsDir, `${elementId}.json`);

  let bead = loadElementBead(projectPath, element) || {
    id: elementId,
    element: {
      tag: element.tag,
      id: element.id,
      classes: element.classes,
      selector: element.selector
    },
    changes: []
  };

  // Add new change to history (keep last 10)
  bead.changes.push({
    taskId,
    feedback,
    timestamp: new Date().toISOString(),
    success
  });
  if (bead.changes.length > 10) {
    bead.changes = bead.changes.slice(-10);
  }

  try {
    fs.writeFileSync(beadFile, JSON.stringify(bead, null, 2));
  } catch (err) {
    console.error('Failed to save bead:', err.message);
  }
}

// Format bead history for prompt context
function formatBeadContext(bead) {
  if (!bead || !bead.changes || bead.changes.length === 0) {
    return null;
  }

  const lines = [
    `## Previous Changes to This Element`,
    `This element has been modified ${bead.changes.length} time(s) before. Recent history:`
  ];

  // Show last 3 changes
  const recentChanges = bead.changes.slice(-3);
  for (const change of recentChanges) {
    const date = new Date(change.timestamp).toLocaleDateString();
    const status = change.success ? '✓' : '✗';
    lines.push(`- [${date}] ${status} "${change.feedback}"`);
  }

  lines.push('', 'Consider this context when making your changes.');
  return lines.join('\n');
}

console.log('Starting Visual Feedback Server...');

// Load and validate prompt template at startup
let promptTemplateSource = 'built-in fallback';
if (fs.existsSync(PROMPT_TEMPLATE_PATH)) {
  promptTemplateSource = PROMPT_TEMPLATE_PATH;
  const template = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf8');
  const lineCount = template.split('\n').length;
  console.log(`Prompt template: ${PROMPT_TEMPLATE_PATH} (${lineCount} lines)`);
  console.log('--- Template ---');
  console.log(template);
  console.log('--- End Template ---\n');
} else {
  console.log('Prompt template: using built-in fallback (no prompt-template.txt found)');
}

// Task storage with file persistence
const tasks = new Map();
const MAX_TASKS = 50;

// Load tasks from file on startup
function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
      for (const task of data) {
        tasks.set(task.id, task);
      }
      console.log(`Loaded ${tasks.size} tasks from disk`);
    }
  } catch (err) {
    console.error('Failed to load tasks:', err.message);
  }
}

// Save tasks to file
function saveTasks() {
  try {
    const data = Array.from(tasks.values());
    fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save tasks:', err.message);
  }
}

// Load existing tasks
loadTasks();

function addTask(task) {
  tasks.set(task.id, task);
  if (tasks.size > MAX_TASKS) {
    const oldest = Array.from(tasks.keys())[0];
    tasks.delete(oldest);
  }
  saveTasks();
}

// Broadcast task updates to all connected clients
function broadcastTaskUpdate(task) {
  const message = JSON.stringify({ type: 'task_update', task });
  const clientCount = wss.clients.size;
  let sentCount = 0;
  console.log(`[Broadcast] Sending task_update for ${task.id} (status: ${task.status}) to ${clientCount} clients`);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
      sentCount++;
      console.log(`[Broadcast] Sent to client (${sentCount}/${clientCount})`);
    } else {
      console.log(`[Broadcast] Skipped client with readyState ${client.readyState}`);
    }
  });
  console.log(`[Broadcast] Complete: ${sentCount}/${clientCount} clients received message`);
}

// Load prompt template from file
function loadPromptTemplate() {
  try {
    if (fs.existsSync(PROMPT_TEMPLATE_PATH)) {
      return fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf8');
    }
  } catch (err) {
    console.error('Failed to load prompt template:', err.message);
  }
  // Fallback template if file doesn't exist
  return `# Visual Feedback Request

## User Feedback
"{{FEEDBACK}}"

## Target Element
- **Tag:** <{{ELEMENT_TAG}}>
- **Selector:** {{SELECTOR}}
{{ELEMENT_ID}}
{{ELEMENT_CLASSES}}
{{DOM_PATH}}

{{COMPUTED_STYLES}}

{{PAGE_URL}}

{{BEAD_CONTEXT}}

## Instructions
1. Find the source file containing this element
2. Make the requested change`;
}

// Build rich prompt with all context using template
function buildPrompt(feedback, element, pageUrl, beadContext, taskId) {
  let template = loadPromptTemplate();

  // Build optional sections
  let elementId = '';
  if (element.id) {
    elementId = `- **ID:** #${element.id}`;
  }

  let elementClasses = '';
  if (element.classes && element.classes.length > 0) {
    elementClasses = `- **Classes:** .${element.classes.join(', .')}`;
  }

  let domPath = '';
  if (element.path && element.path.length > 0) {
    const pathStr = element.path.map(p => p.selector || p.tag).join(' > ');
    domPath = `- **DOM Path:** ${pathStr}`;
  }

  let computedStyles = '';
  if (element.computedStyles) {
    const styles = element.computedStyles;
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

  let pageUrlSection = '';
  if (pageUrl) {
    pageUrlSection = `## Page URL\n${pageUrl}`;
  }

  // Replace placeholders
  template = template
    .replace(/\{\{TASK_ID\}\}/g, taskId || 'unknown')
    .replace(/\{\{FEEDBACK\}\}/g, feedback)
    .replace(/\{\{ELEMENT_TAG\}\}/g, element.tag)
    .replace(/\{\{SELECTOR\}\}/g, element.selector || 'N/A')
    .replace(/\{\{ELEMENT_ID\}\}/g, elementId)
    .replace(/\{\{ELEMENT_CLASSES\}\}/g, elementClasses)
    .replace(/\{\{DOM_PATH\}\}/g, domPath)
    .replace(/\{\{COMPUTED_STYLES\}\}/g, computedStyles)
    .replace(/\{\{PAGE_URL\}\}/g, pageUrlSection)
    .replace(/\{\{BEAD_CONTEXT\}\}/g, beadContext || '');

  // Clean up empty lines from unused placeholders
  template = template.replace(/\n{3,}/g, '\n\n');

  return template.trim();
}

// Save screenshot and return path
function saveScreenshot(base64Data, taskId) {
  if (!base64Data) return null;

  try {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const filePath = path.join(SCREENSHOT_DIR, `${taskId}.png`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (err) {
    console.error('Failed to save screenshot:', err.message);
    return null;
  }
}

// Simple HTTP server for status and task history
const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running', wsPort: WS_PORT, requiresToken: false }));
  } else if (req.url === '/tasks') {
    const taskList = Array.from(tasks.values()).reverse();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(taskList));
  } else if (req.url.startsWith('/tasks/') && req.url.endsWith('/log')) {
    const id = req.url.replace('/tasks/', '').replace('/log', '');
    const task = tasks.get(id);
    if (task) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ log: task.log || '' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Task not found' }));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server
const wss = new WebSocketServer({ port: WS_PORT });

// Start both servers and print Ready when both are listening
let httpReady = false;
let wsReady = false;

function checkReady() {
  if (httpReady && wsReady) {
    console.log('Ready!\n');
  }
}

httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server on port ${HTTP_PORT}`);
  httpReady = true;
  checkReady();
});

wss.on('listening', () => {
  console.log(`WebSocket server on port ${WS_PORT}`);
  wsReady = true;
  checkReady();
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('Received:', msg.type);

      // Handle keep-alive pings silently
      if (msg.type === 'ping') {
        return;
      }

      if (msg.type === 'visual_feedback') {
        const { id, feedback, element, projectPath, pageUrl, model } = msg.payload;
        const taskId = id || Date.now().toString();
        const selectedModel = model || 'claude-opus-4-5-20251101';

        console.log(`\nFeedback: "${feedback}"`);
        console.log(`Project: ${projectPath}`);
        console.log(`Model: ${selectedModel}`);
        console.log(`Element: <${element.tag}> ${element.selector || ''}`);
        if (pageUrl) console.log(`Page: ${pageUrl}`);

        // Create task record
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
          model: selectedModel,
          status: 'processing',
          startedAt: new Date().toISOString(),
          completedAt: null,
          log: '',
          exitCode: null,
          commitHash: null,
          commitUrl: null
        };
        addTask(task);

        // Send 'queued' status immediately to dismiss working toast
        broadcastTaskUpdate({ ...task, status: 'queued' });

        // Load bead context for this element (previous changes)
        const bead = loadElementBead(projectPath, element);
        const beadContext = formatBeadContext(bead);
        if (beadContext) {
          console.log('Found previous changes to this element');
        }

        // Build rich prompt
        const prompt = buildPrompt(feedback, element, pageUrl, beadContext, taskId);

        console.log('\n--- Prompt ---');
        console.log(prompt);
        console.log('--- End Prompt ---\n');

        console.log(`Spawning Claude (${selectedModel})...`);

        // Build args (note: Claude CLI doesn't support --image flag yet)
        const args = [
          '--model', selectedModel,
          '-p', prompt,
          '--dangerously-skip-permissions'
        ];

        const spawnEnv = isWindows
          ? {
              ...process.env,
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
            }
          : {
              HOME: os.homedir(),
              PATH: '/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:' + os.homedir() + '/.local/bin',
              USER: process.env.USER,
              TERM: 'xterm-256color',
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
            };

        const child = spawn(CLAUDE_PATH, args, {
          cwd: projectPath,
          env: spawnEnv,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: isWindows
        });

        child.stdout.on('data', (d) => {
          const text = d.toString();
          process.stdout.write(text);
          task.log += text;
        });

        child.stderr.on('data', (d) => {
          const text = d.toString();
          process.stderr.write(text);
          task.log += text;
        });

        child.on('error', (err) => {
          console.log('\nSpawn error:', err.message);
          task.status = 'failed';
          task.completedAt = new Date().toISOString();
          task.log += `\nError: ${err.message}`;
          saveTasks();
          broadcastTaskUpdate(task);
          ws.send(JSON.stringify({ success: false, error: err.message, taskId: task.id }));
        });

        child.on('close', (code) => {
          console.log(`\nClaude exited with code ${code}`);
          task.status = code === 0 ? 'complete' : 'failed';
          task.completedAt = new Date().toISOString();
          task.exitCode = code;

          // Try to extract commit hash and GitHub URL from log
          // Look for our explicit format first, then fall back to common git output patterns
          const commitMatch = task.log.match(/COMMIT_HASH:\s*([a-f0-9]{40})/i) ||
                              task.log.match(/\[([a-f0-9]{7,40})\]/i) ||
                              task.log.match(/commit\s+([a-f0-9]{7,40})/i);
          if (commitMatch) {
            task.commitHash = commitMatch[1];
            // Try to get GitHub remote URL
            const remoteMatch = task.log.match(/github\.com[:/]([^/]+\/[^/\s.]+)/i);
            if (remoteMatch) {
              const repo = remoteMatch[1].replace(/\.git$/, '');
              task.commitUrl = `https://github.com/${repo}/commit/${task.commitHash}`;
            }
          }

          // Save bead for element context tracking
          saveElementBead(projectPath, element, feedback, taskId, code === 0);

          saveTasks();
          broadcastTaskUpdate(task);
          ws.send(JSON.stringify({ success: code === 0, taskId: task.id }));
        });

        console.log('Claude process started, PID:', child.pid);
        ws.send(JSON.stringify({ type: 'task_started', taskId: task.id }));

      } else if (msg.type === 'get_tasks') {
        const taskList = Array.from(tasks.values()).reverse();
        ws.send(JSON.stringify({ type: 'tasks', tasks: taskList }));
      }
    } catch (err) {
      console.log('Error:', err.message);
      ws.send(JSON.stringify({ success: false, error: err.message }));
    }
  });

  ws.on('close', () => console.log('Client disconnected'));
  ws.send(JSON.stringify({ type: 'ready' }));
});
