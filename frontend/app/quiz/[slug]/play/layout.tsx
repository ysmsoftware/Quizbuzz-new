/**
 * Play-route layout — no shell, no header.
 * The parent quiz/layout.tsx wraps every other quiz route with PublicHeader.
 * This override strips it for /quiz/[slug]/play — the play page is a
 * fullscreen locked environment and must own the entire viewport.
 */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
