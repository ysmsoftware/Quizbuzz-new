'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  Users, 
  ShieldCheck, 
  Trophy, 
  CreditCard, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Settings,
  ChevronDown,
  ChevronUp,
  Tag,
  Monitor,
  Tablet,
  Smartphone,
  Copy,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useContestDetail } from '@/lib/hooks/useContestDetail';
import { useUpdateContest } from '@/lib/hooks/useUpdateContest';
import { deriveContestPhase } from '@/lib/utils/contest';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditableField } from '@/components/ui/editable-field';
import { ContestPrizeBracket } from '@/components/features/contests/ContestPrizeBracket';
import { PublicLinkCard } from '@/components/features/contests/PublicLinkCard';
import { KeyDatesCard } from '@/components/features/contests/KeyDatesCard';
import { DraftChecklistCard } from '@/components/features/contests/DraftChecklistCard';
import { DangerZoneCard } from '@/components/features/contests/DangerZoneCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ContestOverviewPage() {
  const { id } = useParams() as { id: string };
  const { data: contest, isLoading, error } = useContestDetail(id);
  const updateMutation = useUpdateContest(id);
  
  const [descExpanded, setDescExpanded] = useState(false);

  const phase = useMemo(() => {
    if (!contest) return 'DRAFT';
    return deriveContestPhase(contest);
  }, [contest]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="space-y-8">
          <Skeleton className="h-[250px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !contest) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Failed to load contest</h2>
        <p className="text-muted-foreground mt-2">The contest you're looking for could not be found or there was an error.</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const isDraft = phase === 'DRAFT';
  const isCancelled = phase === 'CANCELLED';
  const isPublishedPlus = phase !== 'DRAFT' && phase !== 'CANCELLED';
  const isLivePlus = phase === 'LIVE' || phase === 'ENDED';

  const handleSave = async (field: string, value: any) => {
    // In PUBLISHED+, show confirm modal if needed (simulated here)
    if (!isDraft && !isCancelled) {
      const confirmed = window.confirm(`Are you sure you want to change ${field}? This will require a reason to be logged.`);
      if (!confirmed) return;
    }
    
    await updateMutation.mutateAsync({ [field]: value });
  };

  return (
    <div className="relative">
      {/* Cancelled Watermark */}
      {isCancelled && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center opacity-[0.03] rotate-[-25deg]">
          <span className="text-[20vw] font-black uppercase tracking-tighter text-destructive">
            Cancelled
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* BASIC INFORMATION */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Basic Information</h2>
              {isDraft && (
                <Button variant="outline" size="sm" onClick={() => toast.info("Opening Wizard...")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit with Wizard
                </Button>
              )}
            </div>
            
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="relative group shrink-0">
                    <img 
                      src={contest.coverImage || '/placeholder-contest.jpg'} 
                      alt={contest.title}
                      className="w-full md:w-[200px] aspect-video object-cover rounded-lg border shadow-sm"
                    />
                    {isDraft && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg cursor-pointer">
                        <Plus className="h-8 w-8 text-white" />
                      </div>
                    )}
                    {isCancelled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-[1px] rounded-lg">
                        <div className="bg-destructive text-white px-3 py-1 rounded text-[10px] font-bold uppercase rotate-[-12deg]">Cancelled</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4">
                    <EditableField 
                      label="Contest Title"
                      value={contest.title}
                      onSave={(v) => handleSave('title', v)}
                      disabled={isCancelled}
                      autoSave={isDraft}
                      className="[&_span]:text-2xl [&_span]:font-bold [&_span]:font-plus-jakarta"
                    />
                    
                    <EditableField 
                      label="Short Description"
                      value={contest.shortDescription || ''}
                      onSave={(v) => handleSave('shortDescription', v)}
                      disabled={isCancelled}
                      autoSave={isDraft}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Full Description</label>
                  <div className="relative">
                    <div className={cn(
                      "text-sm text-foreground/80 whitespace-pre-wrap transition-all",
                      !descExpanded && "line-clamp-4"
                    )}>
                      {contest.description}
                    </div>
                    {contest.description && contest.description.length > 200 && (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto mt-2 text-primary hover:no-underline"
                        onClick={() => setDescExpanded(!descExpanded)}
                      >
                        {descExpanded ? (
                          <span className="flex items-center gap-1">Show less <ChevronUp className="h-3 w-3" /></span>
                        ) : (
                          <span className="flex items-center gap-1">Show more <ChevronDown className="h-3 w-3" /></span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Category</label>
                    <Badge variant="secondary" className="px-3 py-1 text-xs">
                      {contest.topic}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {contest.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-[10px] font-medium bg-muted/30">
                          <Tag className="mr-1 h-2 w-2" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* SCHEDULE & DURATION */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Schedule & Duration</h2>
            <Card className="border-border/50">
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <EditableField 
                  label="Start Date & Time"
                  type="date"
                  value={contest.startTime}
                  onSave={(v) => handleSave('startTime', v)}
                  disabled={isLivePlus || isCancelled}
                  lockReason={isLivePlus ? "Cannot change start time after contest begins" : ""}
                  autoSave={isDraft}
                />
                <EditableField 
                  label="Registration Deadline"
                  type="date"
                  value={contest.registrationDeadline}
                  onSave={(v) => handleSave('registrationDeadline', v)}
                  disabled={phase === 'REGISTRATION_CLOSED' || isLivePlus || isCancelled}
                  autoSave={isDraft}
                />
                <EditableField 
                  label="Duration (Minutes)"
                  type="number"
                  value={String(contest.durationMinutes)}
                  onSave={(v) => handleSave('durationMinutes', parseInt(v))}
                  disabled={isLivePlus || isCancelled}
                  autoSave={isDraft}
                />
                <EditableField 
                  label="Max Participants"
                  type="number"
                  value={String(contest.maxParticipants)}
                  onSave={(v) => handleSave('maxParticipants', parseInt(v))}
                  disabled={phase === 'REGISTRATION_CLOSED' || isLivePlus || isCancelled}
                  autoSave={isDraft}
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Timezone</label>
                  <p className="text-sm font-medium">{contest.timezone} (UTC+05:30)</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* RULES & PROCTORING */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Rules & Proctoring</h2>
              {(isDraft || phase === 'PUBLISHED') && (
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              )}
            </div>
            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Official Rules</label>
                  <ul className="space-y-2">
                    {contest.rules?.map((rule, idx) => (
                      <li key={idx} className="flex gap-3 text-sm group">
                        <span className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="text-foreground/80 leading-relaxed">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">AI Proctoring</label>
                    <div className="flex items-center gap-2">
                      <Badge variant={contest.proctoringEnabled ? "default" : "secondary"} className={cn(
                        "px-2 py-0.5",
                        contest.proctoringEnabled ? "bg-green-500 hover:bg-green-600" : "bg-muted text-muted-foreground"
                      )}>
                        {contest.proctoringEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                      <ShieldCheck className={cn("h-4 w-4", contest.proctoringEnabled ? "text-green-500" : "text-muted-foreground")} />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Tab Switching</label>
                    <span className="text-sm font-medium">Auto-Flag after 2 switches</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Allowed Devices</label>
                    <div className="flex gap-2">
                      {contest.allowedDevices?.includes('desktop') && <Monitor className="h-4 w-4 text-muted-foreground" />}
                      {contest.allowedDevices?.includes('tablet') && <Tablet className="h-4 w-4 text-muted-foreground" />}
                      {contest.allowedDevices?.includes('mobile') && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* PRIZE STRUCTURE */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Prize Structure</h2>
            <ContestPrizeBracket prizes={contest.prizes} />
            {!isDraft && (
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                Prize structure is locked after publishing to protect participant trust
              </p>
            )}
          </section>

          {/* FEES & PAYMENT */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Registration Fees</h2>
            <Card className="border-border/50">
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Base Fee</label>
                    <p className="text-3xl font-black text-foreground">₹{contest.fee}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Payment Gateway</label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>Razorpay</span>
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">rzp_live_••••{contest.razorpayKeyId?.slice(-4)}</code>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Promo Codes</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">2 Active Codes</span>
                      <Button variant="link" size="sm" className="h-auto p-0 text-primary">View All</Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Refund Policy</label>
                    <p className="text-xs text-muted-foreground italic">Non-refundable after registration deadline.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-8">
          {/* Public Link Card */}
          {isPublishedPlus && (
            <PublicLinkCard 
              url={`https://quizcraft.pro/r/${contest.orgSlug}/${contest.slug}`}
              isRegistrationClosed={phase === 'REGISTRATION_CLOSED' || isLivePlus}
            />
          )}

          {/* Key Dates Card */}
          <KeyDatesCard 
            contest={contest}
            phase={phase}
          />

          {/* Draft Checklist */}
          {isDraft && (
            <DraftChecklistCard 
              contest={contest}
              onPublish={async () => {
                const confirmed = window.confirm("Are you sure you want to publish this contest? This will make it visible to participants.");
                if (confirmed) {
                  await updateMutation.mutateAsync({ publishedAt: new Date().toISOString() });
                }
              }}
              isPublishing={updateMutation.isPending}
            />
          )}

          {/* Danger Zone */}
          <DangerZoneCard 
            contestTitle={contest.title}
            phase={phase}
            participantCount={contest?._count?.participants || 0}
            onDelete={async () => {
              toast.error("Contest deleted (simulated)");
              // router.push('/admin/contests');
            }}
            onCancel={async (reason) => {
              await updateMutation.mutateAsync({ cancelledAt: new Date().toISOString() });
              toast.success("Contest cancelled and participants notified");
            }}
            onArchive={async () => {
              toast.success("Contest archived");
            }}
          />
        </div>
      </div>
    </div>
  );
}
