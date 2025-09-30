# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Quest is a family-friendly wiki chat application that lets kids explore multiple themed wikis (Lego, Minecraft, Pokémon, Star Wars, Wikipedia, Wings of Fire) through natural language. It uses AI streaming responses and dynamically-managed Model Context Protocol (MCP) servers to fetch accurate information from curated wikis.

## Branch Strategy

This project maintains a **two-branch architecture**:

### Main Branch (`main`)
- **Purpose**: Clean development and feature work
- **Usage**: Default branch for new features, bug fixes, and general development
- **Deployment**: Not directly deployed - development and staging only
- **Merging**: Feature branches merge back to `main`

### Containerize Branch (`containerize`)
- **Purpose**: Production deployment with Docker/Kubernetes configurations
- **Usage**: Contains all Docker, K8s, and deployment-specific files
- **Deployment**: This branch is built into Docker images and deployed to production
- **Merging**: `main` is periodically merged INTO `containerize` (never the reverse)
- **Key Files**: Dockerfile, k8s/, docker-compose.yml, .dockerignore, deployment configs

**CRITICAL**: Never merge `containerize` back to `main`. The flow is always `main` → `containerize`.

**Key Differences**: The `containerize` branch intentionally removes `--turbopack` flags from package.json scripts due to Docker build compatibility issues on Linux. This prevents drift while maintaining deployability.

## Development Commands

### Local Development
- `./install.sh` - Install all dependencies (main project + all MCP servers)
- `pnpm install` - Install main Node.js dependencies only
- `pnpm dev` - Start development server with Turbopack on http://localhost:3000
- `pnpm build` - Build production app with Turbopack
- `pnpm start` - Start production server

### Container Development
- `docker build -t kids-multi-wiki-chat:latest .` - Build Docker image
- `docker-compose up --build` - Run with docker-compose (uses .env.local)
- `docker-compose --profile proxy up --build` - Run with nginx proxy

### Testing & Deployment
- `./test-docker-image.sh [tag]` - Run comprehensive Docker image test suite
- `./deploy-image.sh <version>` - Complete build, test, push, and deploy workflow
- `./deploy-image.sh --rollback` - Rollback to previous deployment
- `docker push ghcr.io/joerawr/kids-multi-wiki-chat:latest` - Manual push to GitHub Container Registry
- `kubectl rollout restart deployment/wiki-chat -n knowledge-quest` - Manual K8s deployment restart

### Package Manager
This project uses **pnpm** for the main application. All MCP servers also use **pnpm** (corrected from mixed npm/pnpm).

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

### Local Development
Create `.env.local` with:
```
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here

# Optional: Lock to a single AI model (hides model selector UI)
# NEXT_PUBLIC_LOCKED_MODEL=gemini-2.5-flash-preview-09-2025
# Valid values: gemini-2.5-flash, gpt-5-mini, gemini-2.5-pro, gpt-5
```

### Kubernetes Deployment Environment Variables

The production deployment uses Kubernetes secrets managed in the `knowledge-quest` namespace:

**Secret Name**: `wiki-chat-secrets`
**Keys**:
- `google-generative-ai-api-key` - Google Gemini API key
- `openai-api-key` - OpenAI API key

**Setup Commands**:
```bash
# Create or update the secret
kubectl create secret generic wiki-chat-secrets \
  --from-literal=google-generative-ai-api-key="your-gemini-key" \
  --from-literal=openai-api-key="your-openai-key" \
  -n knowledge-quest

# Verify secret exists
kubectl get secret wiki-chat-secrets -n knowledge-quest -o yaml
```

**Registry Access**: The cluster also requires `ghcr-credentials` (docker-registry type) for pulling images from GitHub Container Registry.

### Locking to a Single Model (Deployment)
To deploy with a single, non-switchable model:
1. Set `NEXT_PUBLIC_LOCKED_MODEL` in `.env.local` or your hosting platform's environment variables
2. Example: `NEXT_PUBLIC_LOCKED_MODEL=gemini-2.5-flash-preview-09-2025`
3. The model selector UI will be hidden and all requests will use the locked model
4. Leave unset for development to enable model comparison

