import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';

export async function POST(request: NextRequest) {
  try {
    const { message, mcpServer } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('Chat request:', { message: message.substring(0, 100), mcpServer });
    console.log('MCP Status:', {
      requestedServer: mcpServer,
      isActive: mcpManager.isServerActive(),
      activeServer: mcpManager.getActiveServer()
    });

    // If an MCP server is requested but not active or wrong server is active, try to start it
    if (mcpServer && (!mcpManager.isServerActive() || mcpManager.getActiveServer() !== mcpServer)) {
      try {
        console.log(`MCP server mismatch - requested: ${mcpServer}, active: ${mcpManager.getActiveServer()}, starting: ${mcpServer}`);
        await mcpManager.startServer(mcpServer);
        console.log(`MCP server started: ${mcpServer}`);
        // Wait a moment for the server to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`MCP server initialization wait complete: ${mcpServer}`);
      } catch (error) {
        console.error(`Failed to start MCP server ${mcpServer}:`, error);
        // Continue without MCP data
      }
    }

    let systemPrompt = '';
    let mcpData = null;

    // If an MCP server is active, try to get relevant information
    if (mcpServer && mcpManager.isServerActive() && mcpManager.getActiveServer() === mcpServer) {
      try {
        console.log(`Using MCP server: ${mcpServer}`);

        // For now, we'll create a simple search strategy
        // In a production app, you'd want more sophisticated query analysis
        if (mcpServer === 'minecraft') {
          systemPrompt = `You are a helpful assistant that provides information about Minecraft. You have access to the official Minecraft Wiki through an MCP server. When users ask about Minecraft-related topics, use the information from the wiki to provide accurate, detailed responses.

If a user asks about topics not related to Minecraft (like Pokemon or general knowledge), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Minecraft Wiki`;

          // Try to search for relevant information
          try {
            const searchResult = await mcpManager.callTool('MinecraftWiki_searchWiki', {
              query: message
            });

            if (searchResult && searchResult.content) {
              mcpData = searchResult.content;
              systemPrompt += `\n\nRelevant wiki information:\n${JSON.stringify(searchResult.content)}`;
            }
          } catch (mcpError) {
            console.log('MCP search failed:', mcpError);
            // Continue without MCP data
          }
        } else if (mcpServer === 'pokemon') {
          systemPrompt = `You are a helpful assistant that provides information about Pokemon. You have access to Bulbapedia (Pokemon wiki) through an MCP server.

If a user asks about topics not related to Pokemon (like Minecraft or general knowledge), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Pokemon (Bulbapedia)`;
        } else if (mcpServer === 'wikipedia') {
          systemPrompt = `You are a helpful assistant that provides general knowledge and information from Wikipedia.

If a user asks about specific topics like Minecraft or Pokemon, politely remind them that more detailed information is available by switching to the specialized wiki sources using the dropdown at the top of the page.

Current active wiki source: Wikipedia`;

          // Try to search for relevant information on Wikipedia
          try {
            // First check what tools are actually available
            const toolsList = await mcpManager.listTools();
            console.log('Wikipedia Python MCP tools available:', JSON.stringify(toolsList, null, 2));

            const searchResult = await mcpManager.callTool('search_wikipedia', {
              query: message,
              limit: 5
            });

            if (searchResult && searchResult.results && searchResult.results.length > 0) {
              mcpData = searchResult;
              systemPrompt += `\n\nRelevant Wikipedia search results:\n${JSON.stringify(searchResult.results.slice(0, 3))}`;
            }
          } catch (mcpError) {
            console.log('Wikipedia MCP search failed:', mcpError);
            // Continue without MCP data
          }
        }
      } catch (mcpError) {
        console.error('MCP integration error:', mcpError);
        // Continue without MCP data
      }
    } else {
      systemPrompt = `You are a helpful assistant. Currently, no specific wiki source is selected.

To get more detailed and accurate information about specific topics, please select an appropriate wiki source from the dropdown at the top of the page:
- Minecraft: For Minecraft-related questions
- Pokemon: For Pokemon-related questions
- Wikipedia: For general knowledge questions

I can still help with general questions, but the specialized wiki sources will provide much more detailed and accurate information for their respective topics.`;
    }

    const fullPrompt = systemPrompt + '\n\nUser question: ' + message;

    console.log('Making request to Gemini...');

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: fullPrompt,
    });

    console.log('Gemini response received');
    return NextResponse.json({
      response: text,
      mcpServer,
      mcpDataUsed: !!mcpData
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}