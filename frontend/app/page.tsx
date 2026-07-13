import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { HeroInstallButton, BottomInstallButton, FloatingInstallButton } from '@/components/pwa/LandingInstallButtons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FeaturedContests } from '@/components/home/featured-contests';
import {
    Trophy,
    Users,
    Shield,
    BarChart3,
    Clock,
    CheckCircle2,
    ArrowRight,
    Zap,
    Globe,
    Lock,
    Star,
} from 'lucide-react';

const features = [
    {
        icon: Trophy,
        title: 'Competitive Contests',
        description: 'Participate in challenging quizzes across multiple categories with prizes and recognition.',
    },
    {
        icon: Shield,
        title: 'Secure Proctoring',
        description: 'AI-powered proctoring ensures fair play with fullscreen mode and webcam monitoring.',
    },
    {
        icon: BarChart3,
        title: 'Real-time Leaderboards',
        description: 'Track your performance live and see where you stand against other participants.',
    },
    {
        icon: Clock,
        title: 'Auto-Save Progress',
        description: 'Never lose your answers with automatic saving and session recovery.',
    },
];

const stats = [
    { value: '50K+', label: 'Active Participants' },
    { value: '500+', label: 'Contests Hosted' },
    { value: '98%', label: 'Satisfaction Rate' },
    { value: '24/7', label: 'Support Available' },
];

const howItWorks = [
    {
        step: 1,
        title: 'Browse & Register',
        description: 'Find contests that match your interests and register with a simple form.',
    },
    {
        step: 2,
        title: 'Prepare & Practice',
        description: 'Review contest details, understand the format, and prepare for the challenge.',
    },
    {
        step: 3,
        title: 'Take the Quiz',
        description: 'Enter with your participant ID, complete system checks, and begin your quiz.',
    },
    {
        step: 4,
        title: 'View Results',
        description: 'Get instant results, detailed analytics, and see your rank on the leaderboard.',
    },
];

export default function HomePage() {
    return (
        <div className="flex min-h-screen flex-col">
            <Header />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
                    <div className="absolute inset-0 bg-grid-pattern opacity-5" />
                    <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
                        <div className="mx-auto max-w-3xl text-center">
                            <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/5 text-primary">
                                <Zap className="mr-1 h-3 w-3" />
                                New: AI-Powered Proctoring Now Available
                            </Badge>
                            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
                                Elevate Your
                                <span className="text-primary"> Learning</span> Through
                                <span className="text-primary"> Competition</span>
                            </h1>
                            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto text-pretty">
                                Join thousands of participants in skill-testing quizzes and contests.
                                From academic olympiads to coding challenges, prove your expertise and win exciting prizes.
                            </p>
                            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
                                <Link href="/login">
                                    <Button size="lg" className="w-full sm:w-auto gap-2">
                                        <Trophy className="h-5 w-5" />
                                        Sign In
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <HeroInstallButton />
                                <Link href="/register">
                                    <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                                        <Lock className="h-5 w-5" />
                                        Create Account
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-20 grid grid-cols-2 gap-6 sm:grid-cols-4">
                            {stats.map((stat) => (
                                <div key={stat.label} className="text-center">
                                    <p className="text-3xl font-bold text-primary sm:text-4xl">{stat.value}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Featured Contests */}
                <section className="py-20 bg-secondary/20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">Featured Contests</h2>
                                <p className="mt-2 text-muted-foreground">
                                    Discover popular contests that match your skills
                                </p>
                            </div>
                            <Link href="/contests" className="hidden sm:block">
                                <Button variant="ghost" className="gap-1">
                                    View All
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                        <FeaturedContests />
                        <div className="mt-8 text-center sm:hidden">
                            <Link href="/contests">
                                <Button variant="outline" className="gap-1">
                                    View All Contests
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight">Why Choose QuizBuzz?</h2>
                            <p className="mt-4 text-muted-foreground">
                                A complete platform designed for fair, engaging, and rewarding quiz experiences
                            </p>
                        </div>
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            {features.map((feature) => (
                                <Card key={feature.title} className="border-border/50 bg-card/50">
                                    <CardContent className="pt-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                                            <feature.icon className="h-6 w-6 text-primary" />
                                        </div>
                                        <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section id="how-it-works" className="py-20 bg-secondary/20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
                            <p className="mt-4 text-muted-foreground">
                                Getting started is easy. Follow these simple steps to begin your journey.
                            </p>
                        </div>
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            {howItWorks.map((item, index) => (
                                <div key={item.step} className="relative">
                                    {index < howItWorks.length - 1 && (
                                        <div className="absolute top-8 left-10 hidden h-0.5 w-full bg-border lg:block" />
                                    )}
                                    <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                                            {item.step}
                                        </div>
                                        <h3 className="mt-6 text-lg font-semibold">{item.title}</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* For Organizers */}
                <section id="organizers" className="py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                            <div>
                                <Badge variant="outline" className="mb-4">For Organizers</Badge>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    Create and Manage Contests with Ease
                                </h2>
                                <p className="mt-4 text-muted-foreground">
                                    QuizBuzz provides powerful tools for organizations to create,
                                    manage, and analyze quizzes and contests at scale.
                                </p>
                                <ul className="mt-8 space-y-4">
                                    {[
                                        'Drag-and-drop question builder with multiple question types',
                                        'Automated participant management and communication',
                                        'Real-time monitoring and proctoring dashboard',
                                        'Comprehensive analytics and exportable reports',
                                        'White-label options for your brand',
                                    ].map((item) => (
                                        <li key={item} className="flex items-start gap-3">
                                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                            <span className="text-sm">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-8">
                                    <Link href="/login">
                                        <Button size="lg" className="gap-2">
                                            <Globe className="h-5 w-5" />
                                            Start Organizing
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 p-1">
                                    <div className="h-full w-full rounded-xl bg-card border border-border/50 flex items-center justify-center">
                                        <div className="text-center p-8">
                                            <BarChart3 className="h-16 w-16 text-primary mx-auto mb-4" />
                                            <p className="text-lg font-semibold">Admin Dashboard Preview</p>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                Powerful analytics at your fingertips
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-20 bg-primary">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center">
                            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground">
                                Ready to Test Your Knowledge?
                            </h2>
                            <p className="mt-4 text-primary-foreground/80">
                                Join thousands of participants and prove your expertise in exciting contests.
                            </p>
                            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                                <Link href="/login">
                                    <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                                        <Trophy className="h-5 w-5" />
                                        Sign In Now
                                    </Button>
                                </Link>
                                <BottomInstallButton />
                                <Link href="/register">
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="w-full sm:w-auto gap-2 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                                    >
                                        Create Account
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <FloatingInstallButton />
            <Footer />
        </div>
    );
}
