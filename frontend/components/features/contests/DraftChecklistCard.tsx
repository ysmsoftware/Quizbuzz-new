'use client';

import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Contest } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DraftChecklistCardProps {
  contest: Contest;
  onPublish: () => Promise<void>;
  isPublishing?: boolean;
  className?: string;
}

export function DraftChecklistCard({ contest, onPublish, isPublishing = false, className }: DraftChecklistCardProps) {
  const requirements = [
    { 
      label: 'Title added', 
      met: !!contest.title.trim() 
    },
    { 
      label: 'Start date set', 
      met: !!contest.startTime 
    },
    { 
      label: 'At least 1 rule added', 
      met: contest.rules && contest.rules.length > 0 
    },
    { 
      label: 'At least 1 prize defined', 
      met: contest.prizes && contest.prizes.length > 0 
    },
    { 
      label: `Questions added (${contest._counts?.questions || 0} of recommended 10+)`, 
      met: (contest._counts?.questions || 0) > 0,
      warning: (contest._counts?.questions || 0) < 10
    },
    { 
      label: contest.fee > 0 ? 'Fee configured' : 'Free contest toggled', 
      met: true // Based on current logic, fee is always set
    },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const totalCount = requirements.length;
  const progress = (metCount / totalCount) * 100;
  const allMet = metCount === totalCount;

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-primary/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Publish Checklist</CardTitle>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
            {metCount}/{totalCount}
          </span>
        </div>
        <CardDescription>Complete all steps to launch your contest</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Progress value={progress} className="h-2" />
          <p className="text-[10px] text-muted-foreground text-right font-medium">
            {Math.round(progress)}% Complete
          </p>
        </div>

        <div className="space-y-3">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                req.met ? "bg-green-500 text-white" : "bg-muted text-muted-foreground/30"
              )}>
                {req.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                req.met ? "text-foreground" : "text-muted-foreground",
                req.met && req.warning && "text-orange-600 dark:text-orange-400"
              )}>
                {req.label}
                {req.met && req.warning && (
                  <AlertTriangle className="inline-block h-3 w-3 ml-1 mb-0.5" />
                )}
              </span>
            </div>
          ))}
        </div>

        <Button 
          className="w-full h-11 font-bold shadow-lg shadow-primary/20" 
          disabled={!allMet || isPublishing}
          onClick={onPublish}
        >
          {isPublishing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            'Publish Contest'
          )}
        </Button>
        
        {!allMet && (
          <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-wider">
            Please complete all requirements above
          </p>
        )}
      </CardContent>
    </Card>
  );
}
