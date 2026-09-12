'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { diff, Diff } from 'deep-diff';
import { X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { RouteVersion } from '@/lib/api/route-versions';

interface VersionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionA: RouteVersion;
  versionB: RouteVersion;
}

interface SectionDiff {
  key: string;
  label: string;
  left: any;
  right: any;
  changes: Diff<any, any>[];
  status: 'changed' | 'added' | 'removed' | 'unchanged';
}

const SECTION_LABELS: Record<string, string> = {
  routeConfig: 'Route Config',
  securityPolicy: 'Security Policy',
  backendTrafficPolicy: 'Backend Traffic Policy',
  envoyExtensionPolicy: 'Envoy Extension Policy',
  wafPolicy: 'WAF Policy',
};

const SECTION_ORDER = [
  'routeConfig',
  'securityPolicy',
  'backendTrafficPolicy',
  'envoyExtensionPolicy',
  'wafPolicy',
];

function parseSnapshot(snapshot: any): Record<string, any> {
  if (typeof snapshot === 'string') {
    try {
      return JSON.parse(snapshot);
    } catch {
      return {};
    }
  }
  return snapshot || {};
}

// Build a map from JSON path (e.g. "backends.0.host") to line ranges in formatted JSON
function buildPathToLineMap(data: any): Map<string, { start: number; end: number }> {
  const map = new Map<string, { start: number; end: number }>();
  const lines = JSON.stringify(data, null, 2).split('\n');

  function walk(obj: any, path: string[], startLine: number): number {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return startLine;
    }

    const entries = Array.isArray(obj) ? obj.map((v, i) => [String(i), v]) : Object.entries(obj);

    for (const [key, value] of entries) {
      const fullPath = [...path, key].join('.');
      // Find the line that starts this key's entry
      const keyStr = Array.isArray(obj) ? null : `"${key}"`;
      let keyLine = startLine;

      if (keyStr) {
        for (let i = startLine; i < lines.length; i++) {
          if (lines[i].includes(keyStr)) {
            keyLine = i;
            startLine = i;
            break;
          }
        }
      } else {
        // Array element — advance past structural lines
        keyLine = startLine;
      }

      if (value !== null && typeof value === 'object') {
        // Find the opening brace/bracket
        let openLine = keyLine;
        for (let i = keyLine; i < lines.length; i++) {
          if (lines[i].includes('{') || lines[i].includes('[')) {
            openLine = i;
            break;
          }
        }
        // Find matching close by counting braces
        let depth = 0;
        let closeLine = openLine;
        for (let i = openLine; i < lines.length; i++) {
          for (const ch of lines[i]) {
            if (ch === '{' || ch === '[') depth++;
            if (ch === '}' || ch === ']') depth--;
          }
          if (depth === 0) {
            closeLine = i;
            break;
          }
        }
        map.set(fullPath, { start: keyLine, end: closeLine });
        // Recurse into nested object
        walk(value, [...path, key], openLine + 1);
        startLine = closeLine + 1;
      } else {
        map.set(fullPath, { start: keyLine, end: keyLine });
        startLine = keyLine + 1;
      }
    }

    return startLine;
  }

  walk(data, [], 0);
  return map;
}

function getChangedPaths(changes: Diff<any, any>[]): string[] {
  const paths: string[] = [];
  for (const change of changes) {
    if (change.kind === 'A' && change.path) {
      paths.push([...change.path, change.index].join('.'));
    } else if (change.path) {
      paths.push(change.path.join('.'));
    }
  }
  return paths;
}

function buildLineHighlights(
  data: any,
  changes: Diff<any, any>[],
  side: 'left' | 'right'
): Map<number, 'added' | 'removed'> {
  const highlighted = new Map<number, 'added' | 'removed'>();
  if (!data || changes.length === 0) return highlighted;

  const pathMap = buildPathToLineMap(data);
  const changedPaths = getChangedPaths(changes);
  const color: 'added' | 'removed' = side === 'left' ? 'removed' : 'added';

  for (const path of changedPaths) {
    // Check exact path and all parent paths that contain this change
    const range = pathMap.get(path);
    if (range) {
      for (let i = range.start; i <= range.end; i++) {
        highlighted.set(i, color);
      }
    } else {
      // Path might be deeper than what's in the map (e.g. array element property)
      // Try finding the closest parent
      const parts = path.split('.');
      for (let depth = parts.length - 1; depth >= 0; depth--) {
        const parentPath = parts.slice(0, depth).join('.');
        const parentRange = pathMap.get(parentPath);
        if (parentRange) {
          for (let i = parentRange.start; i <= parentRange.end; i++) {
            highlighted.set(i, color);
          }
          break;
        }
      }
    }
  }

  return highlighted;
}

