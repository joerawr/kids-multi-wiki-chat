#!/usr/bin/env node

// Simple wrapper script to start MediaWiki MCP server for Lego (Brickimedia) wiki
const { spawn } = require('child_process');
const path = require('path');

// Path to the locally installed MediaWiki MCP server
const mcpServerPath = path.join(__dirname, 'node_modules', '@professional-wiki', 'mediawiki-mcp-server', 'dist', 'index.js');

// Start the MCP server
const child = spawn('node', [mcpServerPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Configuration for Lego Brickimedia wiki
    MEDIAWIKI_API_URL: 'https://en.brickimedia.org/w/api.php',
    MEDIAWIKI_BASE_URL: 'https://en.brickimedia.org/wiki/',
  }
});

child.on('error', (error) => {
  console.error('Lego MCP server error:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Lego MCP server exited with code: ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});