import { PublicHeader } from '@/components/layout/public-header';

export default function PublicContestSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
    </div>
  );
}
