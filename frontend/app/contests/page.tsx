import { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ContestGrid } from '@/components/contests/contest-grid';

export const metadata: Metadata = {
  title: 'Browse Contests',
  description: 'Discover and join exciting quizzes and contests across various categories.',
};

export default function ContestsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Page Header */}
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Browse Contests
            </h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Find contests that match your interests and skills. Filter by category, 
              difficulty, or search for specific topics.
            </p>
          </div>
        </section>

        {/* Contest Grid with Filters */}
        <section className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ContestGrid />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
