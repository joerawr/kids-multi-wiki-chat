# Multi-stage build for Kids Multi-Wiki Chat with MCP servers
FROM node:20-slim AS base

# Architecture safety check - fail build if not x86-64/amd64
RUN if [ "$(uname -m)" != "x86_64" ] && [ "$(uname -m)" != "amd64" ]; then \
        echo "❌ ERROR: Wrong architecture detected!"; \
        echo "   Current: $(uname -m)"; \
        echo "   Required: x86_64/amd64 for K8s compatibility"; \
        echo "   Switch to an x86-64 server before building Docker images"; \
        exit 1; \
    else \
        echo "✅ Architecture check passed: $(uname -m)"; \
    fi

# Install system dependencies for Python and git
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@latest

#################################################################
# Stage 1: Build MCP Servers
#################################################################
FROM base AS mcp-builder
ARG MINECRAFT_MCP_COMMIT=7a753f50eab0ddf1f743d1cb1ab7edb7a9737ad2

WORKDIR /app

# Clone and build Minecraft MCP server
RUN git clone https://github.com/L3-N0X/Minecraft-Wiki-MCP.git mcp-servers/minecraft-wiki
WORKDIR /app/mcp-servers/minecraft-wiki
RUN git checkout ${MINECRAFT_MCP_COMMIT}
RUN npm install && npm run build

# Create minecraft directory and copy everything needed
WORKDIR /app
RUN mkdir -p mcp-servers/minecraft
RUN cp -r mcp-servers/minecraft-wiki/dist/* mcp-servers/minecraft/
RUN cp -r mcp-servers/minecraft-wiki/node_modules mcp-servers/minecraft/
RUN cp mcp-servers/minecraft-wiki/package.json mcp-servers/minecraft/

# Set up MediaWiki-based MCP servers (Pokemon, Lego, Star Wars, Wings of Fire)
COPY mcp-servers/pokemon /app/mcp-servers/pokemon
COPY mcp-servers/lego /app/mcp-servers/lego
COPY mcp-servers/starwars /app/mcp-servers/starwars
COPY mcp-servers/wingsoffire /app/mcp-servers/wingsoffire
WORKDIR /app/mcp-servers
RUN for dir in pokemon lego starwars wingsoffire; do \
        npm install --prefix "/app/mcp-servers/$dir"; \
    done

# Set up Wikipedia MCP server (Python)
RUN python3 -m venv wikipedia/venv
RUN wikipedia/venv/bin/pip install wikipedia-mcp

#################################################################
# Stage 2: Build Next.js Application
#################################################################
FROM base AS app-builder

# Accept build argument for locked model
ARG NEXT_PUBLIC_LOCKED_MODEL

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies using lockfile for repeatable builds
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build Next.js app with Turbopack
RUN pnpm build

#################################################################
# Stage 3: Production Runtime
#################################################################
FROM node:20-slim AS runtime

# Install runtime dependencies required for health checks and MCP tools
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@latest

WORKDIR /app

# Copy built Next.js application
COPY --from=app-builder /app/.next ./.next
COPY --from=app-builder /app/public ./public
COPY --from=app-builder /app/package.json ./package.json
COPY --from=app-builder /app/node_modules ./node_modules

# Copy built MCP servers
COPY --from=mcp-builder /app/mcp-servers ./mcp-servers

# Copy application source files needed at runtime
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY next.config.ts ./next.config.ts

# Clean up development artifacts
RUN find . -name ".DS_Store" -delete && \
    find . -name "*.log" -delete && \
    find . -name ".npm" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find . -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true

# Create non-root user and set ownership efficiently
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    mkdir -p /app/.next/cache/images && \
    chown -R appuser:appuser /app/.next /app/app /app/components /app/lib && \
    chown appuser:appuser /app/package.json /app/next.config.ts
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["pnpm", "start"]
