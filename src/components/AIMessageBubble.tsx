'use client';

import { cn } from '@/lib/utils/cn';
import type { AIMessage, AIWarning } from '@/types';

interface AIMessageBubbleProps {
  message: AIMessage;
  onApplyRoute?: (routeIndex: number) => void;
}

export function AIMessageBubble({ message, onApplyRoute }: AIMessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-2',
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        )}
      >
        <div className="whitespace-pre-wrap text-sm">{message.content}</div>

        {message.routes && message.routes.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.routes.map((route, index) => (
              <div
                key={index}
                className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{route.name}</span>
                  {onApplyRoute && (
                    <button
                      onClick={() => onApplyRoute(index)}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Apply to Form
                    </button>
                  )}
                </div>
                {route.description && (
                  <p className="text-xs text-gray-500 mt-1">{route.description}</p>
                )}
                {route.warnings && route.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {route.warnings.map((warning, wIndex) => (
                      <WarningBadge key={wIndex} warning={warning} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WarningBadge({ warning }: { warning: AIWarning }) {
  const icon = warning.severity === 'warning' ? '⚠️' : 'ℹ️';
  return (
    <div className="flex items-start gap-1 text-xs">
      <span>{icon}</span>
      <span className="text-gray-600 dark:text-gray-400">{warning.message}</span>
    </div>
  );
}
