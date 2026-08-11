'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AppearanceSettingsTabContent() {
    const { theme, setTheme } = useTheme();

    return (
        <Card className="border-border/50">
            <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-bold tracking-tight">Appearance</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                    Customize your theme for a tailored experience
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">Theme</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        {/* Light Mode Option */}
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setTheme('light')}
                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between p-3.5 ${
                                    theme === 'light'
                                        ? 'border-sky-500 ring-2 ring-sky-500/20 bg-white'
                                        : 'border-border/70 bg-white hover:border-border'
                                }`}
                            >
                                {/* Mini Mock Card */}
                                <div className="w-full flex flex-col justify-between h-full">
                                    <div className="space-y-2">
                                        <div className="h-1.5 w-16 bg-slate-100 rounded-full" />
                                        <div className="h-1.5 w-24 bg-slate-100 rounded-full" />
                                    </div>
                                    <div className="h-2.5 w-8 bg-sky-500 rounded-full" />
                                </div>
                            </button>
                            <span className="text-xs font-semibold text-foreground mt-2.5 pl-1">Light mode</span>
                        </div>

                        {/* Dark Mode Option */}
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setTheme('dark')}
                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between p-3.5 ${
                                    theme === 'dark'
                                        ? 'border-sky-500 ring-2 ring-sky-500/20 bg-[#121212]'
                                        : 'border-border/70 bg-[#121212] hover:border-neutral-700'
                                }`}
                            >
                                {/* Mini Mock Card */}
                                <div className="w-full flex flex-col justify-between h-full">
                                    <div className="space-y-2">
                                        <div className="h-1.5 w-16 bg-neutral-800 rounded-full" />
                                        <div className="h-1.5 w-24 bg-neutral-800 rounded-full" />
                                    </div>
                                    <div className="h-2.5 w-8 bg-sky-500 rounded-full" />
                                </div>
                            </button>
                            <span className="text-xs font-semibold text-foreground mt-2.5 pl-1">Dark mode</span>
                        </div>

                        {/* Auto Option */}
                        <div className="flex flex-col">
                            <button
                                type="button"
                                onClick={() => setTheme('system')}
                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex ${
                                    theme === 'system'
                                        ? 'border-sky-500 ring-2 ring-sky-500/20'
                                        : 'border-border/70 hover:border-border'
                                }`}
                            >
                                {/* Mini Mock Card Split */}
                                <div className="w-1/2 bg-white h-full flex flex-col justify-between p-3.5 border-r border-slate-100">
                                    <div className="space-y-2">
                                        <div className="h-1.5 w-10 bg-slate-100 rounded-full" />
                                        <div className="h-1.5 w-14 bg-slate-100 rounded-full" />
                                    </div>
                                    <div className="h-2.5 w-6 bg-sky-500 rounded-full" />
                                </div>
                                <div className="w-1/2 bg-[#121212] h-full flex flex-col justify-between p-3.5">
                                    <div className="space-y-2">
                                        <div className="h-1.5 w-10 bg-neutral-800 rounded-full" />
                                        <div className="h-1.5 w-14 bg-neutral-800 rounded-full" />
                                    </div>
                                    <div className="h-2.5 w-6 bg-sky-500 rounded-full" />
                                </div>
                            </button>
                            <span className="text-xs font-semibold text-foreground mt-2.5 pl-1">Auto</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-secondary/10 p-4 flex items-start gap-3 mt-6">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 animate-pulse" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Active theme changes are applied instantly across the entire application interface, cookies, and local browser persistence contexts.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export default AppearanceSettingsTabContent;
