// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { PostHogProvider } from '@/components/providers/posthog-provider'
import { Toaster } from '@/components/ui/sonner'
import { Suspense } from 'react'
import './globals.css'

const geistSans = Geist({ subsets: ["latin"], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-geist-mono' });

export const metadata: Metadata = {
    title: {
        default: 'QuizBuzz - Multi-Tenant Quiz Platform',
        template: '%s | QuizBuzz'
    },
    description: 'Create, manage, and participate in quizzes and contests with real-time proctoring, leaderboards, and comprehensive analytics.',
    keywords: ['quiz', 'contest', 'assessment', 'education', 'proctoring', 'leaderboard'],
}

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#0d9488' },
        { media: '(prefers-color-scheme: dark)', color: '#14b8a6' }
    ],
    width: 'device-width',
    initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{const t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})()`,
                    }}
                />
            </head>
            <body className="font-sans antialiased bg-background text-foreground">
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    <QueryProvider>
                        <Suspense>
                            <PostHogProvider>
                                {children}
                            </PostHogProvider>
                        </Suspense>
                    </QueryProvider>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    )
}