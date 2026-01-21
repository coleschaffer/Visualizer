#!/usr/bin/env node

// Entry point for MCP server
// Requires build first: npm run build

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distIndex = join(__dirname, 'dist', 'index.js');

if (!existsSync(distIndex)) {
  console.error('Error: MCP server not built yet.');
  console.error('Run: npm run build');
  process.exit(1);
}

await import(distIndex);
