#!/bin/bash
set -e

# Visual Feedback Tool Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/coleschaffer/visual-feedback-tool/main/install.sh | bash

INSTALL_DIR="$HOME/.visual-feedback-tool"
CLAUDE_CONFIG="$HOME/.claude.json"

echo "🔧 Installing Visual Feedback Tool..."

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
  echo "📦 Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull
else
  echo "📦 Cloning repository..."
  git clone https://github.com/coleschaffer/visual-feedback-tool.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Build MCP server
echo "🔨 Building MCP server..."
cd "$INSTALL_DIR/mcp-server"
npm install --silent
npm run build --silent

# Build extension
echo "🔨 Building Chrome extension..."
cd "$INSTALL_DIR/extension"
npm install --silent
npm run build --silent

# Generate icons
echo "🎨 Generating icons..."
cd "$INSTALL_DIR/extension/dist/icons"
magick -size 16x16 xc:'#3b82f6' icon16.png 2>/dev/null || true
magick -size 32x32 xc:'#3b82f6' icon32.png 2>/dev/null || true
magick -size 48x48 xc:'#3b82f6' icon48.png 2>/dev/null || true
magick -size 128x128 xc:'#3b82f6' icon128.png 2>/dev/null || true
magick -size 16x16 xc:'#22c55e' icon-active16.png 2>/dev/null || true
magick -size 32x32 xc:'#22c55e' icon-active32.png 2>/dev/null || true
magick -size 48x48 xc:'#22c55e' icon-active48.png 2>/dev/null || true
magick -size 128x128 xc:'#22c55e' icon-active128.png 2>/dev/null || true

# Add to Claude config
echo "⚙️  Configuring Claude Code..."
MCP_PATH="$INSTALL_DIR/mcp-server/dist/index.js"

if [ -f "$CLAUDE_CONFIG" ]; then
  # Check if visual-feedback already exists
  if grep -q "visual-feedback" "$CLAUDE_CONFIG"; then
    echo "   MCP server already configured in ~/.claude.json"
  else
    # Add to existing config using node
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
      config.mcpServers = config.mcpServers || {};
      config.mcpServers['visual-feedback'] = {
        command: 'node',
        args: ['$MCP_PATH']
      };
      fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
    "
    echo "   Added MCP server to ~/.claude.json"
  fi
else
  # Create new config
  cat > "$CLAUDE_CONFIG" << EOF
{
  "mcpServers": {
    "visual-feedback": {
      "command": "node",
      "args": ["$MCP_PATH"]
    }
  }
}
EOF
  echo "   Created ~/.claude.json with MCP server"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Load the Chrome extension from: $INSTALL_DIR/extension/dist"
echo "  2. Restart Claude Code to load the MCP server"
echo "  3. Copy the token from the terminal and paste in the extension"
echo ""
