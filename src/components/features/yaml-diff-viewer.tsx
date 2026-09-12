'use client';

import { useMemo } from 'react';

interface YamlDiffViewerProps {
  currentYaml?: string;
  proposedYaml: string;
  mode?: 'create' | 'update' | 'delete';
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'header';
  content: string;
  lineNumber?: number;
}

/**
 * Generates a unified diff between two YAML strings
 */
function generateDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  // Simple line-by-line diff using LCS-like approach
  const diff: DiffLine[] = [];

  // Create a map of old lines for quick lookup
  const oldLinesSet = new Set(oldLines);
  const newLinesSet = new Set(newLines);

  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex];
    const newLine = newLines[newIndex];

    if (oldIndex >= oldLines.length) {
      // Remaining new lines are additions
      diff.push({ type: 'added', content: newLine, lineNumber: newIndex + 1 });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Remaining old lines are removals
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIndex + 1 });
      oldIndex++;
    } else if (oldLine === newLine) {
      // Lines match
      diff.push({ type: 'unchanged', content: oldLine, lineNumber: newIndex + 1 });
      oldIndex++;
      newIndex++;
    } else if (!newLinesSet.has(oldLine) && !oldLinesSet.has(newLine)) {
      // Both lines are unique - show as change (remove then add)
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIndex + 1 });
      diff.push({ type: 'added', content: newLine, lineNumber: newIndex + 1 });
      oldIndex++;
      newIndex++;
    } else if (!newLinesSet.has(oldLine)) {
      // Old line doesn't exist in new - it was removed
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIndex + 1 });
      oldIndex++;
    } else {
      // New line doesn't exist in old - it was added
      diff.push({ type: 'added', content: newLine, lineNumber: newIndex + 1 });
      newIndex++;
    }
  }

  return diff;
}

export function YamlDiffViewer({ currentYaml, proposedYaml, mode = 'update' }: YamlDiffViewerProps) {
  const diffLines = useMemo(() => {
    if (mode === 'create') {
      // For create, show all lines as added
      return proposedYaml.split('\n').map((line, idx) => ({
        type: 'added' as const,
        content: line,
        lineNumber: idx + 1,
      }));
    } else if (mode === 'delete') {
      // For delete, show all lines as removed
      return (currentYaml || '').split('\n').map((line, idx) => ({
        type: 'removed' as const,
        content: line,
        lineNumber: idx + 1,
      }));
    } else {
      // For update, generate actual diff
      return generateDiff(currentYaml || '', proposedYaml);
    }
  }, [currentYaml, proposedYaml, mode]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    const unchanged = diffLines.filter(l => l.type === 'unchanged').length;
    return { added, removed, unchanged };
  }, [diffLines]);

  return (
    <div className="font-mono text-sm">
      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <span className="text-gray-500">Changes:</span>
        {stats.added > 0 && (
          <span className="text-green-600">+{stats.added} additions</span>
        )}
        {stats.removed > 0 && (
          <span className="text-red-600">-{stats.removed} deletions</span>
        )}
        {stats.unchanged > 0 && mode === 'update' && (
          <span className="text-gray-500">{stats.unchanged} unchanged</span>
        )}
      </div>

      {/* Diff content */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {diffLines.map((line, idx) => (
                <tr
                  key={idx}
                  className={`
                    ${line.type === 'added' ? 'bg-green-900/30' : ''}
                    ${line.type === 'removed' ? 'bg-red-900/30' : ''}
                  `}
                >
                  {/* Line indicator */}
                  <td className="w-8 text-center select-none px-2 py-0.5">
                    {line.type === 'added' && (
                      <span className="text-green-400 font-bold">+</span>
                    )}
                    {line.type === 'removed' && (
                      <span className="text-red-400 font-bold">-</span>
                    )}
                    {line.type === 'unchanged' && (
                      <span className="text-gray-600">&nbsp;</span>
                    )}
                  </td>

                  {/* Content */}
                  <td
                    className={`
                      px-2 py-0.5 whitespace-pre
                      ${line.type === 'added' ? 'text-green-300' : ''}
                      ${line.type === 'removed' ? 'text-red-300' : ''}
                      ${line.type === 'unchanged' ? 'text-gray-300' : ''}
                    `}
                  >
                    {line.content || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Side-by-side YAML viewer (for simple before/after comparison)
 */
export function YamlSideBySideViewer({
  currentYaml,
  proposedYaml,
  currentLabel = 'Current',
  proposedLabel = 'Proposed'
}: {
  currentYaml?: string;
  proposedYaml: string;
  currentLabel?: string;
  proposedLabel?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Current */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">{currentLabel}</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm h-96 overflow-y-auto">
          {currentYaml || '(none)'}
        </pre>
      </div>

      {/* Proposed */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">{proposedLabel}</h4>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm h-96 overflow-y-auto">
          {proposedYaml}
        </pre>
      </div>
    </div>
  );
}
