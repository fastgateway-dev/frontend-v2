'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  example?: string;
}

export function InfoTooltip({ text, example }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const rect = isVisible ? triggerRef.current?.getBoundingClientRect() : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex ml-1 align-middle"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <Info className="h-4 w-4 text-gray-400 cursor-help" />
      </span>
      {isVisible && rect &&
        createPortal(
          <span
            className="fixed w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-[9999] pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left + rect.width / 2,
              transform: 'translate(-50%, -100%) translateY(-8px)',
            }}
          >
            <span className="block">{text}</span>
            {example && (
              <span className="block mt-1.5 font-mono text-gray-300 bg-gray-800 px-2 py-1 rounded text-[11px] break-all">
                {example}
              </span>
            )}
            <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </span>,
          document.body
        )}
    </>
  );
}