## Docker & Kubernetes Architecture

### Multi-Stage Docker Build
The Dockerfile uses a 3-stage build process optimized for production:

1. **MCP Builder Stage**: Builds all MCP servers including the external Minecraft Wiki MCP
2. **App Builder Stage**: Builds the Next.js application with Turbopack
3. **Runtime Stage**: Minimal production image with health checks and security hardening

**Key Features**:
- Architecture safety check (ensures x86-64/amd64 for K8s compatibility)
- Non-root user execution with proper file permissions
- Health check endpoint at `/api/health`
- Multi-MCP server support with proper dependency management

### Kubernetes Deployment

**Namespace**: `knowledge-quest`
**Image Repository**: `ghcr.io/joerawr/kids-multi-wiki-chat:latest`

**Key Components**:
- **Deployment**: Single replica with rolling updates, resource limits, and health checks
- **Service**: ClusterIP exposing port 3000
- **Ingress**: Traefik-based with TLS termination and HTTPS redirects
- **Secrets**: API keys stored in `wiki-chat-secrets`

**Security Features**:
- Non-root container execution (uid/gid 1000)
- Read-only root filesystem disabled (required for Next.js caching)
- Dropped all capabilities
- Security context hardening

**SSL/TLS Setup**:
- cert-manager with Let's Encrypt for automatic certificate generation
- HTTP-01 challenge requires temporary port 80 access
- Cloudflare compatibility (disable proxy during cert generation)

## Key Files

### Core Application
- `app/page.tsx` - Main chat UI with useChat hook integration
- `app/api/chat/route.ts` - Streaming API endpoint with MCP integration
- `app/api/health/route.ts` - Health check endpoint for Docker/K8s
- `lib/mcp/manager.ts` - MCP process lifecycle manager (singleton)
- `components/mcp-selector.tsx` - Wiki source selector UI
- `components/model-selector.tsx` - AI model selector UI

### MCP Servers
- `mcp-servers/*/` - Individual MCP server implementations
- `install.sh` - Automated dependency installer for all MCP servers

### Container & Deployment
- `Dockerfile` - Multi-stage production build
- `docker-compose.yml` - Local container testing with optional nginx proxy
- `.dockerignore` - Container build exclusions
- `k8s/deployment.yaml` - Kubernetes deployment manifest
- `k8s/service.yaml` - Kubernetes service manifest
- `k8s/ingress.yaml` - Traefik ingress with TLS
- `k8s/secret.yaml` - Template for API key secrets
- `k8s/setup-env.sh` - Environment variable setup script

## Common Issues

### Local Development Issues

**"Cannot find module" in MCP server**
- Run `./install.sh` or manually: `cd mcp-servers/<name> && pnpm install`
- All MCP servers now use pnpm consistently

**Messages not rendering**
- Messages from `useChat` use `parts` array, not `content` field
- Extract text from parts in rendering logic

**Streaming not working**
- Backend must use `toUIMessageStreamResponse()` for compatibility with `useChat` hook
- Text-only streams won't work

**MCP server won't start**
- Check that dependencies are installed in the MCP server directory
- Verify the command path in `lib/mcp/manager.ts` matches the actual file
- Check server logs in terminal for error messages

**Dynamic body params not sent**
- Pass dynamic params (mcpServer, model) in the second argument to `sendMessage()`, not in the `useChat` config

### Container/Deployment Issues

**Docker build fails with architecture error**
- Build must be done on x86-64/amd64 architecture for K8s compatibility
- Switch to appropriate build server if using ARM/M1 Mac

**Docker build fails with Turbopack on Linux**
- Turbopack (`--turbopack` flag) causes build failures in Docker containers on Linux
- The `containerize` branch intentionally removes `--turbopack` from package.json scripts
- Use `pnpm build` (without --turbopack) for Docker builds
- Keep `--turbopack` in `main` branch for local development performance

**ImagePullBackOff in Kubernetes**
- Verify `ghcr-credentials` secret exists in the `knowledge-quest` namespace
- Check image tag matches what was pushed to GHCR
- Ensure GitHub Container Registry permissions are correct

