'use client';

import { useRouter, useParams } from 'next/navigation';
import { AlertOctagon, ShieldAlert, Home, HelpCircle, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function QuizDisqualifiedPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-destructive/5 backdrop-blur-xl border-destructive/20 rounded-3xl shadow-2xl overflow-hidden text-center">
            <div className="p-12 space-y-8">
              <div className="h-24 w-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
                <AlertOctagon className="h-12 w-12 text-destructive" />
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl font-extrabold tracking-tight text-destructive">Disqualified</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Your participation in this contest has been terminated due to multiple proctoring violations or a direct administrative action.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 flex items-start gap-4 text-left">
                <ShieldAlert className="h-6 w-6 text-destructive mt-1 shrink-0" />
                <div className="space-y-2">
                  <p className="font-bold text-destructive">Integrity Policy Violation</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Actions such as switching tabs, using split screens, or failing face-detection checks are logged and reviewed. Continuous violations trigger automatic disqualification.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  If you believe this was an error, you can contact the contest administrator or our support team.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl gap-2"
                    onClick={() => window.location.href = 'mailto:support@quizbuzz.com'}
                  >
                    <Mail className="h-4 w-4" />
                    Contact Support
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl gap-2"
                    onClick={() => router.push('/')}
                  >
                    <Home className="h-4 w-4" />
                    Back to Home
                  </Button>
                </div>
              </div>

              <div className="pt-8 border-t border-border/50">
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mx-auto">
                  <HelpCircle className="h-4 w-4" />
                  Read our Integrity Guidelines
                </button>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
