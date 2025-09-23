#!/usr/bin/env node

// Simple wrapper script to start MediaWiki MCP server for Wings of Fire wiki
const { spawn } = require('child_process');
const path = require('path');

// Path to the locally installed MediaWiki MCP server
const mcpServerPath = path.join(__dirname, 'node_modules', '@professional-wiki', 'mediawiki-mcp-server', 'dist', 'index.js');

// Start the MCP server
const child = spawn('node', [mcpServerPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Configuration for Wings of Fire Fandom wiki
    MEDIAWIKI_API_URL: 'https://wingsoffire.fandom.com/api.php',
    MEDIAWIKI_BASE_URL: 'https://wingsoffire.fandom.com/wiki/',
  }
});

child.on('error', (error) => {
  console.error('Wings of Fire MCP server error:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Wings of Fire MCP server exited with code: ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});