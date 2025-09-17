"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'starting' | 'active' | 'error';
}

const MCP_SERVERS: MCPServer[] = [
  {
    id: 'minecraft',
    name: 'Minecraft',
    description: 'Minecraft Wiki content and information',
    status: 'idle'
  },
  {
    id: 'pokemon',
    name: 'Pokemon',
    description: 'Pokemon (Bulbapedia) content and information',
    status: 'idle'
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: 'Wikipedia articles and general knowledge',
    status: 'idle'
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
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-muted-foreground">
        Wiki Source:
      </label>
      <Select
        value={selectedServer || ""}
        onValueChange={handleServerChange}
        disabled={disabled || isChanging}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a wiki source" />
        </SelectTrigger>
        <SelectContent>
          {MCP_SERVERS.map((server) => (
            <SelectItem key={server.id} value={server.id}>
              <div className="flex items-center gap-2">
                <span>{getStatusIndicator(server.id)}</span>
                <span>{server.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({getStatusText(server.id)})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedServer && (
        <div className="text-sm text-muted-foreground">
          Active: <span className="font-medium text-foreground">
            {MCP_SERVERS.find(s => s.id === selectedServer)?.name}
          </span>
        </div>
      )}
    </div>
  );
}