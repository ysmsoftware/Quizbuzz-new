import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return <WidgetErrorBoundary name="Ambassador">{children}</WidgetErrorBoundary>;
}
