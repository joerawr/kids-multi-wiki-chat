"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AIModel = "gemini-2.5-flash" | "gpt-5-mini" | "gemini-2.5-pro" | "gpt-5";

interface ModelSelectorProps {
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
  lockedModel?: AIModel | null;
}

const models = [
  { id: "gemini-2.5-flash" as const, name: "Gemini 2.5 Flash" },
  { id: "gpt-5-mini" as const, name: "OpenAI GPT-5 Mini" },
  { id: "gemini-2.5-pro" as const, name: "Gemini 2.5 Pro" },
  { id: "gpt-5" as const, name: "OpenAI GPT-5" },
];

export function ModelSelector({ onModelChange, disabled, lockedModel }: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<AIModel>("gemini-2.5-flash");

  const handleModelChange = (value: string) => {
    const model = value as AIModel;
    setSelectedModel(model);
    onModelChange(model);
  };

  // If a locked model is specified, don't render the selector
  if (lockedModel) {
    return null;
  }

  return (
    <Select
      value={selectedModel}
      onValueChange={handleModelChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-fit min-w-[140px] bg-white/10 border-white/20 text-gray-700 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}