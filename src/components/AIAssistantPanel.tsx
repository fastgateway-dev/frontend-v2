'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIGenerate } from '@/hooks/useAIGenerate';
import { AIMessageBubble } from './AIMessageBubble';
import { Button } from '@/components/ui/button';
import type { AIGeneratedRoute, CreateRouteInput } from '@/types';

interface AIAssistantPanelProps {
  projectId: string;
  domainId: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyRoute: (route: Partial<CreateRouteInput>) => void;
}

export function AIAssistantPanel({
  projectId,
  domainId,
  isOpen,
  onClose,
  onApplyRoute,
}: AIAssistantPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    isStreaming,
    error,
    generate,
    cancel,
    clearMessages,
  } = useAIGenerate({ projectId, domainId });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    generate('natural_language', input);
    setInput('');
  };

  const handleApplyRoute = (routeIndex: number) => {
    const message = messages.find(m => m.routes && m.routes.length > routeIndex);
    if (message?.routes) {
      const route = message.routes[routeIndex];
      onApplyRoute(convertToCreateRouteInput(route));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold">AI Assistant</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>How can I help you create a route?</p>
            <p className="mt-2 text-xs">
              Try: "Route /api/users to user-service on port 8080"
            </p>
          </div>
        )}
        {messages.map((message) => (
          <AIMessageBubble
            key={message.id}
            message={message}
            onApplyRoute={message.role === 'assistant' ? handleApplyRoute : undefined}
          />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="animate-pulse">●</span>
            <span>Generating...</span>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your route..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button type="button" variant="secondary" onClick={cancel}>
              Stop
            </Button>
          ) : (
            <Button type="submit" variant="primary" disabled={!input.trim()}>
              Send
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function convertToCreateRouteInput(route: AIGeneratedRoute): Partial<CreateRouteInput> {
  return {
    name: route.name,
    description: route.description,
    protocol: route.protocol || 'http',
    securityMode: route.securityMode || 'general',
    config: route.config,
  };
}
