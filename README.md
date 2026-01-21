# Visual Feedback Tool

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

A Chrome extension that lets you click any element on any website, describe what you want changed, and Claude Code makes it happen automatically.

## Overview

Visual Feedback Tool bridges visual design iteration and code implementation. Click an element, type what you want changed in natural language, and Claude Code automatically finds the source file, makes the change, commits, and pushes to GitHub. No more hunting through CSS files to find where a button is styled.

The extension captures element metadata (selector, computed styles, screenshot) and sends it to a local server with rich context about what to modify.

## Server Modes

The tool supports two server modes to fit different workflows:

### Standalone Server (`server/`)
Spawns a new Claude CLI process for each change request. Best for:
- Automated workflows where each change should be independent
- Users who want Claude to commit & push automatically
- Simple "set and forget" usage

### MCP Server (`mcp-server/`)
Integrates with an already-running Claude CLI session via Model Context Protocol. Best for:
- Users who already have Claude CLI running on their project
- Workflows where you want to review changes before committing
- Batching multiple visual changes into a single Claude session

Both servers run on the same ports, so only use one at a time.

## Features

### Core Workflow
- **Click to Select** - Click any element on any website
- **Natural Language Feedback** - "make this button blue", "increase padding"
- **Automatic Execution** - Claude finds file, makes change, commits & pushes

### Smart Selection
- **Deep Element Detection** - SVGs, nested elements, disabled buttons
- **Keyboard Navigation** - Arrow keys for parent/child traversal
- **Spacebar Selection** - Hover + Space for hard-to-click elements
- **@ Element Reference** - Type `@` to reference another element for comparison

### Element Memory (Beads)
- Tracks changes per element across sessions
- Claude sees history: "Previous: Made button blue, Added hover effect"
- Enables continuity for iterative design work

### Model Selection
- **Opus 4.5** - Most capable for complex changes
- **Sonnet 4.5** - Faster, cheaper for simple tweaks

## Tech Stack

| Category | Technology |
|----------|------------|
| Extension | TypeScript, React 18, Zustand |
| Build | Vite |
| Styling | Tailwind CSS |
| Server | Node.js, WebSocket (ws) |
| AI | Claude Code CLI |
| Protocol | Model Context Protocol (MCP) |

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome browser
- Claude Code CLI installed
  - macOS/Linux: `~/.local/bin/claude`
  - Windows: `%APPDATA%\npm\claude.cmd`
- Git configured with GitHub access

### Platform Support
- **macOS** - Full support including terminal auto-submit
- **Windows** - Full support (use WSL for building the extension)
- **Linux** - Full support

### Installation

```bash
# Clone the repository
git clone https://github.com/coleschaffer/Visualizer.git
cd Visualizer

# Install and build extension (use WSL on Windows)
cd extension && npm install && npm run build && cd ..

# Install standalone server dependencies
cd server && npm install && cd ..

# Install and build MCP server (optional, if using MCP mode)
cd mcp-server && npm install && npm run build && cd ..
```

### Running

**Option A: Standalone Server** (spawns Claude for each change)
```bash
cd server
node server.js
```

**Option B: MCP Server** (use with existing Claude CLI session)
```bash
# Start the MCP server
cd mcp-server
node server.js

# In your project directory, start Claude with MCP config:
claude --mcp-config path/to/mcp-config.json
```

**Load extension in Chrome:**
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked"
4. Select `extension/dist` folder

### Usage

1. Click extension icon in Chrome toolbar
2. Click **Connect** to connect to server
3. Set your **Project folder** path
4. Toggle **Enable on current page**
5. Click elements and describe changes
6. Watch Claude Code commit & push!

## Project Structure

```
visual-feedback-tool/
├── extension/
│   ├── src/
│   │   ├── background/        # Service worker
│   │   ├── content/           # DOM overlay & selection
│   │   │   ├── App.tsx
│   │   │   ├── selection/     # Element tracking
│   │   │   ├── overlay/       # Highlight & panel
│   │   │   └── controls/      # Resize, color picker
│   │   ├── popup/             # Extension popup UI
│   │   └── shared/            # Types & state
│   └── dist/                  # Built extension
├── server/
│   ├── server.js              # Standalone server (spawns Claude)
│   └── prompt-template.md     # Prompt template for standalone mode
└── mcp-server/
    ├── prompt-template.md     # Prompt template for MCP mode
    ├── hooks/
    │   ├── check-visual-feedback.ps1  # Windows hook script
    │   └── check-visual-feedback.sh   # macOS/Linux hook script
    └── src/
        ├── index.ts           # MCP server (tools for Claude)
        └── store/
            └── changeQueue.ts # Persisted change queue
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl` (macOS) / `Ctrl+Alt` (Windows) | Toggle enable/disable |
| `Click` | Select element |
| `Space` | Select hovered element |
| `↑` / `↓` | Navigate parent/child |
| `←` / `→` | Navigate siblings |
| `@` | Enter reference mode |
| `Esc` | Deselect / Close |
| `Enter` | Submit feedback |
| `Alt+Enter` (Windows) / `Option+Enter` (macOS) | New line |

