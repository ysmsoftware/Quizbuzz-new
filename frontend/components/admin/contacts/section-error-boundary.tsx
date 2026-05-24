'use client';

import React, { ReactNode, ErrorInfo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.sectionTitle || 'section'}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Card className="bg-destructive/5 border-destructive/20 rounded-4xl">
            <CardContent className="p-8 flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-destructive shrink-0" />
              <div>
                <p className="font-bold text-destructive mb-1">
                  {this.props.sectionTitle || 'Section'} Error
                </p>
                <p className="text-sm text-muted-foreground">
                  Failed to load this section. Please try refreshing the page.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      );
    }

    return this.props.children;
  }
}
