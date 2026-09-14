'use client';

// ═══════════════════════════════════════════════════════
// QuestionRenderer — renders question/option text as markdown:
// `inline code`, ```fenced code blocks``` (syntax highlighted),
// and $inline$ / $$display$$ math formulas (KaTeX).
//
// Replaces raw dangerouslySetInnerHTML rendering — react-markdown
// escapes anything that isn't markdown by default, so this also
// closes the XSS gap the old rendering had.
// ═══════════════════════════════════════════════════════

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

// Registered once at module load — only the languages this domain actually
// uses, not the full Prism grammar set (keeps the play screen's bundle small).
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('sql', sql);

interface QuestionRendererProps {
  text: string;
  className?: string;
  /**
   * For short contexts (answer options): suppresses block-level output
   * (paragraph margins, fenced code blocks) since an option is a phrase,
   * not a document. Inline code/formulas still render.
   */
  inline?: boolean;
}

const blockComponents: Partial<Components> = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
  pre: ({ children }) => {
    const codeEl = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const codeClassName = codeEl?.props?.className ?? '';
    const match = /language-(\w+)/.exec(codeClassName);
    const language = match?.[1] ?? 'text';
    const codeString = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
    return (
      // The dark background lives here, on this block-level wrapper — the
      // syntax highlighter's own PreTag and CodeTag are both forced
      // transparent below. Left to its default, react-syntax-highlighter
      // paints the theme's background on the (inline, per spec) <code>
      // element itself, which renders as one separate box PER LINE hugging
      // each line's text width, not one continuous rectangle.
      <div className="mb-3 last:mb-0 overflow-x-auto rounded-xl border border-border text-left bg-[#282c34]">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          PreTag="div"
          customStyle={{ margin: 0, fontSize: '0.85rem', padding: '0.9rem 1rem', background: 'transparent' }}
          codeTagProps={{ style: { display: 'block', background: 'transparent', color: 'hsl(220, 14%, 71%)' } }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  },
  code: ({ children }) => (
    <code className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.88em]">
      {children}
    </code>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="my-3 max-h-[320px] w-full rounded-2xl object-contain" />
  ),
};

const inlineComponents: Partial<Components> = {
  p: ({ children }) => <>{children}</>,
  ul: ({ children }) => <>{children}</>,
  ol: ({ children }) => <>{children}</>,
  li: ({ children }) => <>{children} </>,
  // A fenced code block inside a short answer option renders as inline code
  // rather than a full highlighted block — options aren't documents.
  pre: ({ children }) => {
    const codeEl = children as React.ReactElement<{ children?: React.ReactNode }>;
    return (
      <code className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.88em]">
        {codeEl?.props?.children ?? children}
      </code>
    );
  },
  code: ({ children }) => (
    <code className="rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.88em]">
      {children}
    </code>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="inline-block max-h-8 align-text-bottom" />
  ),
};

export function QuestionRenderer({ text, className, inline = false }: QuestionRendererProps) {
  if (!text) return null;

  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className={cn(!inline && 'leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={inline ? inlineComponents : blockComponents}
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
