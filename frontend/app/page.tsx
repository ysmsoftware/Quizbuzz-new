import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { HeroInstallButton, BottomInstallButton, FloatingInstallButton } from '@/components/pwa/LandingInstallButtons';
import { StandalonePwaEntryRedirect } from '@/components/pwa/StandalonePwaEntryRedirect';
import { Button } from '@/components/ui/button';
import { FeaturedContests } from '@/components/home/featured-contests';
import { WebApplicationJsonLd } from '@/lib/seo/json-ld';
import {
    Trophy,
    ShieldCheck,
    BarChart3,
    CheckCircle2,
    ArrowRight,
    ArrowDown,
    Globe,
    UserPlus,
    Zap,
    Award,
} from 'lucide-react';

// Satisfaction rate and support hours are still placeholder figures — replace with real data before launch.
const stats = [
    { value: '3,000+', label: 'Concurrent Users per Contest Room' },
    { value: '98%', label: 'Satisfaction Rate' },
    { value: '24/7', label: 'Support Available' },
];

const lifecycle = [
    {
        icon: UserPlus,
        title: 'Register',
        description: 'Participants sign up for a contest, with optional paid entry, in a few clicks.',
    },
    {
        icon: ShieldCheck,
        title: 'Proctor',
        description: 'Fullscreen enforcement and webcam-based checks keep every session fair.',
    },
    {
        icon: Zap,
        title: 'Compete',
        description: 'Timed quizzes with auto-save, session recovery, and a live leaderboard.',
    },
    {
        icon: Award,
        title: 'Certify',
        description: 'Rankings and a downloadable certificate the moment the contest ends.',
    },
];

const participantJourney = [
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
            <WebApplicationJsonLd />
            <StandalonePwaEntryRedirect />
            <Header />

            <main className="flex-1">
                {/* Hero Section */}
                <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
                    <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
                        <div className="mx-auto max-w-3xl text-center">
                            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-balance">
                                Every Step of the Contest,
                                <span className="text-primary"> One Platform</span>
                            </h1>
                            <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto text-pretty">
                                QuizBuzz takes a contest from registration to certificate: AI-assisted proctoring,
                                real-time leaderboards, and instant results. Organizations run fair competitions —
                                participants compete knowing the result is real.
                            </p>
                            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center sm:flex-wrap">
                                <Link href="/contests">
                                    <Button size="lg" className="w-full sm:w-auto gap-2">
                                        <Trophy className="h-5 w-5" />
                                        Browse Contests
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                                <Link href="/register">
                                    <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2">
                                        <Globe className="h-5 w-5" />
                                        Start Organizing
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
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

                {/* Lifecycle */}
                <section className="py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight">One Lifecycle, Start to Finish</h2>
                            <p className="mt-4 text-muted-foreground">
                                The same four steps run every contest on QuizBuzz — the same ones a
                                competitor covering only a piece of this can&apos;t offer end to end.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-card/50 p-8 sm:p-10">
                            <div className="flex flex-col divide-y divide-border/50 lg:flex-row lg:divide-y-0 lg:divide-x">
                                {lifecycle.map((item, index) => (
                                    <div key={item.title} className="flex-1 lg:px-6 first:pl-0 first:lg:pl-0 last:pr-0">
                                        <div className="flex items-center gap-4 py-6 lg:flex-col lg:items-start lg:gap-0 lg:py-0">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                                <item.icon className="h-6 w-6 text-primary" />
                                            </div>
                                            <div className="lg:mt-4">
                                                <h3 className="text-lg font-semibold">{item.title}</h3>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                        {index < lifecycle.length - 1 && (
                                            <div className="flex justify-center py-1 lg:hidden">
                                                <ArrowDown className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Participant Journey */}
                <section id="how-it-works" className="py-20 bg-secondary/20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="mx-auto max-w-2xl text-center mb-16">
                            <h2 className="text-3xl font-bold tracking-tight">Your Participant Journey</h2>
                            <p className="mt-4 text-muted-foreground">
                                Getting started is easy. Here&apos;s what happens after you find a contest.
                            </p>
                        </div>
                        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                            {participantJourney.map((item, index) => (
                                <div key={item.step} className="relative">
                                    {index < participantJourney.length - 1 && (
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
                        <div className="mx-auto max-w-3xl">
                            <h2 className="text-3xl font-bold tracking-tight">
                                Create and Manage Contests with Ease
                            </h2>
                            <p className="mt-4 text-muted-foreground max-w-2xl">
                                QuizBuzz provides powerful tools for organizations to run the full
                                contest lifecycle — question bank to certificate — at scale.
                            </p>
                            <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                {[
                                    'Drag-and-drop question builder with multiple question types',
                                    'Automated participant management and communication',
                                    'Live monitoring and proctoring dashboard',
                                    'Exportable analytics and results reporting',
                                    'Automated certificate generation',
                                    'White-label options for your brand',
                                ].map((item) => (
                                    <li key={item} className="flex items-start gap-3">
                                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                                        <span className="text-sm">{item}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-8">
                                <Link href="/register">
                                    <Button size="lg" className="gap-2">
                                        <BarChart3 className="h-5 w-5" />
                                        Start Organizing
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
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
                            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center sm:flex-wrap">
                                <Link href="/contests">
                                    <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                                        <Trophy className="h-5 w-5" />
                                        Browse Contests
                                    </Button>
                                </Link>
                                <Link href="/register">
                                    <Button
                                        size="lg"
                                        variant="outline"
                                        className="w-full sm:w-auto gap-2 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                                    >
                                        <Globe className="h-5 w-5" />
                                        Start Organizing
                                    </Button>
                                </Link>
                                <BottomInstallButton />
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
