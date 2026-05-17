'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Home, LayoutDashboard, Calendar, Share2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function RegistrationSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const registrationRef = searchParams.get('ref');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-background/50 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl overflow-hidden text-center">
            <div className="p-12 space-y-8">
              <div className="h-24 w-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight">Registration Confirmed!</h1>
                <p className="text-muted-foreground leading-relaxed">
                  You have successfully registered for the contest. A confirmation email with all the details and next steps has been sent to your inbox.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50 relative group">
                <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-bold">Registration Reference</p>
                <p className="text-4xl font-mono font-bold tracking-widest text-primary">{registrationRef || 'QB-XXXX-XXXXX'}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">Add to</p>
                    <p className="text-sm font-semibold">Google Calendar</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <Download className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">Download</p>
                    <p className="text-sm font-semibold">Registration Slip</p>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row gap-4">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl gap-2"
                  onClick={() => router.push('/')}
                >
                  <Home className="h-4 w-4" />
                  Back to Home
                </Button>
                <Button
                  className="flex-1 h-12 rounded-xl gap-2"
                  onClick={() => router.push('/dashboard')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              </div>

              <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto">
                <Share2 className="h-4 w-4" />
                Invite your friends to participate
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
