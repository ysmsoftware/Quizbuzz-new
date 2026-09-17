import type { ReactNode } from 'react';

// Shared between the public contest page (components/contests/contest-details.tsx)
// and the org-side "Full Details" editor (components/features/contests/
// ContestDetailsCard.tsx) so a change to one renders identically in the other —
// the whole point of previewing markdown while editing is that it matches what
// participants will actually see.
export const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-xl font-bold text-foreground mt-5 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="leading-relaxed mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-5 space-y-1 mb-3 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-1 mb-3 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono">{children}</code>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground/90 my-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border/50" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/50">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-border/50 px-2 py-1">{children}</td>
  ),
};
