'use client';

import { useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { uploadBanner, closeRegistration } from '@/lib/api/contests.api';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/ui/alert-dialog';
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
    Plus,
    Loader2,
    Trash2,
    Check,
    X,
    Pencil
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { fmtDateTime } from '@/lib/formatDate';
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
import { EditPrizesModal, PrizeBracketDraft } from '@/components/features/contests/EditPrizesModal';
import { PublicLinkCard } from '@/components/features/contests/PublicLinkCard';
import { KeyDatesCard } from '@/components/features/contests/KeyDatesCard';
import { DraftChecklistCard } from '@/components/features/contests/DraftChecklistCard';
import { DangerZoneCard } from '@/components/features/contests/DangerZoneCard';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ContestOverviewPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const {
        data: contest,
        rawContest,
        isLoading,
        error,
        publishContestMutation,
        deleteContestMutation,
        archiveContestMutation,
        refetch
    } = useContestDetail(id);
    const updateMutation = useUpdateContest(id);

    const [descExpanded, setDescExpanded] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [closingRegistration, setClosingRegistration] = useState(false);
    const [prizesModalOpen, setPrizesModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const confirmingRef = useRef(false);

    const [isAddingRule, setIsAddingRule] = useState(false);
    const [newRuleValue, setNewRuleValue] = useState('');
    const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
    const [ruleEditValue, setRuleEditValue] = useState('');

    const handleAddRuleSave = async () => {
        if (!newRuleValue.trim() || !contest) return;
        const updatedRules = [...(contest.rules || []), newRuleValue.trim()];
        try {
            await handleSave('rules', updatedRules);
            setNewRuleValue('');
            setIsAddingRule(false);
        } catch (err) {
            // Already handled
        }
    };

    const handleSaveRule = async (idx: number) => {
        if (!ruleEditValue.trim() || !contest) return;
        const updatedRules = [...(contest.rules || [])];
        updatedRules[idx] = ruleEditValue.trim();
        try {
            await handleSave('rules', updatedRules);
            setEditingRuleIdx(null);
        } catch (err) {
            // Already handled
        }
    };

    const handleDeleteRule = async (idx: number) => {
        if (!contest) return;
        const updatedRules = (contest.rules || []).filter((_, i) => i !== idx);
        try {
            await handleSave('rules', updatedRules);
        } catch (err) {
            // Already handled
        }
    };

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        description: string;
        onConfirm: () => void | Promise<void>;
        onCancel?: () => void;
    }>({
        isOpen: false,
        title: '',
        description: '',
        onConfirm: () => {},
    });

    const phase = useMemo(() => {
        if (!contest) return 'DRAFT';
        return deriveContestPhase(contest);
    }, [contest]);

    const registrationUrl = useMemo(() => {
        if (!contest) return '';
        const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
            ?? (typeof window !== 'undefined' ? window.location.origin : '');
        const slug = (contest as any).slug ?? '';
        return `${base}/contests/${slug}`;
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
    const isPublished = phase === 'PUBLISHED' || phase === 'REGISTRATION_CLOSED';
    const isRegistrationClosed = phase === 'REGISTRATION_CLOSED';
    const isTimingLocked = isLivePlus || isRegistrationClosed;

    const formatToLocalDatetime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleSave = (field: string, value: any): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
            if (!isDraft && !isCancelled) {
                setConfirmModal({
                    isOpen: true,
                    title: "Confirm Contest Update",
                    description: `Are you sure you want to update the ${field}? Since this contest is already published, changing this will cancel and reschedule all associated background timer jobs and notifications for active registrants.`,
                    onConfirm: async () => {
                        try {
                            await updateMutation.mutateAsync({ [field]: value });
                            toast.success("Contest updated successfully!");
                            resolve();
                        } catch (err: any) {
                            const errMsg = err?.message || "Failed to update contest";
                            toast.error(errMsg);
                            reject(new Error(errMsg));
                        }
                    },
                    onCancel: () => {
                        reject(new Error("Update cancelled"));
                    }
                });
            } else {
                updateMutation.mutateAsync({ [field]: value })
                    .then(() => {
                        toast.success("Contest updated successfully!");
                        resolve();
                    })
                    .catch((err: any) => {
                        const errMsg = err?.message || "Failed to update contest";
                        toast.error(errMsg);
                        reject(new Error(errMsg));
                    });
            }
        });
    };

    const handleBannerClick = () => {
        if (!isCancelled) {
            fileInputRef.current?.click();
        }
    };

    const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const preview = reader.result as string;
            
            const performUpload = async () => {
                setUploadingBanner(true);
                try {
                    const res = await uploadBanner({ fileData: preview, fileName: file.name });
                    if (res.data) {
                        await updateMutation.mutateAsync({ bannerImage: res.data.url });
                        toast.success("Banner image updated successfully!");
                    }
                } catch (err: any) {
                    toast.error(err?.message || "Failed to upload banner image.");
                } finally {
                    setUploadingBanner(false);
                }
            };

            if (!isDraft && !isCancelled) {
                setConfirmModal({
                    isOpen: true,
                    title: "Confirm Banner Update",
                    description: "Are you sure you want to update the banner image of this published contest? This will update the banner for all active registrants.",
                    onConfirm: performUpload
                });
            } else {
                await performUpload();
            }
        };
        reader.readAsDataURL(file);
    };

    const isOpenForRegistration = phase === 'PUBLISHED';

    const handleCloseRegistration = () => {
        setConfirmModal({
            isOpen: true,
            title: "Close Registration Early?",
            description: "This stops new participants from registering, even though the registration deadline hasn't passed yet. You'll still be able to raise the max participant limit if needed. This cannot be undone.",
            onConfirm: async () => {
                setClosingRegistration(true);
                try {
                    await closeRegistration(id);
                    toast.success("Registration closed for new participants.");
                    refetch();
                } catch (err: any) {
                    toast.error(err?.message || "Failed to close registration");
                } finally {
                    setClosingRegistration(false);
                }
            },
        });
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
                                    <div className="relative group shrink-0" onClick={handleBannerClick}>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleBannerFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <img
                                            src={contest.bannerImage || contest.coverImage || '/placeholder-contest.jpg'}
                                            alt={contest.title}
                                            className={cn(
                                                "w-full md:w-[200px] aspect-video object-cover rounded-lg border shadow-sm transition-all duration-300",
                                                !isCancelled && "cursor-pointer hover:brightness-90"
                                            )}
                                        />
                                        {uploadingBanner && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-lg">
                                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                                                <span className="text-[10px] text-white mt-1">Uploading...</span>
                                            </div>
                                        )}
                                        {!isCancelled && !uploadingBanner && (
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

                                <EditableField
                                    label="Full Description"
                                    value={contest.description || ''}
                                    onSave={(v) => handleSave('description', v)}
                                    disabled={isCancelled}
                                    autoSave={isDraft}
                                    multiline={true}
                                />

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

                                {/* Payment info — only shown when contest is paid */}
                                {(contest as any).paymentEnabled && (
                                    <>
                                        <Separator />
                                        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                                    Registration Fee
                                                </label>
                                                <p className="text-2xl font-black text-foreground">
                                                    ₹{(contest as any).paymentConfig?.amount ?? contest.fee}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                                    Payment Gateway
                                                </label>
                                                <div className="flex items-center gap-2 text-sm font-medium">
                                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                    <span>Razorpay</span>
                                                </div>
                                            </div>
                                            {(contest as any).paymentConfig?.description && (
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                                                        Fee Description
                                                    </label>
                                                    <p className="text-sm text-muted-foreground">
                                                        {(contest as any).paymentConfig.description}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    {/* SCHEDULE & DURATION */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold tracking-tight">Schedule & Duration</h2>
                            {isOpenForRegistration && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                    onClick={handleCloseRegistration}
                                    disabled={closingRegistration}
                                >
                                    {closingRegistration && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                    Close Registration Early
                                </Button>
                            )}
                        </div>
                        <Card className="border-border/50">
                            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                <EditableField
                                    label="Start Date & Time"
                                    type="datetime-local"
                                    value={formatToLocalDatetime(contest.startTime)}
                                    displayValue={contest.startTime ? fmtDateTime(new Date(contest.startTime)) : ''}
                                    onSave={(v) => handleSave('startTime', new Date(v).toISOString())}
                                    disabled={isTimingLocked || isCancelled}
                                    lockReason={isLivePlus ? "Cannot change start time after contest begins" : isRegistrationClosed ? "Cannot change timing once registration is closed" : ""}
                                    autoSave={isDraft}
                                />
                                <EditableField
                                    label="Registration Deadline"
                                    type="datetime-local"
                                    value={formatToLocalDatetime(contest.registrationDeadline)}
                                    displayValue={contest.registrationDeadline ? fmtDateTime(new Date(contest.registrationDeadline)) : ''}
                                    onSave={(v) => handleSave('registrationDeadline', new Date(v).toISOString())}
                                    disabled={isTimingLocked || isCancelled}
                                    autoSave={isDraft}
                                />
                                <EditableField
                                    label="Duration (Minutes)"
                                    type="number"
                                    value={String(contest.durationMinutes)}
                                    onSave={(v) => handleSave('durationMinutes', parseInt(v))}
                                    disabled={isTimingLocked || isCancelled}
                                    autoSave={isDraft}
                                />
                                <EditableField
                                    label="Max Participants"
                                    type="number"
                                    value={String(contest.maxParticipants)}
                                    onSave={(v) => handleSave('maxParticipants', parseInt(v))}
                                    disabled={isLivePlus || isCancelled}
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
                            {(isDraft || isPublished) && (
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-primary hover:text-primary/80"
                                    onClick={() => {
                                        setIsAddingRule(true);
                                        setNewRuleValue('');
                                    }}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Rule
                                </Button>
                            )}
                        </div>
                        <Card className="border-border/50">
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Official Rules</label>
                                    <ul className="space-y-3">
                                        {contest.rules?.map((rule, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-sm group">
                                                <span className="shrink-0 h-5 w-5 mt-0.5 flex items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                                                    {idx + 1}
                                                </span>
                                                {editingRuleIdx === idx ? (
                                                    <div className="flex-1 flex gap-2 items-center">
                                                        <Input
                                                            value={ruleEditValue}
                                                            onChange={(e) => setRuleEditValue(e.target.value)}
                                                            className="h-8 py-1 text-sm flex-1"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveRule(idx);
                                                                if (e.key === 'Escape') setEditingRuleIdx(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={() => handleSaveRule(idx)}>
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingRuleIdx(null)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex items-start justify-between gap-4">
                                                        <span className="text-foreground/80 leading-relaxed pt-0.5">{rule}</span>
                                                        {(isDraft || isPublished) && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                                    onClick={() => {
                                                                        setEditingRuleIdx(idx);
                                                                        setRuleEditValue(rule);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </Button>
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() => handleDeleteRule(idx)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        ))}

                                        {isAddingRule && (
                                            <li className="flex items-start gap-3 text-sm">
                                                <span className="shrink-0 h-5 w-5 mt-0.5 flex items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                                    {(contest.rules?.length || 0) + 1}
                                                </span>
                                                <div className="flex-1 flex gap-2 items-center">
                                                    <Input
                                                        value={newRuleValue}
                                                        onChange={(e) => setNewRuleValue(e.target.value)}
                                                        placeholder="Enter new rule..."
                                                        className="h-8 py-1 text-sm flex-1"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleAddRuleSave();
                                                            if (e.key === 'Escape') setIsAddingRule(false);
                                                        }}
                                                        autoFocus
                                                    />
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-green-500/10" onClick={handleAddRuleSave}>
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setIsAddingRule(false)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </li>
                                        )}
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
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold tracking-tight">Prize Structure</h2>
                            {!isCancelled && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() => setPrizesModalOpen(true)}
                                >
                                    {contest.prizes && contest.prizes.length > 0 ? (
                                        <Pencil className="h-3.5 w-3.5" />
                                    ) : (
                                        <Plus className="h-4 w-4" />
                                    )}
                                    {contest.prizes && contest.prizes.length > 0 ? 'Edit Prizes' : 'Add Prizes'}
                                </Button>
                            )}
                        </div>
                        <ContestPrizeBracket prizes={contest.prizes} />
                    </section>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-8">
                    {/* Public Link Card */}
                    {isPublishedPlus && (
                        <PublicLinkCard
                            url={registrationUrl}
                            isRegistrationClosed={phase === 'REGISTRATION_CLOSED' || isLivePlus}
                        />
                    )}

                    {/* Key Dates Card */}
                    <KeyDatesCard
                        contest={contest}
                        phase={phase}
                        onSave={handleSave}
                    />

                    {/* Draft Checklist */}
                    {isDraft && (
                        <DraftChecklistCard
                            contest={contest}
                            onPublish={async () => {
                                const confirmed = window.confirm("Are you sure you want to publish this contest? This will make it visible to participants.");
                                if (confirmed) {
                                    try {
                                        await publishContestMutation.mutateAsync();
                                        toast.success("Contest published successfully!");
                                    } catch (err: any) {
                                        toast.error(err?.message || "Failed to publish contest");
                                    }
                                }
                            }}
                            isPublishing={publishContestMutation.isPending}
                        />
                    )}

                    {/* Danger Zone */}
                    <DangerZoneCard
                        contestTitle={contest.title}
                        phase={phase}
                        participantCount={contest?._count?.participants || 0}
                        onDelete={async () => {
                            try {
                                await deleteContestMutation.mutateAsync();
                                toast.success("Contest deleted successfully");
                                router.push('/org/contests');
                            } catch (err: any) {
                                toast.error(err?.message || "Failed to delete contest");
                            }
                        }}
                        onCancel={async (reason) => {
                            try {
                                await updateMutation.mutateAsync({ status: 'CANCELLED', cancelReason: reason });
                                toast.success("Contest cancelled and participants notified");
                            } catch (err: any) {
                                toast.error(err?.message || "Failed to cancel contest");
                            }
                        }}
                        onArchive={async () => {
                            try {
                                await archiveContestMutation.mutateAsync();
                                toast.success("Contest archived");
                                router.push('/org/contests/archived');
                            } catch (err: any) {
                                toast.error(err?.message || "Failed to archive contest");
                            }
                        }}
                    />
                </div>
            </div>

            <EditPrizesModal
                open={prizesModalOpen}
                onOpenChange={setPrizesModalOpen}
                prizes={rawContest?.prizes || []}
                onSave={async (drafts: PrizeBracketDraft[]) => {
                    await handleSave('prizes', drafts);
                }}
            />

            <AlertDialog
                open={confirmModal.isOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        if (!confirmingRef.current) {
                            confirmModal.onCancel?.();
                        }
                        confirmingRef.current = false;
                    }
                    setConfirmModal(prev => ({ ...prev, isOpen: open }));
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmModal.title}</AlertDialogTitle>
                        <AlertDialogDescription>{confirmModal.description}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => {
                            confirmingRef.current = true;
                            const confirmFn = confirmModal.onConfirm;
                            setConfirmModal(prev => ({ ...prev, isOpen: false, onCancel: undefined }));
                            await confirmFn();
                        }}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