function DiffJsonView({
  data,
  changes,
  side,
  emptyLabel,
}: {
  data: any;
  changes: Diff<any, any>[];
  side: 'left' | 'right';
  emptyLabel: string;
}) {
  const highlights = useMemo(
    () => buildLineHighlights(data, changes, side),
    [data, changes, side]
  );

  if (data == null) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80px] text-gray-400 text-sm italic">
        {emptyLabel}
      </div>
    );
  }

  const formatted = JSON.stringify(data, null, 2);
  const lines = formatted.split('\n');

  return (
    <pre className="text-xs font-mono leading-5 overflow-x-auto">
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            'px-3 min-h-[20px]',
            highlights.get(i) === 'removed' && 'bg-red-50 text-red-800',
            highlights.get(i) === 'added' && 'bg-green-50 text-green-800'
          )}
        >
          <span className="text-gray-400 select-none inline-block w-8 text-right mr-3">
            {i + 1}
          </span>
          {line}
        </div>
      ))}
    </pre>
  );
}

function SectionAccordion({
  section,
  versionA,
  versionB,
  defaultOpen,
}: {
  section: SectionDiff;
  versionA: RouteVersion;
  versionB: RouteVersion;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const statusBadge = () => {
    switch (section.status) {
      case 'changed':
        return <Badge variant="warning">{section.changes.length} change{section.changes.length !== 1 ? 's' : ''}</Badge>;
      case 'added':
        return <Badge variant="success">Added</Badge>;
      case 'removed':
        return <Badge variant="error">Removed</Badge>;
      case 'unchanged':
        return <Badge variant="default">Unchanged</Badge>;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-gray-500 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
          <span className="font-medium text-sm text-gray-900">{section.label}</span>
          {statusBadge()}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-200">
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-b border-gray-200">
              v{versionA.version}
              {versionA.deployer && (
                <span className="text-gray-400 ml-1">by {versionA.deployer.username}</span>
              )}
            </div>
            <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-600 border-b border-gray-200">
              v{versionB.version}
              {versionB.deployer && (
                <span className="text-gray-400 ml-1">by {versionB.deployer.username}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="overflow-auto max-h-[500px]">
              <DiffJsonView
                data={section.left}
                changes={section.changes}
                side="left"
                emptyLabel="Not present in this version"
              />
            </div>
            <div className="overflow-auto max-h-[500px]">
              <DiffJsonView
                data={section.right}
                changes={section.changes}
                side="right"
                emptyLabel="Not present in this version"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function VersionCompareModal({
  isOpen,
  onClose,
  versionA,
  versionB,
}: VersionCompareModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const sections = useMemo(() => {
    const snapshotA = parseSnapshot(versionA.configSnapshot);
    const snapshotB = parseSnapshot(versionB.configSnapshot);

    const result: SectionDiff[] = [];

    for (const key of SECTION_ORDER) {
      const left = snapshotA[key] ?? null;
      const right = snapshotB[key] ?? null;

      if (left == null && right == null) continue;

      let status: SectionDiff['status'];
      let changes: Diff<any, any>[] = [];

      if (left == null && right != null) {
        status = 'added';
      } else if (left != null && right == null) {
        status = 'removed';
      } else {
        const d = diff(left, right);
        changes = d || [];
        status = changes.length > 0 ? 'changed' : 'unchanged';
      }

      result.push({
        key,
        label: SECTION_LABELS[key] || key,
        left,
        right,
        changes,
        status,
      });
    }

    return result;
  }, [versionA, versionB]);

  const totalChanges = useMemo(
    () => sections.reduce((sum, s) => sum + (s.status !== 'unchanged' ? Math.max(s.changes.length, 1) : 0), 0),
    [sections]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-4 md:inset-8 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Comparing v{versionA.version} &rarr; v{versionB.version}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {versionA.deployer && (
                <span>{versionA.deployer.username}</span>
              )}
              <span>&rarr;</span>
              {versionB.deployer && (
                <span>{versionB.deployer.username}</span>
              )}
            </div>
            {totalChanges > 0 && (
              <Badge variant="info">
                {totalChanges} change{totalChanges !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sections.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              No configuration sections to compare.
            </div>
          ) : (
            sections.map((section) => (
              <SectionAccordion
                key={section.key}
                section={section}
                versionA={versionA}
                versionB={versionB}
                defaultOpen={section.status !== 'unchanged'}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
