'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Globe, Palette, Loader2, Save, ExternalLink, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
    const router = useRouter();
    const { activeOrg, admin, meQuery } = useAuth();
    const orgId = activeOrg?.id || '';
    const { org, loading: orgLoading, error: orgError, updateOrgMutation } = useOrganization(orgId);
    const { theme, setTheme } = useTheme();

    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        orgName: '',
        website: '',
        logoUrl: '',
    });

    // Populate initial form data when organization loads
    useEffect(() => {
        if (org) {
            setFormData({
                orgName: org.name || '',
                website: org.website || '',
                logoUrl: org.logoUrl || '',
            });
        }
    }, [org]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) {
            toast.error('No active organization resolved');
            return;
        }

        setIsSaving(true);
        try {
            // Validate Inputs
            if (!formData.orgName.trim() || formData.orgName.trim().length < 2) {
                toast.error('Organization Name must be at least 2 characters');
                setIsSaving(false);
                return;
            }

            if (formData.website && !formData.website.startsWith('http://') && !formData.website.startsWith('https://')) {
                toast.error('Website must be a valid URL starting with http:// or https://');
                setIsSaving(false);
                return;
            }

            if (formData.logoUrl && !formData.logoUrl.startsWith('http://') && !formData.logoUrl.startsWith('https://')) {
                toast.error('Logo must be a valid URL starting with http:// or https://');
                setIsSaving(false);
                return;
            }

            await updateOrgMutation.mutateAsync({
                name: formData.orgName.trim(),
                website: formData.website.trim() || undefined,
                logoUrl: formData.logoUrl.trim() || undefined,
            });

            toast.success('Organization settings saved successfully');
        } catch (err: any) {
            console.error('Save organization error:', err);
            toast.error(err?.message || 'An error occurred while saving organization settings');
        } finally {
            setIsSaving(false);
        }
    };

    // Show loading state
    const isLoading = meQuery.isLoading || orgLoading;
    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-200px)] items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground text-sm">Loading settings details...</p>
                </div>
            </div>
        );
    }

    if (orgError || !org) {
        return (
            <div className="mx-auto max-w-4xl p-6">
                <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6 text-center space-y-4">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">Failed to load organization settings</CardTitle>
                        <CardDescription className="text-destructive/80">
                            {orgError || 'Organization context not resolved. Please ensure you are logged into an active workspace.'}
                        </CardDescription>
                    </CardHeader>
                    <Link href="/admin">
                        <Button variant="outline" className="mt-4">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                        </Button>
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back</span>
                    </Link>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <div className="w-[60px]" />
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
                <Tabs defaultValue="general" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
                        <TabsTrigger value="general" className="gap-2">
                            <Globe className="h-4 w-4" />
                            <span>General</span>
                        </TabsTrigger>
                        <TabsTrigger value="appearance" className="gap-2">
                            <Palette className="h-4 w-4" />
                            <span>Appearance</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* General Settings Tab */}
                    <TabsContent value="general" className="space-y-6">
                        <form onSubmit={handleSaveGeneral} className="space-y-6">
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle>Organization Settings</CardTitle>
                                    <CardDescription>Manage your workspace details and branding metadata</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground">Organization Name</label>
                                            <Input
                                                name="orgName"
                                                value={formData.orgName}
                                                onChange={handleInputChange}
                                                placeholder="Your organization name"
                                                className="mt-2"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-foreground flex justify-between">
                                                <span>Workspace URL Slug</span>
                                                <span className="text-xs text-muted-foreground font-normal">Read-only</span>
                                            </label>
                                            <div className="mt-2 flex items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                                <span className="select-none text-muted-foreground/60 pr-1">quizbuzz.com/org/</span>
                                                <span className="font-semibold text-foreground">{org.slug}</span>
                                            </div>
                                            <p className="mt-1.5 text-xs text-muted-foreground">
                                                The workspace slug is established during registration and cannot be modified.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-foreground">Website</label>
                                            <Input
                                                name="website"
                                                type="url"
                                                value={formData.website}
                                                onChange={handleInputChange}
                                                placeholder="https://example.com"
                                                className="mt-2"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-foreground">Logo URL</label>
                                            <Input
                                                name="logoUrl"
                                                type="url"
                                                value={formData.logoUrl}
                                                onChange={handleInputChange}
                                                placeholder="https://example.com/logo.png"
                                                className="mt-2"
                                            />
                                            {formData.logoUrl && (
                                                <div className="mt-4 flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-secondary/20">
                                                    <img
                                                        src={formData.logoUrl}
                                                        alt="Logo preview"
                                                        className="h-12 w-12 rounded object-contain border bg-white"
                                                        onError={(e) => {
                                                            (e.target as HTMLElement).style.display = 'none';
                                                        }}
                                                    />
                                                    <div>
                                                        <span className="text-xs font-semibold text-foreground block">Logo Preview</span>
                                                        <span className="text-xs text-muted-foreground block truncate max-w-xs">{formData.logoUrl}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button type="submit" disabled={isSaving} className="gap-2">
                                            {isSaving ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            {isSaving ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>

                        {/* Admin Profile Details Card */}
                        {admin && (
                            <Card className="border-border/50 bg-secondary/10">
                                <CardHeader>
                                    <div className="flex items-center gap-2 text-primary">
                                        <ShieldCheck className="h-5 w-5" />
                                        <CardTitle className="text-lg font-bold">Admin Profile Account</CardTitle>
                                    </div>
                                    <CardDescription>Details of the authenticated user currently managing this workspace</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-3 rounded-lg border bg-background/50">
                                            <span className="text-xs font-medium text-muted-foreground block">Admin User</span>
                                            <span className="text-sm font-semibold text-foreground block mt-1">
                                                {admin.firstName} {admin.lastName}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg border bg-background/50">
                                            <span className="text-xs font-medium text-muted-foreground block">Email Address</span>
                                            <span className="text-sm font-semibold text-foreground block mt-1">
                                                {admin.email}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* Appearance Settings Tab */}
                    <TabsContent value="appearance">
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
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
