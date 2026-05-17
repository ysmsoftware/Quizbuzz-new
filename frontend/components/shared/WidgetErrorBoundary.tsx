'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Standardized Error Boundary for isolated UI widgets.
 * Prevents a single failing component (e.g. a chart or list) from crashing the entire page.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in Widget [${this.props.name || 'Unknown'}]:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-destructive/20 rounded-3xl bg-destructive/5 text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-destructive">Component Failed</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Failed to load {this.props.name || 'this widget'}.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={this.handleReset}
            className="h-8 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-destructive/10 hover:text-destructive"
          >
            <RefreshCcw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