**Health check failures**
- Verify `/api/health` endpoint is accessible
- Check container logs for startup errors
- Ensure port 3000 is properly exposed and not blocked

**SSL certificate generation fails**
- Temporarily forward port 80 to cluster for HTTP-01 challenge
- Disable Cloudflare proxy (gray cloud) during certificate generation
- Check cert-manager logs: `kubectl logs -n cert-manager deployment/cert-manager`

**MCP servers not starting in container**
- Verify all MCP server dependencies are installed during build
- Check if file paths in `lib/mcp/manager.ts` match container structure
- Review container logs for MCP-specific error messages

## Deployment Workflow

### Feature Development
1. **Create feature branch** from `main`
2. **Develop and test** locally with `pnpm dev`
3. **Merge to main** via pull request

### Production Deployment

#### **Recommended: Automated Deployment**
1. **Switch to containerize branch**: `git checkout containerize`
2. **Merge main**: `git merge main` (resolve any conflicts)
3. **Deploy with versioning**: `./deploy-image.sh v1.2.3` (or use date: `2024.01.15`)

#### **Manual Deployment** (legacy)
1. **Switch to containerize branch**: `git checkout containerize`
2. **Merge main**: `git merge main` (resolve any conflicts)
3. **Build Docker image**: `docker build -t ghcr.io/joerawr/kids-multi-wiki-chat:v1.2.3 .`
4. **Tag as latest**: `docker tag ghcr.io/joerawr/kids-multi-wiki-chat:v1.2.3 ghcr.io/joerawr/kids-multi-wiki-chat:latest`
5. **Test Docker image**: `./test-docker-image.sh v1.2.3` (must pass all tests)
6. **Push versioned**: `docker push ghcr.io/joerawr/kids-multi-wiki-chat:v1.2.3`
7. **Push latest**: `docker push ghcr.io/joerawr/kids-multi-wiki-chat:latest`
8. **Deploy to K8s**: `kubectl set image deployment/wiki-chat wiki-chat=ghcr.io/joerawr/kids-multi-wiki-chat:v1.2.3 -n knowledge-quest`
9. **Verify deployment**: Check health endpoint and pod status

#### **Rollback Strategy**
- **Quick rollback**: `./deploy-image.sh --rollback`
- **Manual rollback**: `kubectl rollout undo deployment/wiki-chat -n knowledge-quest`
- **Specific version**: `kubectl set image deployment/wiki-chat wiki-chat=ghcr.io/joerawr/kids-multi-wiki-chat:v1.2.2 -n knowledge-quest`

#### **Version Tagging Strategy**

**Semantic Versioning (Recommended)**: `MAJOR.MINOR.PATCH`

- **MAJOR** (`1.x.x` → `2.x.x`): Breaking changes, API changes, major rewrites
  - Examples: New authentication system, UI redesign, API endpoint changes

- **MINOR** (`x.1.x` → `x.2.x`): New features that are backward compatible
  - Examples: New wiki sources, new AI models, streaming features, model locking

- **PATCH** (`x.x.1` → `x.x.2`): Bug fixes and small improvements
  - Examples: Fix broken links, performance improvements, dependency updates

**Current Version**: `v1.1.1` (fix: model locking now baked into Docker build)

**Alternative Tagging**:
- **Date-based**: `2024.01.15`, `2024.01.15-hotfix`
- **Build numbers**: `build-123`, `release-456`

**IMPORTANT**: Never merge `containerize` back to `main`. The deployment branch stays separate.

## UI Components

- **shadcn/ui**: `pnpm dlx shadcn@latest add [component-name]`
- **AI Elements**: Pre-built chat components in `components/ai-elements/`
- **Import aliases**: `@/components`, `@/lib`, `@/app`
- **Style**: New York variant, neutral base color palette

## Reference Links

- **AI SDK useChat**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- **AI SDK streamText**: https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text
- **MCP Protocol**: https://modelcontextprotocol.io/
- **GitHub Container Registry**: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **cert-manager**: https://cert-manager.io/docs/
- **Traefik Ingress**: https://doc.traefik.io/traefik/providers/kubernetes-ingress/