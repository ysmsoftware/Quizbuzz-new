// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { MotionConfig } from 'framer-motion'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { PostHogProvider } from '@/components/providers/posthog-provider'
import { Toaster } from '@/components/ui/sonner'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { MaintenanceBanner } from '@/components/layout/MaintenanceBanner'
import { Suspense } from 'react'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_KEYWORDS, SOCIAL_IMAGE, TWITTER_HANDLE } from '@/lib/seo/config'
import { OrganizationJsonLd } from '@/lib/seo/json-ld'
import './globals.css'

const geistSans = Geist({ subsets: ["latin"], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: '--font-geist-mono' });

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'QuizBuzz - Multi-Tenant Quiz Platform',
        template: '%s | QuizBuzz'
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: SITE_NAME,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    category: 'education',
    alternates: {
        canonical: '/',
    },
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icon.png', type: 'image/png', sizes: '32x32' },
        ],
        shortcut: ['/favicon.ico'],
        apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'QuizBuzz',
    },
    openGraph: {
        type: 'website',
        url: SITE_URL,
        siteName: SITE_NAME,
        title: 'QuizBuzz - Multi-Tenant Quiz Platform',
        description: SITE_DESCRIPTION,
        locale: 'en_US',
        images: [
            {
                url: SOCIAL_IMAGE,
                width: 1200,
                height: 630,
                alt: 'QuizBuzz — Real-Time Quiz Contests',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'QuizBuzz - Multi-Tenant Quiz Platform',
        description: SITE_DESCRIPTION,
        images: [SOCIAL_IMAGE],
        ...(TWITTER_HANDLE ? { site: TWITTER_HANDLE, creator: TWITTER_HANDLE } : {}),
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
    // Once you have accounts set up, drop the verification codes in here —
    // e.g. Google Search Console, Bing Webmaster Tools:
    // verification: { google: 'xxxx', other: { 'msvalidate.01': 'xxxx' } },
    other: {
        // Helps AI crawlers/agents discover the llms.txt convention file quickly.
        'llms-txt': '/llms.txt',
    },
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
                <OrganizationJsonLd />
            </head>
            <body className="font-sans antialiased bg-background text-foreground">
                <MotionConfig reducedMotion="user">
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                        <MaintenanceBanner />
                        <QueryProvider>
                            <Suspense>
                                <PostHogProvider>
                                    {children}
                                </PostHogProvider>
                            </Suspense>
                        </QueryProvider>
                        <Toaster />
                        <InstallPrompt />
                    </ThemeProvider>
                </MotionConfig>
            </body>
        </html>
    )
}