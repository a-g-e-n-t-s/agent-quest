/**
 * DiffViewer — Shows text differences in split, unified, or inline mode.
 * Computes diff internally from oldText/newText using the `diff` library.
 * Styled for agent-quest dark theme.
 */

import { useMemo, useState } from 'react';
import { structuredPatch, diffChars } from 'diff';

// ============================================================================
// Types
// ============================================================================

export type DiffMode = 'split' | 'unified' | 'inline';

interface DiffLine {
  type: 'add' | 'delete' | 'normal';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export interface DiffViewerProps {
  oldText: string;
  newText: string;
  mode?: DiffMode;
  onModeChange?: (mode: DiffMode) => void;
  className?: string;
}

// ============================================================================
// Diff computation
// ============================================================================

function computeDiff(oldText: string, newText: string): { lines: DiffLine[]; stats: DiffStats } {
  const patch = structuredPatch('old', 'new', oldText, newText, '', '', { context: 3 });
  const lines: DiffLine[] = [];
  const stats: DiffStats = { additions: 0, deletions: 0, unchanged: 0 };

  for (const hunk of patch.hunks) {
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        lines.push({ type: 'add', content: line.slice(1), newLineNumber: newLine++ });
        stats.additions++;
      } else if (line.startsWith('-')) {
        lines.push({ type: 'delete', content: line.slice(1), oldLineNumber: oldLine++ });
        stats.deletions++;
      } else {
        lines.push({ type: 'normal', content: line.slice(1), oldLineNumber: oldLine++, newLineNumber: newLine++ });
        stats.unchanged++;
      }
    }
  }

  return { lines, stats };
}

// ============================================================================
// Sub-components
// ============================================================================

function StatsBar({ stats }: { stats: DiffStats }) {
  const total = stats.additions + stats.deletions;
  if (total === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-tertiary">
        <svg className="w-4 h-4 text-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        No changes
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      {stats.additions > 0 && (
        <span className="text-green font-medium">+{stats.additions}</span>
      )}
      {stats.deletions > 0 && (
        <span className="text-red font-medium">-{stats.deletions}</span>
      )}
      <span className="text-text-tertiary">{total} change{total !== 1 ? 's' : ''}</span>
    </div>
  );
}

function LineNumber({ num }: { num?: number }) {
  return (
    <div className="w-10 px-2 py-0.5 text-[10px] text-text-tertiary font-mono tabular-nums text-right border-r border-border select-none flex-shrink-0">
      {num ?? ''}
    </div>
  );
}

function ModeToggle({ mode, onModeChange }: { mode: DiffMode; onModeChange?: (m: DiffMode) => void }) {
  return (
    <div className="flex gap-1">
      {(['split', 'unified', 'inline'] as DiffMode[]).map(m => (
        <button
          key={m}
          onClick={() => onModeChange?.(m)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            mode === m ? 'bg-blue text-white' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated'
          }`}
        >
          {m.charAt(0).toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Unified View
// ============================================================================

function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="divide-y divide-border/30">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex min-h-[1.5rem] ${
            line.type === 'add' ? 'bg-green/10 border-l-2 border-green' :
            line.type === 'delete' ? 'bg-red/10 border-l-2 border-red' :
            'bg-bg-elevated'
          }`}
        >
          <LineNumber num={line.oldLineNumber} />
          <LineNumber num={line.newLineNumber} />
          <div className="w-5 px-1 py-0.5 text-[10px] font-mono text-center text-text-tertiary select-none flex-shrink-0">
            {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
          </div>
          <div className="flex-1 px-3 py-0.5 min-w-0">
            <pre className={`whitespace-pre-wrap font-mono text-xs break-words ${
              line.type === 'add' ? 'text-green' :
              line.type === 'delete' ? 'text-red' :
              'text-text-primary'
            }`}>
              {line.content}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Split View
// ============================================================================

function SplitView({ lines }: { lines: DiffLine[] }) {
  const leftLines = lines.filter(l => l.type !== 'add');
  const rightLines = lines.filter(l => l.type !== 'delete');

  return (
    <div className="grid grid-cols-2 divide-x divide-border">
      {/* Left: Original */}
      <div>
        <div className="bg-red/10 px-3 py-1 text-[10px] font-medium text-red border-b border-border uppercase tracking-wider">
          Original
        </div>
        <div className="divide-y divide-border/30">
          {leftLines.map((line, i) => (
            <div
              key={i}
              className={`flex min-h-[1.5rem] ${
                line.type === 'delete' ? 'bg-red/10' : 'bg-bg-elevated'
              }`}
            >
              <LineNumber num={line.oldLineNumber} />
              <div className="flex-1 px-3 py-0.5 min-w-0">
                <pre className={`whitespace-pre-wrap font-mono text-xs break-words ${
                  line.type === 'delete' ? 'text-red' : 'text-text-primary'
                }`}>
                  {line.content}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Updated */}
      <div>
        <div className="bg-green/10 px-3 py-1 text-[10px] font-medium text-green border-b border-border uppercase tracking-wider">
          Updated
        </div>
        <div className="divide-y divide-border/30">
          {rightLines.map((line, i) => (
            <div
              key={i}
              className={`flex min-h-[1.5rem] ${
                line.type === 'add' ? 'bg-green/10' : 'bg-bg-elevated'
              }`}
            >
              <LineNumber num={line.newLineNumber} />
              <div className="flex-1 px-3 py-0.5 min-w-0">
                <pre className={`whitespace-pre-wrap font-mono text-xs break-words ${
                  line.type === 'add' ? 'text-green' : 'text-text-primary'
                }`}>
                  {line.content}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline View (character-level diff)
// ============================================================================

function InlineView({ oldText, newText }: { oldText: string; newText: string }) {
  const charDiff = useMemo(() => diffChars(oldText, newText), [oldText, newText]);

  return (
    <div className="p-4">
      <pre className="whitespace-pre-wrap font-mono text-xs break-words leading-relaxed">
        {charDiff.map((part, i) => (
          <span
            key={i}
            className={
              part.added ? 'bg-green/20 text-green' :
              part.removed ? 'bg-red/20 text-red line-through' :
              'text-text-primary'
            }
          >
            {part.value}
          </span>
        ))}
      </pre>
    </div>
  );
}

// ============================================================================
// DiffViewer Component
// ============================================================================

export function DiffViewer({
  oldText,
  newText,
  mode: controlledMode,
  onModeChange,
  className = '',
}: DiffViewerProps) {
  const [internalMode, setInternalMode] = useState<DiffMode>('unified');
  const mode = controlledMode ?? internalMode;
  const handleModeChange = onModeChange ?? setInternalMode;

  const { lines, stats } = useMemo(() => computeDiff(oldText, newText), [oldText, newText]);

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-card border-b border-border">
        <StatsBar stats={stats} />
        <ModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Content */}
      <div className="overflow-auto max-h-[70vh] bg-bg-elevated">
        {mode === 'unified' && <UnifiedView lines={lines} />}
        {mode === 'split' && <SplitView lines={lines} />}
        {mode === 'inline' && <InlineView oldText={oldText} newText={newText} />}
      </div>
    </div>
  );
}
