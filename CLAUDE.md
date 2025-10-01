# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Quest is a family-friendly wiki chat application that lets kids explore multiple themed wikis (Lego, Minecraft, Pokémon, Star Wars, Wikipedia, Wings of Fire) through natural language. It uses AI streaming responses and dynamically-managed Model Context Protocol (MCP) servers to fetch accurate information from curated wikis.

## Development Commands

### Setup
- `./install.sh` - Install all dependencies (main project + all MCP servers)
- `pnpm install` - Install main Node.js dependencies only
- For individual MCP servers: `cd mcp-servers/<name> && npm install` (pokemon, lego, starwars, wingsoffire use npm; minecraft uses pnpm)

### Development
- `pnpm dev` - Start development server with Turbopack on http://localhost:3000
- `pnpm build` - Build production app with Turbopack
- `pnpm start` - Start production server

### Package Manager
This project uses **pnpm** for the main application. MCP servers use npm (except minecraft which uses pnpm).

## Architecture

### High-Level Structure
This is a Next.js 15 app with App Router that orchestrates multiple MCP servers as external processes. The key architectural pattern is:

1. **Frontend** (`app/page.tsx`) → User selects wiki source + sends message
2. **API Route** (`app/api/chat/route.ts`) → Receives request with `mcpServer` and `model` params
3. **MCP Manager** (`lib/mcp/manager.ts`) → Spawns/switches appropriate MCP server process
4. **MCP Server** (Node.js or Python process) → Fetches wiki data via MediaWiki API
5. **Streaming Response** → AI model streams response back through `useChat` hook

### Core Technologies
- **Next.js 15** with App Router and Turbopack
- **AI SDK 5** with streaming via `@ai-sdk/react`
- **Multiple AI Models**: OpenAI (GPT-5, GPT-5 Mini), Google (Gemini 2.5 Flash, Gemini 2.5 Pro preview at `gemini-2.5-flash-preview-09-2025`)
- **MCP (Model Context Protocol)** servers for wiki data retrieval
- **shadcn/ui** components (New York style, neutral base)
- **Tailwind CSS v4**

## Critical Implementation Details

### AI Streaming with useChat
The app uses AI SDK's `useChat` hook for streaming responses. **Critical patterns:**

```typescript
// CORRECT: Pass dynamic params in sendMessage options
const { messages, status, sendMessage } = useChat({ api: "/api/chat" });

sendMessage({ text: "user message" }, {
  body: {
    mcpServer: activeMCPServer,  // Dynamic - passed per message
    model: selectedModel,         // Dynamic - passed per message
  }
});

// Message rendering: Handle parts array format
if (Array.isArray(message.parts)) {
  const textParts = message.parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('');
}
```

**Backend must return:** `result.toUIMessageStreamResponse()` (NOT `toTextStreamResponse()` or `toDataStreamResponse()`)

**Message format from frontend:** Messages arrive with `parts` array structure, not simple `content` field. Backend must extract text from parts.

### MCP Server Management
The `MCPManager` class (`lib/mcp/manager.ts`) is a singleton that:
- Spawns MCP server processes using Node.js `spawn()` with stdio transport
- Only one MCP server runs at a time (switches automatically)
- Communicates via JSON-RPC over stdio
- Manages request/response correlation with pending requests map
- Has 10-second timeout for MCP requests

**Server configurations** are defined in `serverConfigs` object with command, args, and working directory.

### Adding a New Wiki Source

1. **Create MCP server directory** in `mcp-servers/<name>/`
   - For MediaWiki: Use `@professional-wiki/mediawiki-mcp-server` package
   - Create `start-<name>-mcp.js` wrapper script with API URL env vars
   - Add `package.json` with dependencies

2. **Register in MCP Manager** (`lib/mcp/manager.ts`):
   ```typescript
   serverConfigs: {
     newwiki: {
       name: 'New Wiki Display Name',
       command: 'node',
       args: ['mcp-servers/newwiki/start-newwiki-mcp.js'],
       cwd: process.cwd()
     }
   }
   ```

