import { useState, useCallback, useRef } from 'react';
import { aiApi } from '@/lib/api/ai';
import type { AIGenerateMode, AIStreamChunk, AIMessage, AIGeneratedRoute, AIWarning } from '@/types';

interface UseAIGenerateOptions {
  projectId: string;
  domainId: string;
}

interface UseAIGenerateReturn {
  messages: AIMessage[];
  routes: AIGeneratedRoute[];
  warnings: AIWarning[];
  isStreaming: boolean;
  error: string | null;
  generate: (mode: AIGenerateMode, input: string, formatHint?: 'ingress' | 'istio' | 'kong') => void;
  cancel: () => void;
  clearMessages: () => void;
  applyRoute: (route: AIGeneratedRoute) => void;
}

export function useAIGenerate({ projectId, domainId }: UseAIGenerateOptions): UseAIGenerateReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [routes, setRoutes] = useState<AIGeneratedRoute[]>([]);
  const [warnings, setWarnings] = useState<AIWarning[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentContentRef = useRef<string>('');

  const generate = useCallback((mode: AIGenerateMode, input: string, formatHint?: 'ingress' | 'istio' | 'kong') => {
    // Add user message
    const userMessage: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Reset state
    setIsStreaming(true);
    setError(null);
    setRoutes([]);
    setWarnings([]);
    currentContentRef.current = '';

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    const assistantMessage: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, assistantMessage]);

    controllerRef.current = aiApi.generate(
      projectId,
      domainId,
      { mode, input, ...(formatHint ? { formatHint } : {}) },
      (chunk: AIStreamChunk) => {
        switch (chunk.type) {
          case 'content':
            currentContentRef.current += chunk.content || '';
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: currentContentRef.current }
                  : m
              )
            );
            break;
          case 'route':
            if (chunk.route) {
              setRoutes(prev => [...prev, chunk.route!]);
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, routes: [...(m.routes || []), chunk.route!] }
                    : m
                )
              );
            }
            break;
          case 'warning':
            if (chunk.warning) {
              setWarnings(prev => [...prev, chunk.warning!]);
            }
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
  }, [projectId, domainId]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setRoutes([]);
    setWarnings([]);
    setError(null);
  }, []);

  const applyRoute = useCallback((route: AIGeneratedRoute) => {
    // This will be used by parent component to apply route to form
    console.log('Apply route:', route);
  }, []);

  return {
    messages,
    routes,
    warnings,
    isStreaming,
    error,
    generate,
    cancel,
    clearMessages,
    applyRoute,
  };
}
