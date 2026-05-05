import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RichMarkdown } from './RichMarkdown';
import { DiffViewer } from './DiffViewer';

// ============================================================================
// Types
// ============================================================================

export type ViewMode = 'preview' | 'annotate' | 'side-by-side' | 'diff';

export interface Annotation {
  id: string;
  type: 'selection' | 'general';
  comment: string;
  timestamp: string;
  selectedText?: string;
  color?: { bg: string; border: string; hex: string };
  startOffset?: number;
  endOffset?: number;
}

// ============================================================================
// Utilities
// ============================================================================

function hexToColor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { bg: `rgba(${r}, ${g}, ${b}, 0.3)`, border: hex, hex };
}

function isValidHex(hex: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function generateId() {
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const PRESET_COLORS = ['#FFEB3B', '#4FC3F7', '#81C784', '#E57373', '#CE93D8', '#FFB74D'];

// ============================================================================
// AnnotatedText — renders content with colored highlights
// ============================================================================

function AnnotatedText({
  content,
  annotations,
  onSelect,
  onClickAnnotation,
}: {
  content: string;
  annotations: Annotation[];
  onSelect: (text: string, start: number, end: number) => void;
  onClickAnnotation: (annotation: Annotation) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) return;

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) return;

    // Calculate offset within the plain text content
    const preRange = document.createRange();
    preRange.selectNodeContents(containerRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;
    const text = selection.toString();
    const end = start + text.length;

    if (text.trim().length > 0) {
      onSelect(text, start, end);
      selection.removeAllRanges();
    }
  }, [onSelect]);

  // Build segments: split content into annotated and plain parts
  const segments = useMemo(() => {
    const selectionAnnotations = annotations
      .filter(a => a.type === 'selection' && a.startOffset !== undefined && a.endOffset !== undefined)
      .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));

    if (selectionAnnotations.length === 0) {
      return [{ text: content, annotation: null, start: 0 }];
    }

    const result: { text: string; annotation: Annotation | null; start: number }[] = [];
    let cursor = 0;

    for (const ann of selectionAnnotations) {
      const start = ann.startOffset!;
      const end = ann.endOffset!;
      if (start > cursor) {
        result.push({ text: content.slice(cursor, start), annotation: null, start: cursor });
      }
      result.push({ text: content.slice(start, end), annotation: ann, start });
      cursor = end;
    }
    if (cursor < content.length) {
      result.push({ text: content.slice(cursor), annotation: null, start: cursor });
    }
    return result;
  }, [content, annotations]);

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="font-mono text-[0.8rem] leading-[1.7] whitespace-pre-wrap break-words text-text-primary select-text cursor-text"
    >
      {segments.map((seg, i) =>
        seg.annotation ? (
          <mark
            key={i}
            onClick={() => onClickAnnotation(seg.annotation!)}
            className="cursor-pointer rounded-sm px-0.5 transition-opacity hover:opacity-80"
            style={{ backgroundColor: seg.annotation.color?.bg, borderBottom: `2px solid ${seg.annotation.color?.border}` }}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  );
}

// ============================================================================
// CommentModal
// ============================================================================

function CommentModal({
  isOpen,
  onClose,
  onSave,
  selectedText,
  initialColor,
  initialComment,
  isEditing,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (comment: string, color: { bg: string; border: string; hex: string }) => void;
  selectedText: string;
  initialColor: string;
  initialComment: string;
  isEditing: boolean;
}) {
  const [comment, setComment] = useState(initialComment);
  const [colorHex, setColorHex] = useState(initialColor);
  const color = useMemo(() => hexToColor(colorHex), [colorHex]);

  useEffect(() => {
    setComment(initialComment);
    setColorHex(initialColor);
  }, [initialComment, initialColor, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (comment.trim()) {
      onSave(comment.trim(), hexToColor(colorHex));
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {isEditing ? 'Edit Comment' : 'Add Comment'}
            </h3>
            <p className="text-sm text-text-tertiary mt-0.5">Highlight text and add your feedback</p>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 border-b border-border">
          <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Selected Text</label>
          <div className="p-3 rounded-lg border-2 text-sm leading-relaxed max-h-28 overflow-y-auto" style={{ backgroundColor: color.bg, borderColor: color.border }}>
            <pre className="whitespace-pre-wrap font-mono text-text-primary break-words m-0 text-xs">{selectedText}</pre>
          </div>
        </div>

        <div className="px-5 pt-4 pb-2">
          <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Highlight Color</label>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColorHex(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${colorHex === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input type="color" value={colorHex} onChange={(e) => { if (isValidHex(e.target.value)) setColorHex(e.target.value.toUpperCase()); }} className="w-7 h-7 border border-border rounded cursor-pointer" />
            <input type="text" value={colorHex} onChange={(e) => { if (isValidHex(e.target.value)) setColorHex(e.target.value.toUpperCase()); }} className="w-20 px-2 py-1 text-xs border border-border rounded bg-bg-elevated text-text-primary font-mono uppercase" maxLength={7} />
          </div>
        </div>

        <div className="p-5 flex-1">
          <label className="block text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Your Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what needs to change..."
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-bg-elevated text-text-primary placeholder-text-tertiary focus:ring-2 focus:ring-blue/50 focus:border-blue resize-none text-sm leading-relaxed min-h-[100px]"
            autoFocus
          />
          <p className="text-xs text-text-tertiary mt-1.5">Ctrl+Enter to save</p>
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border bg-bg-elevated/50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!comment.trim()} className="px-4 py-2 bg-blue text-white rounded-lg text-sm hover:bg-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isEditing ? 'Update' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// useScrollSync Hook
// ============================================================================

function useScrollSync(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const scrollingRef = useRef<'left' | 'right' | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const sync = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
    if (!enabled) return;
    const srcMax = source.scrollHeight - source.clientHeight;
    const tgtMax = target.scrollHeight - target.clientHeight;
    if (srcMax <= 0 || tgtMax <= 0) return;
    target.scrollTop = (source.scrollTop / srcMax) * tgtMax;
  }, [enabled]);

  const handleLeftScroll = useCallback(() => {
    if (!enabled || scrollingRef.current === 'right') return;
    scrollingRef.current = 'left';
    if (leftRef.current && rightRef.current) sync(leftRef.current, rightRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => { scrollingRef.current = null; }, 100);
  }, [enabled, sync]);

  const handleRightScroll = useCallback(() => {
    if (!enabled || scrollingRef.current === 'left') return;
    scrollingRef.current = 'right';
    if (leftRef.current && rightRef.current) sync(rightRef.current, leftRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => { scrollingRef.current = null; }, 100);
  }, [enabled, sync]);

  return { leftRef, rightRef, handleLeftScroll, handleRightScroll };
}

// ============================================================================
// TextAnnotator Component
// ============================================================================

export interface TextAnnotatorProps {
  content: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  /** Previous version of content for diff view (only shown when provided) */
  previousContent?: string;
}

export function TextAnnotator({
  content,
  annotations,
  onAnnotationsChange,
  viewMode = 'annotate',
  onViewModeChange,
  previousContent,
}: TextAnnotatorProps) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    selectedText: string;
    isEditing: boolean;
    editingAnnotation?: Annotation;
    startOffset?: number;
    endOffset?: number;
  }>({ isOpen: false, selectedText: '', isEditing: false });

  const { leftRef, rightRef, handleLeftScroll, handleRightScroll } = useScrollSync({ enabled: viewMode === 'side-by-side' });

  const handleSelect = useCallback((text: string, start: number, end: number) => {
    setModalState({ isOpen: true, selectedText: text, isEditing: false, startOffset: start, endOffset: end });
  }, []);

  const handleClickAnnotation = useCallback((ann: Annotation) => {
    if (ann.selectedText && ann.color) {
      setModalState({ isOpen: true, selectedText: ann.selectedText, isEditing: true, editingAnnotation: ann, startOffset: ann.startOffset, endOffset: ann.endOffset });
    }
  }, []);

  const handleModalSave = (comment: string, color: { bg: string; border: string; hex: string }) => {
    if (modalState.isEditing && modalState.editingAnnotation) {
      onAnnotationsChange(annotations.map(a =>
        a.id === modalState.editingAnnotation!.id ? { ...a, comment, color, timestamp: new Date().toISOString() } : a
      ));
    } else {
      onAnnotationsChange([...annotations, {
        id: generateId(),
        type: 'selection',
        comment,
        timestamp: new Date().toISOString(),
        selectedText: modalState.selectedText,
        color,
        startOffset: modalState.startOffset,
        endOffset: modalState.endOffset,
      }]);
    }
  };

  const addGeneralComment = () => {
    const comment = prompt('Enter general comment:');
    if (comment?.trim()) {
      onAnnotationsChange([...annotations, { id: generateId(), type: 'general', comment: comment.trim(), timestamp: new Date().toISOString() }]);
    }
  };

  const removeAnnotation = (id: string) => {
    onAnnotationsChange(annotations.filter(a => a.id !== id));
  };

  // ── Render: Comments List ──
  const renderComments = () => (
    <div className="space-y-3">
      {annotations.length === 0 ? (
        <div className="text-center py-8 text-text-tertiary text-sm">
          <p className="font-medium">No comments yet</p>
          <p className="text-xs mt-1">Select text to add annotations</p>
        </div>
      ) : (
        annotations.map(a => (
          <div key={a.id} className="bg-bg-elevated rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-bg-card border-b border-border">
              <div className="flex items-center gap-2">
                {a.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color.bg, border: `1px solid ${a.color.border}` }} />}
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  {a.type === 'selection' ? 'Text Selection' : 'General'}
                </span>
              </div>
              <button onClick={() => removeAnnotation(a.id)} className="p-1 text-text-tertiary hover:text-red transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="p-3 space-y-2">
              {a.selectedText && (
                <div className="rounded border p-2 text-xs" style={{ backgroundColor: a.color?.bg, borderColor: a.color?.border }}>
                  <pre className="whitespace-pre-wrap font-mono text-text-primary break-words m-0">{a.selectedText}</pre>
                </div>
              )}
              <p className="text-sm text-text-secondary leading-relaxed">{a.comment}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ── View Mode Tabs ──
  const renderTabs = () => {
    const modes: ViewMode[] = ['preview', 'annotate', 'side-by-side'];
    if (previousContent !== undefined) modes.push('diff');

    return (
      <div className="flex gap-1 mb-4">
        {modes.map(mode => (
          <button
            key={mode}
            onClick={() => onViewModeChange?.(mode)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              viewMode === mode ? 'bg-blue text-white' : 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            {mode === 'side-by-side' ? 'Side by Side' : mode === 'diff' ? 'Changes' : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
    );
  };

  // ── Layout: Diff ──
  if (viewMode === 'diff' && previousContent !== undefined) {
    return (
      <div>
        {renderTabs()}
        <DiffViewer oldText={previousContent} newText={content} />
      </div>
    );
  }

  // ── Layout: Side-by-Side ──
  if (viewMode === 'side-by-side') {
    return (
      <div className="flex flex-col gap-4">
        {renderTabs()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[60vh]">
          <div className="flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-bg-card border-b border-border flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-xs font-medium text-text-tertiary">Source (select text to annotate)</span>
            </div>
            <div ref={leftRef} onScroll={handleLeftScroll} className="flex-1 overflow-auto p-3 bg-bg-elevated">
              <AnnotatedText content={content} annotations={annotations} onSelect={handleSelect} onClickAnnotation={handleClickAnnotation} />
            </div>
          </div>
          <div className="flex flex-col border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-bg-card border-b border-border flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-xs font-medium text-text-tertiary">Preview</span>
            </div>
            <div ref={rightRef} onScroll={handleRightScroll} className="flex-1 overflow-auto p-4">
              <RichMarkdown>{content}</RichMarkdown>
            </div>
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-text-primary">Comments ({annotations.length})</h4>
            <button onClick={addGeneralComment} className="px-3 py-1.5 bg-blue text-white rounded-md text-xs hover:bg-blue/90 transition-colors">+ General Comment</button>
          </div>
          {renderComments()}
        </div>
        <CommentModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState({ isOpen: false, selectedText: '', isEditing: false })}
          onSave={handleModalSave}
          selectedText={modalState.selectedText}
          initialColor={modalState.editingAnnotation?.color?.hex || '#FFEB3B'}
          initialComment={modalState.editingAnnotation?.comment || ''}
          isEditing={modalState.isEditing}
        />
      </div>
    );
  }

  // ── Layout: Preview ──
  if (viewMode === 'preview') {
    return (
      <div>
        {renderTabs()}
        <RichMarkdown showSourceToggle>{content}</RichMarkdown>
      </div>
    );
  }

  // ── Layout: Annotate (default) ──
  return (
    <div>
      {renderTabs()}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="mb-3 p-3 bg-blue/10 border border-blue/30 rounded-lg">
            <p className="text-xs text-blue flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select text below to add annotations. Click a highlight to edit.
            </p>
          </div>
          <div className="bg-bg-elevated p-4 rounded-lg border border-border">
            <AnnotatedText content={content} annotations={annotations} onSelect={handleSelect} onClickAnnotation={handleClickAnnotation} />
          </div>
        </div>
        <div className="bg-bg-card border border-border rounded-lg p-4 self-start sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-text-primary">Comments ({annotations.length})</h4>
            <button onClick={addGeneralComment} className="px-2 py-1 bg-blue text-white rounded text-xs hover:bg-blue/90 transition-colors">+ General</button>
          </div>
          {renderComments()}
        </div>
      </div>
      <CommentModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, selectedText: '', isEditing: false })}
        onSave={handleModalSave}
        selectedText={modalState.selectedText}
        initialColor={modalState.editingAnnotation?.color?.hex || '#FFEB3B'}
        initialComment={modalState.editingAnnotation?.comment || ''}
        isEditing={modalState.isEditing}
      />
    </div>
  );
}
