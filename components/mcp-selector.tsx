"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'starting' | 'active' | 'error';
}

const MCP_SERVERS: (MCPServer & { imagePath: string })[] = [
  {
    id: 'lego',
    name: 'Lego',
    description: 'Lego (Brickimedia) content and information',
    status: 'idle',
    imagePath: '/LegoButton_256px.png'
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    description: 'Minecraft Wiki content and information',
    status: 'idle',
    imagePath: '/MinecraftButton_256px.png'
  },
  {
    id: 'pokemon',
    name: 'Pokemon',
    description: 'Pokemon (Bulbapedia) content and information',
    status: 'idle',
    imagePath: '/PikachuButton_256px.png'
  },
  {
    id: 'starwars',
    name: 'Star Wars',
    description: 'Star Wars (Fandom) content and information',
    status: 'idle',
    imagePath: '/StarWarsButton_256px.png'
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: 'Wikipedia articles and general knowledge',
    status: 'idle',
    imagePath: '/WikipediaButton_256px.png'
  },
  {
    id: 'wingsoffire',
    name: 'Wings of Fire',
    description: 'Wings of Fire (Fandom) content and information',
    status: 'idle',
    imagePath: '/WingsOfFireButton_256px.png'
  }
];

interface MCPSelectorProps {
  onServerChange: (serverId: string | null) => void;
  disabled?: boolean;
}

export function MCPSelector({ onServerChange, disabled = false }: MCPSelectorProps) {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [serverStatuses, setServerStatuses] = useState<Record<string, MCPServer['status']>>({});
  const [isChanging, setIsChanging] = useState(false);

  const playClickSound = () => {
    try {
      const audio = new Audio('/Plastic-Button-Click.mp3');
      audio.play().catch(() => {
        // Ignore audio errors (e.g., user hasn't interacted with page yet)
      });
    } catch (error) {
      // Ignore audio creation errors
    }
  };

  useEffect(() => {
    // Initialize server statuses
    const initialStatuses: Record<string, MCPServer['status']> = {};
    MCP_SERVERS.forEach(server => {
      initialStatuses[server.id] = 'idle';
    });
    setServerStatuses(initialStatuses);
  }, []);

  const handleServerChange = async (serverId: string) => {
    if (isChanging || disabled) return;

    playClickSound();
    setIsChanging(true);

    try {
      // Update status to starting
      setServerStatuses(prev => ({
        ...prev,
        [serverId]: 'starting'
      }));

      // Call the API to start the MCP server
      const response = await fetch('/api/mcp/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });

      if (!response.ok) {
        throw new Error('Failed to switch MCP server');
      }

      const result = await response.json();

      if (result.success) {
        // Update status to active for selected server, idle for others
        const newStatuses: Record<string, MCPServer['status']> = {};
        MCP_SERVERS.forEach(server => {
          newStatuses[server.id] = server.id === serverId ? 'active' : 'idle';
        });
        setServerStatuses(newStatuses);
        setSelectedServer(serverId);
        onServerChange(serverId);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error switching MCP server:', error);
      // Update status to error
      setServerStatuses(prev => ({
        ...prev,
        [serverId]: 'error'
      }));

      // Reset selection if it failed
      if (selectedServer !== serverId) {
        setSelectedServer(selectedServer);
      }
    } finally {
      setIsChanging(false);
    }
  };

  const getStatusIndicator = (serverId: string) => {
    const status = serverStatuses[serverId];
    switch (status) {
      case 'starting':
        return '🟡';
      case 'active':
        return '🟢';
      case 'error':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getStatusText = (serverId: string) => {
    const status = serverStatuses[serverId];
    switch (status) {
      case 'starting':
        return 'Starting...';
      case 'active':
        return 'Active';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <label className="text-sm font-sans font-medium text-muted-foreground">
        Click a button to select a source:
      </label>
      <div className="flex gap-4">
        {MCP_SERVERS.map((server) => (
          <Button
            key={server.id}
            variant="ghost"
            onClick={() => handleServerChange(server.id)}
            disabled={disabled || isChanging}
            className={`relative p-2 h-auto transition-all duration-200 hover:scale-105 active:scale-95 ${
              selectedServer === server.id
                ? 'ring-2 ring-green-400 bg-green-50 dark:bg-green-950/20'
                : 'hover:bg-accent'
            }`}
            title={`${server.name} - ${getStatusText(server.id)}`}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <Image
                  src={server.imagePath}
                  alt={server.name}
                  width={64}
                  height={64}
                  className="rounded-lg"
                />
                <div className="absolute -top-1 -right-1 text-xs">
                  {getStatusIndicator(server.id)}
                </div>
              </div>
              <span className="text-xs font-medium">{server.name}</span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}