"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import Image from "next/image";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { MCPSelector } from "@/components/mcp-selector";
import { ModelSelector, type AIModel } from "@/components/model-selector";
import ReactMarkdown from "react-markdown";

export default function Home() {
  // Check for locked model from environment variable
  const lockedModel = (process.env.NEXT_PUBLIC_LOCKED_MODEL as AIModel) || null;

  const [activeMCPServer, setActiveMCPServer] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>(
    lockedModel || "gemini-2.5-flash"
  );

  const { messages, status, sendMessage } = useChat();

  const handleSubmit = async (
    message: { text?: string; files?: any[] },
    event: React.FormEvent
  ) => {
    if (!message.text?.trim() || status === "streaming") return;

    // Clear the form immediately
    const form = (event.target as Element)?.closest("form") as HTMLFormElement;
    if (form) {
      form.reset();
    }

    // Send message using useChat's sendMessage with dynamic body params
    sendMessage({ text: message.text }, {
      body: {
        mcpServer: activeMCPServer,
        model: selectedModel,
      },
    });
  };

  const handleMCPServerChange = (serverId: string | null) => {
    setActiveMCPServer(serverId);
  };

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
  };

  const isLoading = status === "streaming";

  // Debug: log messages structure
  console.log('Messages:', messages.slice(-1));

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#cadcc1] via-[#eaf3cf] to-[#afd3ea] flex flex-col max-w-4xl mx-auto relative">
      <div className="border-b border-white/20 bg-white/10 backdrop-blur-sm p-4 space-y-4">
        <div className="flex justify-center">
          <Image
            src="/KnowledgeQuest2.png"
            alt="Knowledge Quest"
            width={521}
            height={220}
            className="h-auto max-w-full"
            priority
          />
        </div>
        <MCPSelector
          onServerChange={handleMCPServerChange}
          disabled={isLoading}
        />
      </div>

      <Conversation className="flex-1 bg-white/5 backdrop-blur-sm">
        <ConversationContent className="space-y-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ready for an adventure?"
              description="Choose a wiki source above and ask me anything about your favorite topics!"
            />
          ) : (
            messages.map((message) => {
              // Extract text from parts array or use content directly
              let messageText = '';
              if (Array.isArray((message as any).parts)) {
                const textParts = (message as any).parts
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join('');
                messageText = textParts;
              } else if (typeof (message as any).content === 'string') {
                messageText = (message as any).content;
              }

              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>
                        {messageText}
                      </ReactMarkdown>
                    </div>
                  </MessageContent>
                </Message>
              );
            })
          )}
          {isLoading && (
            <Message from="assistant">
              <MessageContent>
                Thinking...
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
      </Conversation>

      <div className="p-4 bg-white/20 backdrop-blur-sm border-t border-white/20">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="What do you want to learn about?" />
            <PromptInputToolbar>
              <div />
              <PromptInputSubmit status={isLoading ? "submitted" : undefined} />
            </PromptInputToolbar>
          </PromptInputBody>
        </PromptInput>
      </div>

      <div className="px-4 pb-4 flex justify-end">
        <ModelSelector
          onModelChange={handleModelChange}
          disabled={isLoading}
          lockedModel={lockedModel}
        />
      </div>
    </div>
  );
}
