'use client';

import { useEffect, useState, useRef } from 'react';
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
    ChevronLeft,
    User,
    Award,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Contests', href: '/admin/contests', icon: Trophy },
    { label: 'Questions', href: '/admin/questions', icon: HelpCircle },
    { label: 'Contacts', href: '/admin/contacts', icon: Users },
    { label: 'Messages', href: '/admin/messages', icon: BarChart3 },
    { label: 'Certificates', href: '/admin/certificates', icon: Award },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isLoggedIn, isEmailVerified, admin, activeOrg, logoutMutation, meQuery } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const sidebarRef = useRef<HTMLDivElement>(null);
    const headerNameBarRef = useRef<HTMLDivElement>(null);

    // Automatically close or collapse sidebar when clicking/touching outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent | TouchEvent) {
            if (!sidebarOpen) return;

            const isClickInsideSidebar = sidebarRef.current && sidebarRef.current.contains(event.target as Node);
            const isClickInsideHeaderNameBar = headerNameBarRef.current && headerNameBarRef.current.contains(event.target as Node);

            if (!isClickInsideSidebar && !isClickInsideHeaderNameBar) {
                setSidebarOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [sidebarOpen]);

    // Protect route — redirect if not logged in or email not verified
    useEffect(() => {
        if (!meQuery.isLoading) {
            if (!isLoggedIn) {
                router.push('/login');
            } else if (!isEmailVerified) {
                router.push(`/verify-email?email=${encodeURIComponent(admin?.email || '')}`);
            }
        }
    }, [isLoggedIn, isEmailVerified, meQuery.isLoading, admin, router]);

    const handleLogout = async () => {
        try {
            await logoutMutation.mutateAsync();
            // onSuccess / onError in useAuth handles cache clearing + redirect.
        } catch (err) {
            console.error('Logout error:', err);
            // Last-resort: hard redirect to /login in case the mutation error handler didn't fire.
            window.location.replace('/login');
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
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <aside
                ref={sidebarRef}
                className={cn(
                    "fixed inset-y-0 left-0 z-50 border-r border-border/40 bg-background/80 backdrop-blur-xl transition-all duration-300 ease-in-out flex flex-col shrink-0 shadow-lg shadow-background/5",
                    sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
                    "md:sticky md:top-0 md:translate-x-0 md:h-screen",
                    sidebarOpen ? "md:w-64" : "md:w-20"
                )}
            >
                {/* Logo / Sidebar Name Bar */}
                <div
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className={cn(
                        "border-b border-border/40 p-6 shrink-0 cursor-pointer hover:bg-secondary/40 transition-colors flex items-center justify-between",
                        !sidebarOpen && "justify-center p-5"
                    )}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {sidebarOpen ? (
                            <motion.div
                                key="expanded-logo"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col min-w-0 flex-1"
                            >
                                <span className="text-2xl font-bold text-primary truncate block">
                                    {activeOrg?.name || 'QuizBuzz'}
                                </span>
                                <p className="text-xs text-muted-foreground mt-1">Admin Panel</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="collapsed-logo"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-xl shadow-inner border border-primary/20"
                            >
                                {(activeOrg?.name || 'QuizBuzz').substring(0, 2).toUpperCase()}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {sidebarOpen && (
                        <ChevronLeft className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2" />
                    )}
                </div>

                {/* Navigation */}
                <TooltipProvider delayDuration={100}>
                    <nav className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;

                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>
                                        <Link href={item.href} className="relative block w-full group">
                                            {/* Sliding active pill indicator */}
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeAdminNavIndicator"
                                                    className="absolute inset-0 bg-primary rounded-lg shadow-lg shadow-primary/15"
                                                    transition={{
                                                        type: 'spring',
                                                        stiffness: 380,
                                                        damping: 30,
                                                    }}
                                                />
                                            )}
                                            <button
                                                className={cn(
                                                    "relative w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-300 cursor-pointer outline-none text-left",
                                                    isActive
                                                        ? "text-primary-foreground font-semibold"
                                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                                                    !sidebarOpen && "justify-center px-0"
                                                )}
                                                onClick={() => {
                                                    if (window.innerWidth < 768) {
                                                        setSidebarOpen(false);
                                                    }
                                                }}
                                            >
                                                <Icon className={cn(
                                                    "h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                                                    isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                )} />

                                                <AnimatePresence initial={false}>
                                                    {sidebarOpen && (
                                                        <motion.span
                                                            initial={{ opacity: 0, width: 0 }}
                                                            animate={{ opacity: 1, width: 'auto' }}
                                                            exit={{ opacity: 0, width: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="font-medium whitespace-nowrap overflow-hidden"
                                                        >
                                                            {item.label}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </button>
                                        </Link>
                                    </TooltipTrigger>
                                    {!sidebarOpen && (
                                        <TooltipContent side="right" sideOffset={10}>
                                            {item.label}
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            );
                        })}
                    </nav>

                    {/* User Info and Logout */}
                    <div className="border-t border-border/40 p-4 space-y-3 shrink-0">
                        <AnimatePresence mode="wait" initial={false}>
                            {sidebarOpen ? (
                                <motion.div
                                    key="expanded-user"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.2 }}
                                    className="px-4 py-2 rounded-lg bg-secondary/50 min-w-0"
                                >
                                    <p className="text-xs text-muted-foreground">Logged in as</p>
                                    <p className="text-sm font-medium truncate">{admin?.email}</p>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="collapsed-user"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex justify-center"
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center cursor-help">
                                                <User className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" sideOffset={10}>
                                            Logged in as: {admin?.email}
                                        </TooltipContent>
                                    </Tooltip>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className={cn(
                                        "w-full gap-2 transition-all duration-300 shrink-0",
                                        !sidebarOpen && "justify-center p-0 h-10 w-10 rounded-full mx-auto"
                                    )}
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4 shrink-0" />
                                    {sidebarOpen && <span>Logout</span>}
                                </Button>
                            </TooltipTrigger>
                            {!sidebarOpen && (
                                <TooltipContent side="right" sideOffset={10}>
                                    Logout
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </div>
                </TooltipProvider>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                {/* Top Bar */}
                <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl shrink-0">
                    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="md:hidden"
                        >
                            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </Button>

                        <div
                            ref={headerNameBarRef}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-secondary/40 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-border/30 select-none"
                        >
                            <h1 className="text-lg font-semibold">{activeOrg?.name || 'QuizBuzz'} Dashboard</h1>
                            <motion.div
                                animate={{ rotate: sidebarOpen ? 0 : 180 }}
                                transition={{ duration: 0.3 }}
                                className="hidden md:block text-muted-foreground shrink-0"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </motion.div>
                        </div>


                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
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
