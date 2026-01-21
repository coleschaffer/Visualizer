# Visual Feedback Tool

![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)

A Chrome extension that lets you click any element on any website, describe what you want changed, and Claude Code makes it happen automatically.

## Overview

Visual Feedback Tool bridges visual design iteration and code implementation. Click an element, type what you want changed in natural language, and Claude Code automatically finds the source file, makes the change, commits, and pushes to GitHub. No more hunting through CSS files to find where a button is styled.

The extension captures element metadata (selector, computed styles, screenshot) and sends it to a local server that spawns Claude Code with rich context about what to modify.

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
- Claude Code CLI installed (`~/.local/bin/claude`)
- Git configured with GitHub access

### Installation

```bash
# Clone the repository
git clone https://github.com/coleschaffer/Visualizer.git
cd visual-feedback-tool

# Install server dependencies
cd server && npm install && cd ..

# Install and build extension
cd extension && npm install && npm run build && cd ..
```

### Running

```bash
# Start the server
cd server && node server.js

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select extension/dist folder
```

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
│   └── server.js              # WebSocket server
└── mcp-server/                # MCP integration
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl` (macOS) / `Alt+Shift+V` (Windows) | Toggle enable/disable |
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

### Data Storage
- `.beads/elements/` - Element memory (in project directory)
- `~/.visual-feedback-server/tasks.json` - Task history
- `/tmp/visual-feedback-screenshots/` - Screenshots

## Architecture

```
Chrome Extension
      ↓ WebSocket (port 3847)
Local Server
      ↓ CLI spawn
Claude Code
      ↓ LSP + Git
Source Files → Commit → Push
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