## Configuration

### Server Ports
- WebSocket: `3847` (extension ↔ server)
- HTTP: `3848` (status & task history)

### Model Selection
- **Opus 4.5**: `claude-opus-4-5-20251101`
- **Sonnet 4.5**: `claude-sonnet-4-5-20241022`

### Prompt Templates
Each server has its own customizable prompt template:
- **Standalone**: `server/prompt-template.md` - Prompt sent *to* Claude when spawning
- **MCP**: `mcp-server/prompt-template.md` - Format returned *from* `get_visual_feedback` tool

Available placeholders:
| Placeholder | Description |
|-------------|-------------|
| `{{FEEDBACK}}` | User's feedback text |
| `{{ELEMENT_TAG}}` | HTML tag (e.g., `div`, `button`) |
| `{{SELECTOR}}` | CSS selector path |
| `{{ELEMENT_ID}}` | Element ID if present |
| `{{ELEMENT_CLASSES}}` | Element classes |
| `{{DOM_PATH}}` | Full DOM path breadcrumb |
| `{{COMPUTED_STYLES}}` | Current CSS styles |
| `{{PAGE_URL}}` | URL of the page |
| `{{BEAD_CONTEXT}}` | Previous changes to this element |
| `{{TASK_ID}}` | Unique task identifier for status tracking |

### Data Storage
- `.beads/elements/` - Element memory (in project directory)
- `~/.visual-feedback-server/tasks.json` - Task history (standalone server)
- `~/.visual-feedback/change-queue.json` - Change queue (MCP server)
- `~/.visual-feedback/servers.json` - MCP server registry
- `$TMPDIR/visual-feedback-screenshots/` - Screenshots

## Architecture

**Standalone Server Mode:**
```
Chrome Extension
      ↓ WebSocket (port 3847)
Standalone Server (server.js)
      ↓ spawns new process
Claude Code CLI
      ↓ LSP + Git
Source Files → Commit → Push
```

**MCP Server Mode:**
```
Chrome Extension
      ↓ WebSocket (port 3847)
MCP Server (index.ts)
      ↓ queues change
~/.visual-feedback/change-queue.json
      ↓ MCP tool call
Your Running Claude CLI Session
      ↓ LSP + Git
Source Files → (you control commit/push)
```

## Claude Code MCP Integration

The MCP server integrates directly with Claude Code, allowing visual feedback to flow automatically into your Claude session.

### Transport Modes

The MCP server supports two transport modes: **stdio** and **SSE**.

#### stdio Transport (Default)

Claude Code spawns the MCP server as a child process and communicates via stdin/stdout.

- **Per-session process** - Each Claude Code session starts its own MCP server instance
- **Automatic lifecycle** - The MCP server starts when Claude Code launches and stops when it exits
- **Best for production** - No manual server management required

```
┌─────────────────────────────────────────────────────────────┐
│ Claude Code Session                                         │
│   ├── spawns MCP server (stdio)                            │
│   │     ├── WebSocket server (port 3847) ←── Extension     │
│   │     ├── HTTP server (port 3848) ←── Hooks              │
│   │     └── Change queue (file-based)                      │
│   └── calls MCP tools (get_visual_feedback, etc.)          │
└─────────────────────────────────────────────────────────────┘
```

#### SSE Transport (Development)

For development workflows, you can run the MCP server independently and connect via Server-Sent Events (SSE). This allows you to restart the server without restarting Claude Code.

