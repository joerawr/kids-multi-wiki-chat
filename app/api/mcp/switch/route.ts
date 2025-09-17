import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const availableServers = mcpManager.getAvailableServers();
    if (!availableServers.includes(serverId)) {
      return NextResponse.json(
        { success: false, error: `Unknown server: ${serverId}` },
        { status: 400 }
      );
    }

    console.log(`Switching to MCP server: ${serverId}`);

    // Start the requested MCP server
    await mcpManager.startServer(serverId);

    console.log(`MCP server ${serverId} started successfully`);

    return NextResponse.json({
      success: true,
      activeServer: serverId,
      serverInfo: mcpManager.getServerInfo(serverId)
    });

  } catch (error) {
    console.error('MCP switch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch MCP server'
      },
      { status: 500 }
    );
  }
}