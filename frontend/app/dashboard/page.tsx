'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    BarChart3,
    Trophy,
    Clock,
    CheckCircle2,
    LogOut,
    Settings,
    ArrowRight,
} from 'lucide-react';

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/login');
            return;
        }

        const parsed = JSON.parse(userData);
        if (parsed.role === 'admin' || parsed.email.includes('admin')) {
            router.push('/org');
            return;
        }
        setUser(parsed);
        setLoading(false);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        router.push('/');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="inline-block">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                    <p className="text-muted-foreground">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">QuizBuzz Pro</h1>
                        <p className="text-sm text-muted-foreground">Participant Dashboard</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/dashboard/settings">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">Settings</span>
                            </Button>
                        </Link>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="gap-2 text-destructive hover:text-destructive"
                        >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Welcome Section */}
                <div>
                    <h2 className="text-3xl font-bold">Welcome back, {user?.email?.split('@')[0]}!</h2>
                    <p className="text-muted-foreground mt-2">
                        Track your progress and participate in exciting contests
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Contests Joined</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-3xl font-bold">5</p>
                                <p className="text-sm text-muted-foreground">3 completed</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Current Rank</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-3xl font-bold">#247</p>
                                <p className="text-sm text-muted-foreground">Out of 1200 participants</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-3xl font-bold">78%</p>
                                <p className="text-sm text-green-600 dark:text-green-400">↑ 5% this month</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Achievements</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-3xl font-bold">8</p>
                                <p className="text-sm text-muted-foreground">Badges earned</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Contests */}
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Recent Contests
                        </CardTitle>
                        <CardDescription>Your latest quiz attempts</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { title: 'Java Advanced Programming', status: 'completed', score: 85, date: '2024-12-20' },
                                { title: 'Full Stack Web Development', status: 'in_progress', score: null, date: '2024-12-19' },
                                { title: 'React & TypeScript Mastery', status: 'completed', score: 92, date: '2024-12-15' },
                                { title: 'Data Science Fundamentals', status: 'completed', score: 78, date: '2024-12-10' },
                            ].map((contest, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-secondary/20 transition-colors"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{contest.title}</h3>
                                        <p className="text-sm text-muted-foreground">{contest.date}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge
                                            variant={contest.status === 'completed' ? 'default' : 'secondary'}
                                        >
                                            {contest.status === 'completed' ? (
                                                <>
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Completed
                                                </>
                                            ) : (
                                                <>
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    In Progress
                                                </>
                                            )}
                                        </Badge>
                                        {contest.score && (
                                            <Badge variant="outline">{contest.score}%</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Upcoming Contests */}
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Upcoming Contests
                        </CardTitle>
                        <CardDescription>Contests you can register for</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[
                                { title: 'Cloud Computing Basics', category: 'DevOps', date: '2024-12-25', fee: '₹299' },
                                { title: 'Python Advanced', category: 'Programming', date: '2024-12-28', fee: '₹399' },
                                { title: 'Web Security', category: 'Security', date: '2025-01-05', fee: '₹499' },
                            ].map((contest, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-secondary/20 transition-colors"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-semibold">{contest.title}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-xs">{contest.category}</Badge>
                                            <span className="text-sm text-muted-foreground">{contest.date}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold">{contest.fee}</span>
                                        <Button size="sm">
                                            Register
                                            <ArrowRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
