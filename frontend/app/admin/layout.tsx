'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Trophy,
    HelpCircle,
    Users,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Contests', href: '/admin/contests', icon: Trophy },
    { label: 'Questions', href: '/admin/questions', icon: HelpCircle },
    { label: 'Contacts', href: '/admin/contacts', icon: Users },
    { label: 'Messages', href: '/admin/messages', icon: BarChart3 }, // Changing icon/label as well for messages
    { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isLoggedIn, admin, activeOrg, logoutMutation, meQuery } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Protect route — redirect if not logged in
    useEffect(() => {
        if (!meQuery.isLoading && !isLoggedIn) {
            router.push('/login');
        }
    }, [isLoggedIn, meQuery.isLoading, router]);

    const handleLogout = async () => {
        try {
            await logoutMutation.mutateAsync();
        } catch (err) {
            console.error('Logout error:', err);
            // Still redirect even if logout fails
            router.push('/');
        }
    };

    // Show loading state while checking auth
    if (meQuery.isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="inline-block">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                    <p className="text-muted-foreground">Checking authentication...</p>
                </div>
            </div>
        );
    }

    // Final check to prevent layout flash before redirect
    if (!isLoggedIn) return null;

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-border/50 bg-background transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } md:static md:translate-x-0`}
            >
                {/* Logo */}
                <div className="border-b border-border/50 p-6">
                    <Link href="/admin" className="text-2xl font-bold text-primary">
                        {activeOrg?.name || 'QuizBuzz'}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-2 p-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link key={item.href} href={item.href}>
                                <button
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-foreground hover:bg-secondary'
                                        }`}
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setSidebarOpen(false);
                                        }
                                    }}
                                >
                                    <Icon className="h-5 w-5" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info and Logout */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-border/50 p-4 space-y-3">
                    <div className="px-4 py-2 rounded-lg bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Logged in as</p>
                        <p className="text-sm font-medium truncate">{admin?.email}</p>
                    </div>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleLogout}
                    >
                        <LogOut className="h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <header className="sticky top-0 z-40 border-b border-border/50 bg-background/95 backdrop-blur">
                    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden"
                        >
                            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>

                        <div className="flex-1 md:flex-none">
                            <h1 className="text-lg font-semibold">{activeOrg?.name} Dashboard</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground hidden sm:inline">
                                Welcome, {admin?.firstName || admin?.email?.split('@')[0]}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        <WidgetErrorBoundary name="Admin Content">
                            {children}
                        </WidgetErrorBoundary>
                    </div>
                </main>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
}
