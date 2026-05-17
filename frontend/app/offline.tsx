import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Wifi, Home, RotateCcw } from 'lucide-react';

export default function Offline() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-warning/10 p-6">
            <Wifi className="h-12 w-12 text-warning" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">You're Offline</h1>
        <p className="text-muted-foreground">
          It looks like you've lost your internet connection. Please check your network and try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button
            size="lg"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
