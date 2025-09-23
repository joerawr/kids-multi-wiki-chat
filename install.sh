#!/bin/bash

# Install script for Kids Multi-Wiki Chat
# This script installs all dependencies for the main project and MCP servers

set -e  # Exit on any error

echo "🚀 Installing Kids Multi-Wiki Chat dependencies..."

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

echo "📦 Installing main project dependencies..."
pnpm install

echo "🔧 Installing MCP server dependencies..."

# Install Lego MCP dependencies
echo "  🧱 Installing Lego MCP dependencies..."
cd mcp-servers/lego
pnpm install
cd ../..

# Install Minecraft MCP dependencies
echo "  ⚒️  Installing Minecraft MCP dependencies..."
cd mcp-servers/minecraft
pnpm install
cd ../..

# Install Pokemon MCP dependencies
echo "  🎮 Installing Pokemon MCP dependencies..."
cd mcp-servers/pokemon
pnpm install
cd ../..

# Install Star Wars MCP dependencies
echo "  ⭐ Installing Star Wars MCP dependencies..."
cd mcp-servers/starwars
pnpm install
cd ../..

# Install Wikipedia MCP dependencies
echo "  📚 Installing Wikipedia MCP dependencies..."
cd mcp-servers/wikipedia
pnpm install
cd ../..

# Install Wings of Fire MCP dependencies
echo "  🐉 Installing Wings of Fire MCP dependencies..."
cd mcp-servers/wingsoffire
pnpm install
cd ../..

echo "✅ All dependencies installed successfully!"
echo ""
echo "🎯 Next steps:"
echo "1. Create .env.local file with your API keys:"
echo "   OPENAI_API_KEY=your_openai_api_key_here"
echo "   GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here"
echo ""
echo "2. Start the development server:"
echo "   pnpm dev"
echo ""
echo "3. Open http://localhost:3000 in your browser"