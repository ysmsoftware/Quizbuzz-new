'use client';

import React, { ReactNode, ReactElement } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactElement;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error) {
    console.error('[v0] ErrorBoundary caught:', error);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="space-y-4 max-w-md text-center">
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-6">
                  <AlertTriangle className="h-12 w-12 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground">Component Error</h1>
              <p className="text-muted-foreground">
                {this.state.error?.message || 'Something went wrong rendering this component.'}
              </p>
              <Button
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
