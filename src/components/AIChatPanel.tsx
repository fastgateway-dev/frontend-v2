'use client';

import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '@/hooks/useAIChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { AIChatContext } from '@/types';
import { X, Trash2, MessageSquare, Loader2 } from 'lucide-react';

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  getContext: () => Promise<AIChatContext>;
}

export function AIChatPanel({ isOpen, onClose, getContext }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, error, send, cancel, clearMessages } = useAIChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || isLoadingContext) return;

    const message = input.trim();
    setInput('');
    setIsLoadingContext(true);

    try {
      const context = await getContext();
      send(message, context);
    } catch {
      // If context generation fails, send without context
      send(message);
    } finally {
      setIsLoadingContext(false);
    }
  };

  if (!isOpen) return null;

  const isBusy = isStreaming || isLoadingContext;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary-600" />
          <h3 className="font-semibold text-sm">AI Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8 space-y-2">
            <MessageSquare className="h-8 w-8 mx-auto text-gray-300" />
            <p className="font-medium">Ask me anything about your configuration</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>&quot;Will WAF block my JSON POST requests?&quot;</p>
              <p>&quot;What paranoia level should I use?&quot;</p>
              <p>&quot;Help me configure CORS for my SPA&quot;</p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2',
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            </div>
          </div>
        ))}
        {isLoadingContext && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Generating preview...</span>
          </div>
        )}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="animate-pulse">●</span>
            <span>Thinking...</span>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your configuration..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={isBusy}
          />
          {isStreaming ? (
            <Button type="button" variant="secondary" onClick={cancel}>
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!input.trim() || isLoadingContext}>
              Send
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
