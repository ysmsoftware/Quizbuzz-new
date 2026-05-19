'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
    Users,
    CheckCircle2,
    FileText,
    IndianRupee,
    ChevronRight,
    LayoutDashboard,
    HelpCircle,
    ShieldCheck,
    BarChart3,
    MonitorPlay,
    Settings,
    AlertTriangle,
    Archive
} from 'lucide-react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useContestDetail } from '@/lib/hooks/useContestDetail';
import { useAdminContestSocket } from '@/lib/hooks/useAdminContestSocket';
import { useContestAnalytics } from '@/lib/hooks/useAnalytics';
import { deriveContestPhase } from '@/lib/utils/contest';
import { ContestPhaseBadge } from '@/components/features/contests/ContestPhaseBadge';
import { StatCard } from '@/components/features/contests/StatCard';
import { ContestActionBar } from '@/components/features/contests/ContestActionBar';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

interface AdminContestDetailShellProps {
    children: React.ReactNode;
}

export function AdminContestDetailShell({ children }: AdminContestDetailShellProps) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const contestId = params.id as string;

    const { 
        data: contest, 
        isLoading, 
        error, 
        refetch,
        publishContestMutation,
        evaluateMutation,
        declareResultsMutation,
        deleteContestMutation,
        updateContestMutation
    } = useContestDetail(contestId);

    const contestPhase = useMemo(() => {
        if (!contest) return 'DRAFT';
        return deriveContestPhase(contest);
    }, [contest]);

    const { snapshot, live, loading: isAnalyticsLoading } = useContestAnalytics(contestId);

    // WebSocket for real-time LIVE data
    const { getParticipantStats } = useAdminContestSocket(
        contestId,
        'admin-123', // Mock admin ID for now, will be real admin ID from auth
        contest?.orgId,
        undefined
    );

    const liveStats = useMemo(() => {
        if (contestPhase === 'LIVE') {
            return getParticipantStats();
        }
        return null;
    }, [contestPhase, getParticipantStats]);

    const tabs = useMemo(() => {
        const allTabs = [
            { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: true },
            { id: 'questions', label: 'Questions', icon: HelpCircle, show: true },
            { id: 'registrations', label: 'Registrations', icon: Users, show: contestPhase !== 'DRAFT', count: contest?._count?.participants },
            { id: 'live', label: 'Live Monitor', icon: MonitorPlay, show: contestPhase === 'LIVE', isLive: true, count: liveStats?.activeNow },
            { id: 'proctoring', label: 'Proctoring Alerts', icon: ShieldCheck, show: contestPhase === 'LIVE' || contestPhase === 'ENDED', isFlagged: liveStats?.flagged && liveStats.flagged > 0, count: liveStats?.flagged },
            { id: 'submissions', label: 'Submissions', icon: FileText, show: contestPhase === 'ENDED' || contestPhase === 'RESULTS_PUBLISHED' },
            { id: 'results', label: 'Results', icon: CheckCircle2, show: contestPhase === 'RESULTS_PUBLISHED' },
            { id: 'analytics', label: 'Analytics', icon: BarChart3, show: contestPhase !== 'DRAFT' },
        ];
        return allTabs.filter(tab => tab.show);
    }, [contestPhase, contest, liveStats]);

    const activeTab = useMemo(() => {
        const parts = pathname.split('/');
        return parts[parts.length - 1] === contestId ? 'overview' : parts[parts.length - 1];
    }, [pathname, contestId]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (error || !contest) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                <div className="p-6 bg-red-50 rounded-full">
                    <AlertTriangle className="h-12 w-12 text-red-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Contest Not Found</h2>
                    <p className="text-muted-foreground">This contest does not exist or you do not have access.</p>
                </div>
                <div className="flex gap-4">
                    <Button onClick={() => refetch()} variant="outline">Retry</Button>
                    <Button asChild>
                        <Link href="/admin/contests">Back to Contests</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Breadcrumbs */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/admin/contests">Contests</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{contest.title}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg overflow-hidden border border-border/50 shadow-sm">
                        {contest.coverImage ? (
                            <img src={contest.coverImage} alt={contest.title} className="h-full w-full object-cover" />
                        ) : (
                            <div className="h-full w-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xl">
                                {contest.title.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight">{contest.title}</h1>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                                {contest.orgSlug}
                            </span>
                            <ContestPhaseBadge phase={contestPhase} />
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <ContestActionBar
                    contest={contest}
                    contestPhase={contestPhase}
                    onPublish={async () => {
                        await publishContestMutation.mutateAsync();
                        refetch();
                    }}
                    isPublishing={publishContestMutation.isPending}
                    onEvaluate={async () => {
                        await evaluateMutation.mutateAsync();
                        refetch();
                    }}
                    isEvaluating={evaluateMutation.isPending}
                    onDeclareResults={async () => {
                        await declareResultsMutation.mutateAsync();
                        refetch();
                    }}
                    isDeclaringResults={declareResultsMutation.isPending}
                    onCancel={async (reason) => {
                        await updateContestMutation.mutateAsync({ status: 'CANCELLED', cancelReason: reason });
                        refetch();
                    }}
                    onArchive={() => console.log('Archived')}
                    onDelete={async () => {
                        await deleteContestMutation.mutateAsync();
                        router.push('/admin/contests');
                    }}
                />
            </div>

            {/* Stats Row */}
            <WidgetErrorBoundary name="Contest Summary Stats">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Registered"
                        value={snapshot?.totalParticipants || contest?._count?.participants || 0}
                        icon={Users}
                    />
                    <StatCard
                        label="Completed"
                        value={snapshot?.completionCount || contest?._count?.submissions || 0}
                        icon={CheckCircle2}
                        status={{ label: 'On track', type: 'success' }}
                    />
                    <StatCard
                        label="Avg Score"
                        value={snapshot?.averageScore?.toFixed(1) || '0.0'}
                        icon={FileText}
                    />
                    <StatCard
                        label="Revenue"
                        value={contest.fee === 0 ? 0 : (snapshot?.paidParticipants || contest?._count?.payments || 0) * contest.fee}
                        icon={IndianRupee}
                        format={(val) => contest.fee === 0 ? 'Free Contest' : `₹${val.toLocaleString()}`}
                    />
                </div>
            </WidgetErrorBoundary>

            {/* Tabs Navigation */}
            <div className="border-b border-border/50">
                <div className="flex items-center">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.id}
                            href={`/admin/contests/${contestId}${tab.id === 'overview' ? '' : '/' + tab.id}`}
                            className={cn(
                                "relative px-4 py-3 text-sm font-medium transition-colors hover:text-primary",
                                activeTab === tab.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <tab.icon className={cn("h-4 w-4", tab.isLive && "text-red-500")} />
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[10px] bg-secondary text-secondary-foreground",
                                        tab.isFlagged && "bg-amber-500 text-white"
                                    )}>
                                        {tab.count}
                                    </span>
                                )}
                                {tab.isLive && (
                                    <span className="flex h-1.5 w-1.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {children}
            </div>
        </div>
    );
}

function PageSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64" />
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <div className="flex gap-4 border-b border-border/50 pb-px">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-24" />)}
            </div>
            <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}
