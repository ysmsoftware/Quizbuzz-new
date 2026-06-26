'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Rocket,
  ExternalLink,
  Settings,
  Share2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Send,
  Radio,
  Power,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Zap,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Contest, ContestPhase } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { EditContestDetailsModal } from './EditContestDetailsModal';
import { SendMessageModal } from '@/components/features/messaging/SendMessageModal';
import { resultsApi } from '@/lib/api/results-certs.api';

interface ContestActionBarProps {
  contest: Contest;
  contestPhase: ContestPhase;
  onPublish?: () => void | Promise<void>;
  isPublishing?: boolean;
  onEvaluate?: () => void | Promise<void>;
  isEvaluating?: boolean;
  onDeclareResults?: () => void | Promise<void>;
  isDeclaringResults?: boolean;
  onCancel?: (reason: string) => void;
}

export function ContestActionBar({
  contest,
  contestPhase,
  onPublish,
  isPublishing: isPublishingProp,
  onEvaluate,
  isEvaluating,
  onDeclareResults,
  isDeclaringResults,
  onCancel,
}: ContestActionBarProps) {
  const router = useRouter();
  const [localIsPublishing, setLocalIsPublishing] = useState(false);
  const publishingActive = isPublishingProp || localIsPublishing;
  const [isConfirmingPublish, setIsConfirmingPublish] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isSendMessageOpen, setIsSendMessageOpen] = useState(false);
  const [localIsDeclaringResults, setLocalIsDeclaringResults] = useState(false);
  const [isEarlyDeclareModalOpen, setIsEarlyDeclareModalOpen] = useState(false);
  const [earlyDeclareInfo, setEarlyDeclareInfo] = useState<any>(null);

  const confirmDeclareResults = async () => {
    if (onDeclareResults) {
      try {
        setLocalIsDeclaringResults(true);
        await onDeclareResults();
        toast.success('Results declared successfully!');
        setIsEarlyDeclareModalOpen(false);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to declare results');
      } finally {
        setLocalIsDeclaringResults(false);
      }
    }
  };

  const publicUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${baseUrl}/contests/${contest.slug}`;
  }, [contest.slug]);

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Registration link copied!');
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: contest.title,
          text: `Register for the contest "${contest.title}" on QuizBuzz! 🚀`,
          url: publicUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(publicUrl);
          toast.success('Link copied to clipboard for sharing!');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(publicUrl);
        toast.success('Registration link copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy link');
      }
    }
  };

  const handlePublish = async () => {
    setLocalIsPublishing(true);
    try {
      if (onPublish) {
        await onPublish();
      } else {
        // Simulate API call
        await new Promise(r => setTimeout(r, 1500));
      }
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b']
      });
      
      toast.success('Contest published! Share your link.');
      setIsConfirmingPublish(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish contest');
    } finally {
      setLocalIsPublishing(false);
    }
  };

  const renderDraftActions = () => (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" asChild>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Preview
        </a>
      </Button>

      <Dialog open={isConfirmingPublish} onOpenChange={setIsConfirmingPublish}>
        <DialogTrigger asChild>
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20">
            <Rocket className="mr-2 h-4 w-4" />
            Publish Contest
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Publish "{contest.title}"?</DialogTitle>
            <DialogDescription>
              Once published, participants can register via the public link.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Questions</span>
                <span className="font-bold">{contest._count?.questions || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Start Date</span>
                <span className="font-bold">{format(new Date(contest.startTime), 'PPP p')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Registration Fee</span>
                <span className="font-bold">{contest.fee === 0 ? 'Free' : `₹${contest.fee}`}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmingPublish(false)}>Not yet</Button>
            <Button onClick={handlePublish} disabled={publishingActive} className="bg-green-600 hover:bg-green-700">
              {publishingActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Publish Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderPublishedActions = () => (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setIsCancelModalOpen(true)}>
        Cancel Contest
      </Button>
      <Button variant="outline" size="sm" onClick={copyLink}>
        <Copy className="mr-2 h-4 w-4" />
        Copy Link
      </Button>
      <Button variant="outline" size="sm" onClick={() => setIsEditDetailsOpen(true)}>
        <Settings className="mr-2 h-4 w-4" />
        Edit Details
      </Button>
      <Button size="sm" className="bg-primary shadow-lg shadow-primary/20" onClick={handleShare}>
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
    </div>
  );

  const renderRegistrationClosedActions = () => (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setIsCancelModalOpen(true)}>
        Cancel Contest
      </Button>
      <Button variant="outline" size="sm" onClick={() => setIsEditDetailsOpen(true)}>
        <Settings className="mr-2 h-4 w-4" />
        Edit Details
      </Button>
      <Button 
        size="sm" 
        className="bg-primary shadow-lg shadow-primary/20"
        onClick={() => setIsSendMessageOpen(true)}
      >
        <Send className="mr-2 h-4 w-4" />
        Send Message
      </Button>
    </div>
  );

  const renderLiveActions = () => (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setIsCancelModalOpen(true)}>
        Cancel Contest
      </Button>
      
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-amber-600 border-amber-200 hover:bg-amber-50">
            <Power className="mr-2 h-4 w-4" />
            End Contest Now
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-amber-600">Forcefully end the contest?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This will immediately terminate the quiz for all active participants and auto-submit their current answers.</p>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                Type <strong>END CONTEST</strong> below to confirm.
              </div>
              <Input 
                placeholder="END CONTEST" 
                value={confirmText} 
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={confirmText !== 'END CONTEST'}
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                toast.info('Contest ending process started...');
                setConfirmText('');
              }}
            >
              End Contest Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button size="sm" className="bg-primary shadow-lg shadow-primary/20" asChild>
        <Link href={`/admin/contests/${contest.id}/live`}>
          <Radio className="mr-2 h-4 w-4 animate-pulse" />
          Broadcast Message
        </Link>
      </Button>
    </div>
  );

  const renderEndedActions = () => {
    const handleEvaluateClick = async () => {
      if (onEvaluate) {
        try {
          await onEvaluate();
          toast.success('Evaluation triggered successfully!');
        } catch (err: any) {
          toast.error(err?.message || 'Failed to trigger evaluation');
        }
      }
    };

    const handleDeclareResultsClick = async () => {
      try {
        setLocalIsDeclaringResults(true);
        const res = await resultsApi.getResultsDeclarationInfo(contest.id);
        const info = res.data;
        
        if (info.isEarlyDeclare && !info.isAlreadyDeclared) {
          setEarlyDeclareInfo(info);
          setIsEarlyDeclareModalOpen(true);
          setLocalIsDeclaringResults(false);
        } else {
          // If not early or already declared, just proceed
          await confirmDeclareResults();
        }
      } catch (err: any) {
        setLocalIsDeclaringResults(false);
        toast.error(err?.message || 'Failed to check results declaration status');
      }
    };

    return (
      <div className="flex items-center gap-3">
        {onEvaluate && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEvaluateClick}
            disabled={isEvaluating}
            className="text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            {isEvaluating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Trigger Evaluation
          </Button>
        )}

        {onDeclareResults && (
          <Button
            size="sm"
            onClick={handleDeclareResultsClick}
            disabled={isDeclaringResults || localIsDeclaringResults}
            className="bg-green-600 hover:bg-green-700"
          >
            {(isDeclaringResults || localIsDeclaringResults) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Declare Results
          </Button>
        )}

        {!onDeclareResults && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" asChild>
            <Link href={`/admin/contests/${contest.id}/results`}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Publish Results
            </Link>
          </Button>
        )}
      </div>
    );
  };

  const renderResultsPublishedActions = () => (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/admin/contests/${contest.id}/certificates`}>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Issue Certificates
        </Link>
      </Button>
      <Button size="sm" className="bg-primary" asChild>
        <a href={`/quiz/${contest.slug}/leaderboard`} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          View Public Leaderboard
        </a>
      </Button>
    </div>
  );

  if (contestPhase === 'CANCELLED') {
    return (
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="border-destructive text-destructive px-3 py-1 flex items-center gap-2">
          <XCircle className="h-4 w-4" />
          Cancelled on {format(new Date(contest.cancelledAt || Date.now()), 'PP')}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {contestPhase === 'DRAFT' && renderDraftActions()}
      {contestPhase === 'PUBLISHED' && renderPublishedActions()}
      {contestPhase === 'REGISTRATION_CLOSED' && renderRegistrationClosedActions()}
      {contestPhase === 'LIVE' && renderLiveActions()}
      {contestPhase === 'ENDED' && renderEndedActions()}
      {contestPhase === 'RESULTS_PUBLISHED' && renderResultsPublishedActions()}

      {/* Common Cancellation Modal */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {contestPhase === 'LIVE' ? 'Cancel a LIVE contest?' : `Cancel "${contest.title}"?`}
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              {contestPhase === 'LIVE' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive font-medium text-xs space-y-2">
                    <p>• Stop the quiz for all active participants</p>
                    <p>• Auto-submit their current answers</p>
                    <p>• Notify {contest._count?.participants || 0} participants via WhatsApp</p>
                    <p>• Offer refunds to paid participants</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Type CANCEL LIVE CONTEST to confirm</Label>
                    <Input 
                      placeholder="CANCEL LIVE CONTEST" 
                      value={confirmText} 
                      onChange={(e) => setConfirmText(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-medium">
                    {contest._count?.participants || 0} participants are registered. They will be notified via WhatsApp.
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Reason for cancellation (shown to participants)</Label>
                    <Textarea 
                      placeholder="e.g. Unforeseen technical issues..."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
            <Button 
              variant="destructive" 
              disabled={contestPhase === 'LIVE' ? confirmText !== 'CANCEL LIVE CONTEST' : !cancelReason}
              onClick={() => {
                if (onCancel) onCancel(cancelReason);
                setIsCancelModalOpen(false);
                toast.error('Contest has been cancelled');
              }}
            >
              I understand, cancel this contest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contest Details Modal */}
      <EditContestDetailsModal
        contest={contest}
        isOpen={isEditDetailsOpen}
        onOpenChange={setIsEditDetailsOpen}
        onSave={async (updates) => {
          // Call the parent's onUpdate handler if available
          // For now, just show a success message
          toast.success('Contest details updated');
        }}
      />

      {/* Send Message Modal */}
      <SendMessageModal
        contestId={contest.id}
        open={isSendMessageOpen}
        onOpenChange={setIsSendMessageOpen}
      />

      {/* Early Declare Confirmation Modal */}
      <Dialog open={isEarlyDeclareModalOpen} onOpenChange={setIsEarlyDeclareModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Declare Results Early?
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4 text-left">
              <p>
                This contest is scheduled to automatically publish results on{' '}
                <span className="font-semibold text-foreground">
                  {earlyDeclareInfo?.scheduledAt ? format(new Date(earlyDeclareInfo.scheduledAt), 'PPp') : '...'}
                </span>
                .
              </p>
              <div className="bg-amber-50 text-amber-900 p-4 rounded-xl border border-amber-200">
                <p className="text-sm font-medium">By proceeding now, you will:</p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>Immediately make the leaderboard public</li>
                  <li>Send email notifications to all participants instantly</li>
                  <li>Override the automated schedule</li>
                </ul>
              </div>
              {earlyDeclareInfo?.pendingCount > 0 && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-xl border border-destructive/20 flex gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    Warning: {earlyDeclareInfo.pendingCount} submissions are still pending evaluation. Wait for them to finish before declaring results.
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsEarlyDeclareModalOpen(false)} disabled={localIsDeclaringResults}>
              Cancel
            </Button>
            <Button 
              className="bg-amber-600 hover:bg-amber-700 text-white" 
              onClick={confirmDeclareResults}
              disabled={localIsDeclaringResults || (earlyDeclareInfo?.pendingCount > 0)}
            >
              {localIsDeclaringResults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Publish Results Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
