import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  intro?: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the legal/policy pages (Privacy, Terms, Cookies).
 * Renders headings/paragraphs/lists with plain Tailwind utilities — the
 * project doesn't have @tailwindcss/typography installed, so we style
 * directly instead of relying on a `prose` class.
 */
export function LegalPageLayout({ title, lastUpdated, intro, children }: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
          </div>
        </section>
        <section className="py-12">
          <div
            className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-8
              [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mb-3
              [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:mb-3
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-sm [&_ul]:text-muted-foreground [&_ul]:mb-3
              [&_li]:leading-relaxed
              [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
              [&_strong]:text-foreground [&_strong]:font-semibold"
          >
            {children}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
