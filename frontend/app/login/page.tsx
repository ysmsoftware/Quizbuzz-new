'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, LayoutDashboard, ShieldCheck, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/hooks/useAuth';

const ORG_POINTS = [
  { icon: LayoutDashboard, text: 'Build and run the full contest lifecycle — questions to certificates' },
  { icon: ShieldCheck, text: 'Live monitoring and proctoring dashboard while contests are in progress' },
  { icon: BarChart3, text: 'Exportable analytics and results reporting for every contest you run' },
];

export default function LoginPage() {
    const router = useRouter();
    const { loginMutation, isLoggedIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isLoggedIn) {
            router.push('/org');
        }
    }, [isLoggedIn, router]);

    const handleEmailChange = (val: string) => {
        // Only accept characters valid in email (alphanumeric, @, ., -, _, +)
        const sanitized = val.replace(/[^a-zA-Z0-9@._\-+]/g, '');
        setEmail(sanitized);
    };

    const handlePasswordChange = (val: string) => {
        // Strip disallowed special characters (comma, dot, brackets, slashes, quotes, colons)
        const sanitized = val.replace(/[,.[\](){}/\\;:'"`]/g, '');
        setPassword(sanitized);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address (e.g. name@example.com)');
            return;
        }

        try {
            await loginMutation.mutateAsync({ email, password });
        } catch (err: any) {
            const msg = err?.message ?? '';
            if (
                err.status === 403 ||
                err.code === 'FORBIDDEN' ||
                msg.toLowerCase().includes('verify')
            ) {
                router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                return;
            }
            if (err.status === 429) {
                setError('Too many attempts. Please wait a few minutes and try again.');
                return;
            }
            if (err.status === 401 || err.code === 'UNAUTHORIZED') {
                setError(msg || 'Incorrect email or password.');
                return;
            }
            setError(msg || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
            {/* Form panel — left */}
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
                <div className="w-full max-w-md">
                    <div className="mb-6 flex items-center justify-between lg:hidden">
                        <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-7 w-auto" />
                    </div>

                    <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>

                    <Card className="border-border/50">
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-2xl">Welcome Back, Organizer</CardTitle>
                            <CardDescription>
                                Sign in to manage your organization&apos;s contests on QuizBuzz
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email Address</label>
                                    <Input
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => handleEmailChange(e.target.value)}
                                        disabled={loginMutation.isPending}
                                        className="border-border/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Password</label>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => handlePasswordChange(e.target.value)}
                                        disabled={loginMutation.isPending}
                                        className="border-border/50"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={loginMutation.isPending}
                                >
                                    {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
                                </Button>
                            </form>

                            <div className="text-center text-sm">
                                <span className="text-muted-foreground">Don&apos;t have an organization account? </span>
                                <Link href="/register" className="text-primary hover:underline font-medium">
                                    Create one
                                </Link>
                            </div>

                            <div className="text-center">
                                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    <p className="text-center text-xs text-muted-foreground mt-6">
                        By signing in, you agree to our Terms of Service and Privacy Policy
                    </p>
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                        Looking to take a quiz instead?{' '}
                        <Link href="/contests" className="text-primary hover:underline">
                            Browse contests
                        </Link>
                    </p>
                </div>
            </div>

            {/* Brand panel — right, for organizations */}
            <div
                className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12"
                style={{
                    backgroundImage:
                        'radial-gradient(circle at 85% 15%, oklch(0.85 0.15 85 / 0.35), transparent 50%), radial-gradient(circle at 15% 85%, oklch(0.62 0.14 175 / 0.55), transparent 55%), linear-gradient(200deg, oklch(0.4 0.1 180), oklch(0.28 0.08 190))',
                }}
            >
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
                    style={{
                        backgroundImage:
                            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
                    }}
                />
                <div
                    className="pointer-events-none absolute inset-0 opacity-20"
                    style={{
                        backgroundImage:
                            'linear-gradient(oklch(1 0 0 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.15) 1px, transparent 1px)',
                        backgroundSize: '36px 36px',
                    }}
                />

                <div className="relative z-10 w-full max-w-sm">
                    <div className="mb-10 inline-flex rounded-2xl bg-white px-4 py-2.5 shadow-lg">
                        <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={140} height={40} className="h-7 w-auto" />
                    </div>

                    <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
                        For organizations
                    </div>

                    <h1 className="text-3xl font-bold leading-tight text-primary-foreground">
                        Run contests your organization can trust
                    </h1>
                    <p className="mt-3 text-sm text-primary-foreground/80">
                        This account is for organizations creating and managing contests on QuizBuzz — not for
                        participants. Participants register directly from a contest page.
                    </p>

                    <ul className="mt-9 space-y-4">
                        {ORG_POINTS.map((point, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                                    <point.icon className="h-3.5 w-3.5 text-primary-foreground" />
                                </span>
                                <span className="text-sm text-primary-foreground/85">{point.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
