"use client";

import { useState } from "react";
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
import type { UIMessage } from "ai";

export default function Home() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMCPServer, setActiveMCPServer] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-2.5-flash");

  const handleSubmit = async (
    message: { text?: string; files?: any[] },
    event: React.FormEvent
  ) => {
    if (!message.text?.trim() || isLoading) return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: "user",
      parts: [{ type: "text", text: message.text }],
    };

    // Create the updated messages array including the new user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Convert UIMessage format to simple message format for API
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.parts?.find(part => part.type === "text")?.text || ""
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          mcpServer: activeMCPServer,
          model: selectedModel
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: UIMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          parts: [{ type: "text", text: data.response }],
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
        parts: [{ type: "text", text: "Sorry, I encountered an error. Please try again." }],
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

  const handleModelChange = (model: AIModel) => {
    setSelectedModel(model);
  };

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
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {message.parts?.map((part, index) => (
                      part.type === "text" ? (
                        <ReactMarkdown key={index}>
                          {part.text}
                        </ReactMarkdown>
                      ) : null
                    ))}
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
        />
      </div>
    </div>
  );
}