3. **Add UI selector** (`components/mcp-selector.tsx`):
   - Add button with image in `public/` directory
   - Add to server options array

4. **Add system prompt** (`app/api/chat/route.ts`):
   - Add case in the switch statement for your new wiki
   - Provide context-specific instructions for the AI

5. **Install dependencies**: Run `./install.sh` or manually in the MCP server directory

### Model Configuration
Models are mapped in `app/api/chat/route.ts`:
- `gemini-2.5-flash` → `google('gemini-2.5-flash-preview-09-2025')` (default, preview model)
- `gemini-2.5-pro` → `google('gemini-2.5-pro')`
- `gpt-5` → `openai('gpt-5')`
- `gpt-5-mini` → `openai('gpt-5-mini')`

To add a model: Update the switch statement in `app/api/chat/route.ts` and add to `ModelSelector` component.

## Environment Setup

Create `.env.local` with:
```
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Optional: Lock to a single AI model (hides model selector UI)
# NEXT_PUBLIC_LOCKED_MODEL=gemini-2.5-flash-preview-09-2025
# Valid values: gemini-2.5-flash, gpt-5-mini, gemini-2.5-pro, gpt-5
```

### Locking to a Single Model (Deployment)
To deploy with a single, non-switchable model:
1. Set `NEXT_PUBLIC_LOCKED_MODEL` in `.env.local` or your hosting platform's environment variables
2. Example: `NEXT_PUBLIC_LOCKED_MODEL=gemini-2.5-flash-preview-09-2025`
3. The model selector UI will be hidden and all requests will use the locked model
4. Leave unset for development to enable model comparison

## Key Files

- `app/page.tsx` - Main chat UI with useChat hook integration
- `app/api/chat/route.ts` - Streaming API endpoint with MCP integration
- `lib/mcp/manager.ts` - MCP process lifecycle manager (singleton)
- `components/mcp-selector.tsx` - Wiki source selector UI
- `components/model-selector.tsx` - AI model selector UI
- `mcp-servers/*/` - Individual MCP server implementations

## Common Issues

### "Cannot find module" in MCP server
Run `./install.sh` or manually: `cd mcp-servers/<name> && npm install`

### Messages not rendering
Messages from `useChat` use `parts` array, not `content` field. Extract text from parts in rendering logic.

### Streaming not working
Backend must use `toUIMessageStreamResponse()` for compatibility with `useChat` hook. Text-only streams won't work.

### MCP server won't start
- Check that dependencies are installed in the MCP server directory
- Verify the command path in `lib/mcp/manager.ts` matches the actual file
- Check server logs in terminal for error messages

### Dynamic body params not sent
Pass dynamic params (mcpServer, model) in the second argument to `sendMessage()`, not in the `useChat` config.

## UI Components

- **shadcn/ui**: `pnpm dlx shadcn@latest add [component-name]`
- **AI Elements**: Pre-built chat components in `components/ai-elements/`
- Import aliases: `@/components`, `@/lib`, `@/app`

## GitHub Issue Pattern

When creating GitHub issues for this repository, use the following format:

```
## Problem
[Clear problem statement]

## Solution
[Proposed fix or approach]

## Rabbit holes
[One line or short list of things or topics to avoid]

## No gos
[Things that should not be done, e.g., "Changing SDKs or anything that would trigger a 2.0.0 version"]
```

## Container Deployment (containerize branch)

When applying fixes in the `containerize` branch:

1. **Test before pushing**: Always test changes locally before pushing to the branch
2. **Deploy and verify**: Deploy the container and verify it works before closing the issue
3. **Check latest version**: Before deploying, check the latest version at https://github.com/users/joerawr/packages/container/package/kids-multi-wiki-chat
4. **Deploy command**: Use `./deploy-image.sh <version>` with an incremented version number
5. **Only then close issue**: After successful deployment and verification, push changes and close the issue

## Reference Links

- AI SDK useChat: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- AI SDK streamText: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- MCP Protocol: https://modelcontextprotocol.io/
- note the containerize branch is permanent and will not be merged to main.