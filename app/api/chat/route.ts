import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/mcp/manager';

export async function POST(request: NextRequest) {
  try {
    const { messages, mcpServer, model } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    // Get the latest user message for MCP search
    const latestMessage = messages[messages.length - 1];
    const messageText = latestMessage?.content || '';

    console.log('Chat request:', { messageText: messageText.substring(0, 100), mcpServer });
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

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about topics not related to Minecraft (like Pokemon or general knowledge), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Minecraft Wiki`;

          // Try to search for relevant information
          try {
            const searchResult = await mcpManager.callTool('MinecraftWiki_searchWiki', {
              query: messageText
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

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about topics not related to Pokemon (like Minecraft or general knowledge), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Pokemon (Bulbapedia)`;
        } else if (mcpServer === 'lego') {
          systemPrompt = `You are a helpful assistant that provides information about Lego. You have access to Brickimedia (Lego wiki) through an MCP server.

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about topics not related to Lego (like Minecraft or Pokemon), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Lego (Brickimedia)`;
        } else if (mcpServer === 'starwars') {
          systemPrompt = `You are a helpful assistant that provides information about Star Wars. You have access to the Star Wars Fandom wiki through an MCP server.

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about topics not related to Star Wars (like Minecraft or Pokemon), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Star Wars (Fandom)`;
        } else if (mcpServer === 'wingsoffire') {
          systemPrompt = `You are a helpful assistant that provides information about Wings of Fire. You have access to the Wings of Fire Fandom wiki through an MCP server.

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about topics not related to Wings of Fire (like Minecraft or Pokemon), politely remind them to switch to the appropriate wiki source using the dropdown at the top of the page.

Current active wiki source: Wings of Fire (Fandom)`;
        } else if (mcpServer === 'wikipedia') {
          systemPrompt = `You are a helpful assistant that provides general knowledge and information from Wikipedia.

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

If a user asks about specific topics like Minecraft or Pokemon, politely remind them that more detailed information is available by switching to the specialized wiki sources using the dropdown at the top of the page.

Current active wiki source: Wikipedia`;

          // Try to search for relevant information on Wikipedia
          try {
            // First check what tools are actually available
            const toolsList = await mcpManager.listTools();
            console.log('Wikipedia Python MCP tools available:', JSON.stringify(toolsList, null, 2));

            const searchResult = await mcpManager.callTool('search_wikipedia', {
              query: messageText,
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

Format your responses using Markdown for better readability. Use headers, bullet points, code blocks, and other Markdown formatting as appropriate.

To get more detailed and accurate information about specific topics, please select an appropriate wiki source from the dropdown at the top of the page:
- Lego: For Lego-related questions
- Minecraft: For Minecraft-related questions
- Pokemon: For Pokemon-related questions
- Star Wars: For Star Wars-related questions
- Wikipedia: For general knowledge questions
- Wings of Fire: For Wings of Fire-related questions

I can still help with general questions, but the specialized wiki sources will provide much more detailed and accurate information for their respective topics.`;
    }

    // Add Markdown formatting instruction to system prompt
    const finalSystemPrompt = systemPrompt + '\n\nIMPORTANT: Format your response using proper Markdown syntax including headers (##), bullet points (-), bold (**text**), italic (*text*), and code blocks (```). Make your response well-structured and easy to read.';

    // Convert frontend message format to AI SDK format
    const aiMessages = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Determine which AI model to use
    let aiModel;
    let modelName;

    switch (model) {
      case 'gemini-2.5-pro':
        aiModel = google('gemini-2.5-pro');
        modelName = 'Gemini 2.5 Pro';
        break;
      case 'gpt-5':
        aiModel = openai('gpt-5');
        modelName = 'OpenAI GPT-5';
        break;
      case 'gemini-2.5-flash':
      default:
        aiModel = google('gemini-2.5-flash');
        modelName = 'Gemini 2.5 Flash';
        break;
    }

    console.log(`Making request to ${modelName}...`);

    const { text } = await generateText({
      model: aiModel,
      system: finalSystemPrompt,
      messages: aiMessages,
    });

    console.log(`${modelName} response received`);
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