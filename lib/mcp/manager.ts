import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  cwd?: string;
}

export interface MCPMessage {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class MCPManager extends EventEmitter {
  private activeProcess: ChildProcess | null = null;
  private activeServer: string | null = null;
  private messageQueue: MCPMessage[] = [];
  private pendingRequests = new Map<string | number, { resolve: Function, reject: Function }>();
  private requestId = 0;
  private isInitialized = false;

  private serverConfigs: Record<string, MCPServerConfig> = {
    lego: {
      name: 'Lego (Brickimedia)',
      command: 'node',
      args: ['mcp-servers/lego/start-lego-mcp.js'],
      cwd: process.cwd()
    },
    minecraft: {
      name: 'Minecraft Wiki',
      command: 'node',
      args: ['mcp-servers/minecraft/dist/server.js', '--api-url', 'https://minecraft.wiki/api.php'],
      cwd: process.cwd()
    },
    pokemon: {
      name: 'Pokemon (Bulbapedia)',
      command: 'node',
      args: ['mcp-servers/pokemon/start-pokemon-mcp.js'],
      cwd: process.cwd()
    },
    starwars: {
      name: 'Star Wars (Fandom)',
      command: 'node',
      args: ['mcp-servers/starwars/start-starwars-mcp.js'],
      cwd: process.cwd()
    },
    wikipedia: {
      name: 'Wikipedia',
      command: 'mcp-servers/wikipedia/venv/bin/python3',
      args: ['-m', 'wikipedia_mcp', '--country', 'US'],
      cwd: process.cwd()
    },
    wingsoffire: {
      name: 'Wings of Fire (Fandom)',
      command: 'node',
      args: ['mcp-servers/wingsoffire/start-wingsoffire-mcp.js'],
      cwd: process.cwd()
    }
  };

  async startServer(serverName: string): Promise<void> {
    if (this.activeProcess) {
      await this.stopServer();
    }

    const config = this.serverConfigs[serverName];
    if (!config) {
      throw new Error(`Unknown MCP server: ${serverName}`);
    }

    return new Promise((resolve, reject) => {
      console.log(`Starting MCP server: ${config.name}`);
      console.log(`Command: ${config.command} ${config.args.join(' ')}`);

      this.activeProcess = spawn(config.command, config.args, {
        cwd: config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.activeServer = serverName;
      this.isInitialized = false;

      this.activeProcess.stdout?.on('data', (data) => {
        this.handleMessage(data.toString());
      });

      this.activeProcess.stderr?.on('data', (data) => {
        console.error(`MCP ${serverName} stderr:`, data.toString());
      });

      this.activeProcess.on('error', (error) => {
        console.error(`MCP ${serverName} error:`, error);
        this.emit('error', error);
        reject(error);
      });

      this.activeProcess.on('exit', (code) => {
        console.log(`MCP ${serverName} exited with code:`, code);
        this.activeProcess = null;
        this.activeServer = null;
        this.isInitialized = false;
        this.emit('exit', code);
      });

      // Initialize the MCP server
      this.sendMessage({
        jsonrpc: '2.0',
        id: this.generateRequestId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'wiki-chat',
            version: '1.0.0'
          }
        }
      }).then(() => {
        console.log(`MCP ${serverName} initialized successfully`);
        this.sendNotification({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
          params: {}
        });
        this.isInitialized = true;
        resolve();
      }).catch(reject);
    });
  }

  async stopServer(): Promise<void> {
    if (this.activeProcess) {
      return new Promise((resolve) => {
        this.activeProcess!.kill();
        this.activeProcess!.on('exit', () => {
          this.activeProcess = null;
          this.activeServer = null;
          this.pendingRequests.clear();
          this.isInitialized = false;
          resolve();
        });
      });
    }
  }

  async sendMessage(message: MCPMessage): Promise<any> {
    if (!this.activeProcess) {
      throw new Error('No active MCP server');
    }

    return new Promise((resolve, reject) => {
      const id = message.id || this.generateRequestId();
      message.id = id;

      this.pendingRequests.set(id, { resolve, reject });

      const messageString = JSON.stringify(message) + '\n';
      this.activeProcess!.stdin?.write(messageString);

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  async callTool(toolName: string, params: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('MCP server not initialized');
    }
    return this.sendMessage({
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params
      }
    });
  }

  async listTools(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('MCP server not initialized');
    }
    return this.sendMessage({
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'tools/list',
      params: {}
    });
  }

  private sendNotification(message: MCPMessage): void {
    if (!this.activeProcess) {
      throw new Error('No active MCP server');
    }

    const notification = { ...message };
    delete notification.id;
    const messageString = JSON.stringify(notification) + '\n';
    this.activeProcess.stdin?.write(messageString);
  }

  private handleMessage(data: string): void {
    const lines = data.trim().split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message: MCPMessage = JSON.parse(line);

        if (message.id && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message || 'MCP error'));
          } else {
            resolve(message.result);
          }
        }

        this.emit('message', message);
      } catch (error) {
        console.error('Failed to parse MCP message:', line, error);
      }
    }
  }

  private generateRequestId(): number {
    return ++this.requestId;
  }

  getActiveServer(): string | null {
    return this.activeServer;
  }

  isServerActive(): boolean {
    return this.activeProcess !== null;
  }

  getAvailableServers(): string[] {
    return Object.keys(this.serverConfigs);
  }

  getServerInfo(serverName: string): MCPServerConfig | null {
    return this.serverConfigs[serverName] || null;
  }
}

// Singleton instance for the app
export const mcpManager = new MCPManager();
