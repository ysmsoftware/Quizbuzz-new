'use client';

// ═══════════════════════════════════════════════════════
// QuestionTextEditor — plain textarea + a small formatting toolbar
// (bold/italic/inline-code/code-block/formula) that inserts markdown
// at the cursor, plus a live preview toggle using QuestionRenderer.
//
// Shared by every question-text field (create form, edit dialog,
// per-contest question modal) so the authoring experience — and the
// markdown convention it teaches — stays identical everywhere.
// ═══════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { Bold, Italic, Code, SquareCode, Sigma, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuestionRenderer } from '@/components/shared/QuestionRenderer';
import { cn } from '@/lib/utils';

interface QuestionTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string, placeholder: string) {
  const { selectionStart, selectionEnd, value } = textarea;
  const hasSelection = selectionEnd > selectionStart;
  const selected = hasSelection ? value.slice(selectionStart, selectionEnd) : placeholder;
  const newValue = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  return {
    newValue,
    cursorStart: selectionStart + before.length,
    cursorEnd: selectionStart + before.length + selected.length,
  };
}

export function QuestionTextEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeightClassName = 'min-h-[100px]',
  className,
}: QuestionTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Editing an existing question (mounts with content already in it) opens
  // rendered, so a saved code block/formula shows formatted rather than as
  // raw backticks — a brand-new question (mounts blank) opens in edit mode
  // since there's nothing yet to preview.
  const [showPreview, setShowPreview] = useState(() => Boolean(value?.trim()));

  const applyWrap = (before: string, after: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { newValue, cursorStart, cursorEnd } = wrapSelection(textarea, before, after, placeholder);
    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-input/60 bg-muted/20 p-1">
        <ToolbarButton title="Bold" onClick={() => applyWrap('**', '**', 'bold text')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => applyWrap('*', '*', 'italic text')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Inline code" onClick={() => applyWrap('`', '`', 'code')}>
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Code block" onClick={() => applyWrap('\n```\n', '\n```\n', 'code here')}>
          <SquareCode className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Formula" onClick={() => applyWrap('$', '$', 'x^2')}>
          <Sigma className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="flex-1" />
        <ToolbarButton title={showPreview ? 'Hide preview' : 'Show preview'} onClick={() => setShowPreview((s) => !s)}>
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </ToolbarButton>
      </div>

      {showPreview ? (
        <div className={cn('w-full overflow-x-auto rounded-md border border-input bg-transparent px-3 py-2 text-sm', minHeightClassName)}>
          {value.trim() ? (
            <QuestionRenderer text={value} />
          ) : (
            <span className="text-muted-foreground">Nothing to preview yet</span>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={textareaRef}
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            minHeightClassName
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Use <code className="rounded bg-muted px-1 py-0.5">`backticks`</code> for inline code, triple backticks for a code block, and{' '}
        <code className="rounded bg-muted px-1 py-0.5">$formula$</code> for math.
      </p>
    </div>
  );
}

function ToolbarButton({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" title={title} onClick={onClick}>
      {children}
    </Button>
  );
}
