import { useState, useCallback, useRef, useEffect } from 'react';
import { aiApi } from '@/lib/api/ai';
import type { AIStreamChunk, AIChatMessage, AIChatContext } from '@/types';

interface ChatDisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseAIChatReturn {
  messages: ChatDisplayMessage[];
  isStreaming: boolean;
  error: string | null;
  send: (message: string, context?: AIChatContext) => void;
  cancel: () => void;
  clearMessages: () => void;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentContentRef = useRef<string>('');
  const messagesRef = useRef<ChatDisplayMessage[]>([]);

  // Keep ref in sync with state for reading in send()
  messagesRef.current = messages;

  // Cleanup on unmount: abort any in-flight request
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const send = useCallback((message: string, context?: AIChatContext) => {
    setError(null);
    setIsStreaming(true);
    currentContentRef.current = '';

    // Build history from current messages (via ref, no stale closure)
    const history: AIChatMessage[] = messagesRef.current.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Add user message and assistant placeholder
    const userMessage: ChatDisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatDisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);

    // Start API call outside of state updater
    controllerRef.current = aiApi.chat(
      { message, context, history },
      (chunk: AIStreamChunk) => {
        switch (chunk.type) {
          case 'content':
            currentContentRef.current += chunk.content || '';
            setMessages(msgs =>
              msgs.map(m =>
                m.id === assistantId
                  ? { ...m, content: currentContentRef.current }
                  : m
              )
            );
            break;
          case 'error':
            setError(chunk.error || 'An error occurred');
            setIsStreaming(false);
            break;
          case 'done':
            setIsStreaming(false);
            break;
        }
      },
      (err) => {
        setError(err.message);
        setIsStreaming(false);
      },
      () => {
        setIsStreaming(false);
      }
    );
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    send,
    cancel,
    clearMessages,
  };
}
