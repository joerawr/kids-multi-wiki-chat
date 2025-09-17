"use client";

import { useState } from "react";
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
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "ai";

export default function Home() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMCPServer, setActiveMCPServer] = useState<string | null>(null);

  const handleSubmit = async (
    message: { text?: string; files?: any[] },
    event: React.FormEvent
  ) => {
    if (!message.text?.trim() || isLoading) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message.text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.text,
          mcpServer: activeMCPServer
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: UIMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: UIMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }

    // Reset form
    (event.target as HTMLFormElement).reset();
  };

  const handleMCPServerChange = (serverId: string | null) => {
    setActiveMCPServer(serverId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-4xl mx-auto relative">
      <div className="border-b p-4 space-y-4">
        <h1 className="text-xl font-semibold">Wiki Chat Assistant</h1>
        <MCPSelector
          onServerChange={handleMCPServerChange}
          disabled={isLoading}
        />
      </div>

      <Conversation className="flex-1">
        <ConversationContent className="space-y-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Start a conversation"
              description="Ask me anything and I'll help you out!"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </MessageContent>
              </Message>
            ))
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

      <div className="p-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea placeholder="What would you like to know?" />
            <PromptInputToolbar>
              <div />
              <PromptInputSubmit status={isLoading ? "submitted" : undefined} />
            </PromptInputToolbar>
          </PromptInputBody>
        </PromptInput>
      </div>

      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
        Gemini 2.5 Flash
      </div>
    </div>
  );
}
