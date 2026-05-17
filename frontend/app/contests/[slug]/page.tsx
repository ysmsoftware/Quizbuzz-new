import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ContestDetails } from '@/components/contests/contest-details';
import { contestService } from '@/lib/services';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await contestService.getContestBySlug(slug);
  
  if (!result.success || !result.data) {
    return {
      title: 'Contest Not Found',
    };
  }

  return {
    title: result.data.title,
    description: result.data.description,
  };
}

export default async function ContestPage({ params }: PageProps) {
  const { slug } = await params;
  const result = await contestService.getContestBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <ContestDetails contest={result.data} />
      </main>
      <Footer />
    </div>
  );
}
