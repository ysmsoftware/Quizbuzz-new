'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Admin Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center space-y-6 animate-in fade-in duration-500">
      <div className="h-20 w-20 rounded-[2rem] bg-destructive/10 flex items-center justify-center text-destructive shadow-2xl shadow-destructive/10">
        <AlertCircle className="h-10 w-10" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-black tracking-tight">Something went wrong!</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          An unexpected error occurred in the administration panel. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground mt-4 uppercase tracking-widest">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button 
          onClick={() => reset()}
          className="rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20"
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button 
          variant="outline" 
          asChild
          className="rounded-xl h-12 px-8 border-border/50 font-bold"
        >
          <Link href="/admin">
            <Home className="h-4 w-4 mr-2" />
            Admin Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