- **Independent process** - Run the server manually, restart as needed
- **Hot reload friendly** - Rebuild and restart without losing Claude context
- **Best for development** - Iterate on MCP server changes quickly

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Server (running independently)                          │
│   ├── WebSocket server (port 3847) ←── Extension           │
│   ├── HTTP server (port 3848) ←── Hooks                    │
│   ├── SSE endpoint (/sse) ←── Claude Code                  │
│   └── Change queue (file-based)                            │
└─────────────────────────────────────────────────────────────┘
│
│ SSE connection
▼
┌─────────────────────────────────────────────────────────────┐
│ Claude Code Session                                         │
│   └── calls MCP tools via SSE transport                    │
└─────────────────────────────────────────────────────────────┘
```

To use SSE mode, start the server with `SSE_ONLY=1`:

```bash
cd mcp-server
SSE_ONLY=1 node dist/index.js
```

This setup uses:

1. **MCP Server** - Exposes tools for retrieving and managing visual feedback
2. **HTTP Endpoint** - Allows hooks to check for pending tasks without MCP
3. **UserPromptSubmit Hook** - Notifies Claude when new feedback arrives

### MCP Tools Available

| Tool | Description |
|------|-------------|
| `get_visual_feedback` | Retrieve pending visual changes with full element details and screenshots |
| `mark_change_applied` | Mark a change as successfully implemented |
| `mark_change_failed` | Mark a change as failed (triggers retry in extension) |
| `get_change_details` | Get detailed info about a specific change by ID |
| `clear_all_tasks` | Clear all pending tasks from the queue |

### Setup

#### 1. Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

#### 2. Configure Claude Code

Add the MCP server, hook, and permissions to your project's Claude settings. Create or edit `.claude/settings.local.json` in your project directory.

**Option A: stdio Transport (Production)**

Claude Code spawns and manages the MCP server:

```json
{
  "permissions": {
    "allow": [
      "mcp__visual-feedback__get_visual_feedback",
      "mcp__visual-feedback__mark_change_applied",
      "mcp__visual-feedback__mark_change_failed",
      "mcp__visual-feedback__clear_all_tasks"
    ]
  },
  "mcpServers": {
    "visual-feedback": {
      "command": "node",
      "args": ["/path/to/Visualizer/mcp-server/dist/index.js"]
    }
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File \"/path/to/Visualizer/mcp-server/hooks/check-visual-feedback.ps1\""
          }
        ]
      }
    ]
  }
}
```

**Option B: SSE Transport (Development)**

Connect to an independently running MCP server:

```json
{
  "permissions": {
    "allow": [
      "mcp__visual-feedback__get_visual_feedback",
      "mcp__visual-feedback__mark_change_applied",
      "mcp__visual-feedback__mark_change_failed",
      "mcp__visual-feedback__clear_all_tasks"
    ]
  },
  "mcpServers": {
    "visual-feedback": {
      "type": "sse",
      "url": "http://localhost:3848/sse"
    }
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -ExecutionPolicy Bypass -File \"/path/to/Visualizer/mcp-server/hooks/check-visual-feedback.ps1\""
          }
        ]
      }
    ]
  }
}
```

For SSE mode, start the server manually before launching Claude:

```bash
cd mcp-server
SSE_ONLY=1 node dist/index.js
```

Or add to Claude via CLI:

```bash
claude mcp add --transport sse visual-feedback http://localhost:3848/sse
```

**For macOS/Linux**, use the bash version of the hook:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash /path/to/Visualizer/mcp-server/hooks/check-visual-feedback.sh"
          }
        ]
      }
    ]
  }
}
```

#### 3. Restart Claude Code

After updating the settings, restart Claude Code to load the MCP server and hook.

> **Note:** Since the MCP server binds to ports 3847 (WebSocket) and 3848 (HTTP), only one Claude Code session can run the MCP server at a time. If you have multiple projects, configure the MCP server in only one project's settings, or ensure only one session is active.

### Workflow

1. **Submit Feedback** - Use the browser extension to click an element and describe the change
2. **Automatic Detection** - When you send any message to Claude, the hook checks for pending feedback
3. **Claude Retrieves Details** - If feedback exists, Claude sees a notification and calls `get_visual_feedback`
4. **Implementation** - Claude adds tasks to its todo list, implements changes, and marks them complete
5. **Status Updates** - The extension receives status updates as changes are applied

### Hook Output

When pending feedback exists, Claude sees:

```xml
<visual-feedback-pending count="2">
IMPORTANT: 2 visual feedback task(s) queued from the browser extension.
These have been explicitly submitted by the user - process them automatically.
1. Call get_visual_feedback to retrieve the changes
2. Add each change to your todo list
3. Implement each change
4. Call mark_change_applied (or mark_change_failed) with the task ID for each
5. After completing all tasks, call get_visual_feedback again to check for new tasks
Continue this loop until the queue is empty (no more pending changes).
</visual-feedback-pending>
```

### HTTP API

The MCP server exposes an HTTP API on port 3848:

| Endpoint | Description |
|----------|-------------|
| `GET /status` | Server status and WebSocket port |
| `GET /servers` | List of registered MCP server instances |
| `GET /tasks` | Pending visual feedback tasks (used by hooks) |

Example:
```bash
curl http://localhost:3848/tasks
```

Response:
```json
{
  "count": 1,
  "tasks": [
    {
      "id": "1737012345678",
      "feedback": "make this button larger",
      "element": {
        "tag": "button",
        "selector": ".submit-btn",
        "classes": ["submit-btn", "primary"]
      },
      "timestamp": "2025-01-16T10:25:45.678Z",
      "status": "confirmed"
    }
  ]
}
```

## Run Server on Startup (macOS)

Create a Launch Agent:

```bash
cat > ~/Library/LaunchAgents/com.visualfeedback.server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.visualfeedback.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/server/server.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.visualfeedback.server.plist
```

## Troubleshooting

### Extension won't connect
```bash
curl http://localhost:3848/status
```

### Can't select certain elements
- Try hover + Space
- Use arrow keys to navigate
- Check if element is in iframe (not yet supported)

### Changes not in GitHub
- Verify git remote is configured
- Check Claude's output in History tab

## License

MIT License
