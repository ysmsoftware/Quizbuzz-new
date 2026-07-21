'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { usePayout } from '@/lib/hooks/use-payout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Globe, Palette, Loader2, Save, ExternalLink, ShieldCheck, Building2, Heart, Wallet, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChipSelect } from '@/components/shared/ChipSelect';
import { USE_CASES, ORG_SIZES, CONTEST_VOLUMES, PARTICIPANT_VOLUMES, HEARD_SOURCES } from '@/lib/constants/org-profile-options';

export default function SettingsPage() {
    const router = useRouter();
    const { activeOrg, admin, meQuery } = useAuth();
    const orgId = activeOrg?.id || '';
    const { org, loading: orgLoading, error: orgError, updateOrgMutation, updateOrgProfileMutation } = useOrganization(orgId);
    const { theme, setTheme } = useTheme();

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [formData, setFormData] = useState({
        orgName: '',
        website: '',
        logoUrl: '',
    });

    const [profileData, setProfileData] = useState({
        primaryUseCase: '',
        useCaseOther: '',
        sizeBucket: '',
        expectedContestsPerMonth: 'UNSURE',
        expectedParticipants: 'UNSURE',
        heardAboutSource: '',
        heardAboutOther: '',
        primaryContactName: '',
        primaryContactPhone: '',
        primaryContactEmail: '',
        country: '',
        state: '',
        city: '',
        timezone: '',
        preferredCurrency: 'INR',
        gstNumber: '',
        billingAddress: '',
        marketingOptIn: false,
    });

    // Populate initial form data when organization loads
    useEffect(() => {
        if (org) {
            setFormData({
                orgName: org.name || '',
                website: org.website || '',
                logoUrl: org.logoUrl || '',
            });
            if (org.profile) {
                setProfileData({
                    primaryUseCase: org.profile.primaryUseCase || '',
                    useCaseOther: org.profile.useCaseOther || '',
                    sizeBucket: org.profile.sizeBucket || '',
                    expectedContestsPerMonth: org.profile.expectedContestsPerMonth || 'UNSURE',
                    expectedParticipants: org.profile.expectedParticipants || 'UNSURE',
                    heardAboutSource: org.profile.heardAboutSource || '',
                    heardAboutOther: org.profile.heardAboutOther || '',
                    primaryContactName: org.profile.primaryContactName || '',
                    primaryContactPhone: org.profile.primaryContactPhone || '',
                    primaryContactEmail: org.profile.primaryContactEmail || '',
                    country: org.profile.country || '',
                    state: org.profile.state || '',
                    city: org.profile.city || '',
                    timezone: org.profile.timezone || '',
                    preferredCurrency: org.profile.preferredCurrency || 'INR',
                    gstNumber: org.profile.gstNumber || '',
                    billingAddress: org.profile.billingAddress || '',
                    marketingOptIn: !!org.profile.marketingOptIn,
                });
            }
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

    const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfileData(prev => ({ ...prev, [name]: value }));
    };

    const handleProfileSelectChange = (key: string, value: any) => {
        setProfileData(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) {
            toast.error('No active organization resolved');
            return;
        }

        setIsSavingProfile(true);
        try {
            const payload = { ...profileData };
            const cleanedData = Object.fromEntries(
                Object.entries(payload).map(([k, v]) => {
                    if (v === '') return [k, null];
                    return [k, v];
                })
            );

            await updateOrgProfileMutation.mutateAsync(cleanedData);
            toast.success('Organization profile details saved successfully');
        } catch (err: any) {
            console.error('Save organization profile error:', err);
            toast.error(err?.message || 'An error occurred while saving organization profile');
        } finally {
            setIsSavingProfile(false);
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
                    <Link href="/org">
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
                    <Link href="/org" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back</span>
                    </Link>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <div className="w-[60px]" />
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
                <Tabs defaultValue="general" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
                        <TabsTrigger value="general" className="gap-2">
                            <Globe className="h-4 w-4" />
                            <span>General</span>
                        </TabsTrigger>
                        <TabsTrigger value="profile" className="gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>Profile Details</span>
                        </TabsTrigger>
                        <TabsTrigger value="payouts" className="gap-2">
                            <Wallet className="h-4 w-4" />
                            <span>Payouts</span>
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
                                                <span className="select-none text-muted-foreground/60 pr-1">ysmquizbuzz.com/org/</span>
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

                    {/* Organization Profile Details Tab */}
                    <TabsContent value="profile" className="space-y-6">
                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            {/* Card 1: About your organization */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle>About Your Organization</CardTitle>
                                    <CardDescription>Configure primary use cases and size attributes</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>What best describes your organization?</Label>
                                            <ChipSelect
                                                options={USE_CASES as any}
                                                value={profileData.primaryUseCase}
                                                onChange={(v) => handleProfileSelectChange('primaryUseCase', v)}
                                            />
                                            {profileData.primaryUseCase === 'OTHER' && (
                                                <Input
                                                    name="useCaseOther"
                                                    placeholder="Describe your use case..."
                                                    value={profileData.useCaseOther}
                                                    onChange={handleProfileInputChange}
                                                    className="mt-2"
                                                />
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Organization size</Label>
                                            <ChipSelect
                                                options={ORG_SIZES as any}
                                                value={profileData.sizeBucket}
                                                onChange={(v) => handleProfileSelectChange('sizeBucket', v)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Expected contests per month</Label>
                                                <ChipSelect
                                                    options={CONTEST_VOLUMES as any}
                                                    value={profileData.expectedContestsPerMonth}
                                                    onChange={(v) => handleProfileSelectChange('expectedContestsPerMonth', v)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Expected participants per contest</Label>
                                                <ChipSelect
                                                    options={PARTICIPANT_VOLUMES as any}
                                                    value={profileData.expectedParticipants}
                                                    onChange={(v) => handleProfileSelectChange('expectedParticipants', v)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Card 2: Contact & locale details */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle>Contact & Locale Details</CardTitle>
                                    <CardDescription>Primary administrative contact info and geographic localization settings</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="set-primary-name">Contact Name</Label>
                                            <Input
                                                id="set-primary-name"
                                                name="primaryContactName"
                                                placeholder="Jane Smith"
                                                value={profileData.primaryContactName}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="set-primary-email">Contact Email</Label>
                                            <Input
                                                id="set-primary-email"
                                                name="primaryContactEmail"
                                                type="email"
                                                placeholder="jane@yourorg.com"
                                                value={profileData.primaryContactEmail}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="set-primary-phone">Contact Phone</Label>
                                            <Input
                                                id="set-primary-phone"
                                                name="primaryContactPhone"
                                                placeholder="+91 98765 43210"
                                                value={profileData.primaryContactPhone}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="set-country">Country</Label>
                                            <Input
                                                id="set-country"
                                                name="country"
                                                placeholder="India"
                                                value={profileData.country}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="set-state">State</Label>
                                            <Input
                                                id="set-state"
                                                name="state"
                                                placeholder="Maharashtra"
                                                value={profileData.state}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="set-city">City</Label>
                                            <Input
                                                id="set-city"
                                                name="city"
                                                placeholder="Mumbai"
                                                value={profileData.city}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="set-timezone">Timezone</Label>
                                            <Input
                                                id="set-timezone"
                                                name="timezone"
                                                placeholder="Asia/Kolkata"
                                                value={profileData.timezone}
                                                onChange={handleProfileInputChange}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="set-currency">Preferred Currency</Label>
                                            <Input
                                                id="set-currency"
                                                name="preferredCurrency"
                                                placeholder="INR"
                                                maxLength={3}
                                                value={profileData.preferredCurrency}
                                                onChange={(e) => handleProfileSelectChange('preferredCurrency', e.target.value.toUpperCase())}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Card 3: Billing details */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle>Billing Details</CardTitle>
                                    <CardDescription>Tax registration numbers and billing address metadata</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="set-gst">GST Number (Optional)</Label>
                                        <Input
                                            id="set-gst"
                                            name="gstNumber"
                                            placeholder="22AAAAA0000A1Z5"
                                            value={profileData.gstNumber}
                                            onChange={handleProfileInputChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="set-billing">Billing Address (Optional)</Label>
                                        <Input
                                            id="set-billing"
                                            name="billingAddress"
                                            placeholder="123 Main St, Mumbai, MH 400001"
                                            value={profileData.billingAddress}
                                            onChange={handleProfileInputChange}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Card 4: Preferences */}
                            <Card className="border-border/50">
                                <CardHeader>
                                    <CardTitle>Preferences</CardTitle>
                                    <CardDescription>Configure notifications and updates options</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/40">
                                        <Heart className="h-5 w-5 text-primary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">Stay in the loop</p>
                                            <p className="text-xs text-muted-foreground">
                                                Receive product updates, tips, and feature announcements
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleProfileSelectChange('marketingOptIn', !profileData.marketingOptIn)}
                                            aria-label="Toggle marketing emails"
                                            className={cn(
                                                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                profileData.marketingOptIn ? 'bg-primary' : 'bg-muted'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                                    profileData.marketingOptIn ? 'translate-x-5' : 'translate-x-0'
                                                )}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex justify-end pt-2">
                                        <Button type="submit" disabled={isSavingProfile} className="gap-2">
                                            {isSavingProfile ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Save className="h-4 w-4" />
                                            )}
                                            {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>
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
                                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between p-3.5 ${theme === 'light'
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
                                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between p-3.5 ${theme === 'dark'
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
                                                className={`group relative w-full h-28 rounded-xl border-2 overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex ${theme === 'system'
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

                    {/* Payouts Settings Tab */}
                    <TabsContent value="payouts">
                        <PayoutsTabContent />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

function PayoutsTabContent() {
    const { account, status, isActive, loading, setupAccountMutation, attachLinkedAccountMutation } = usePayout();

    const [payoutForm, setPayoutForm] = useState({
        accountName: '',
        accountEmail: '',
        contactNumber: '',
    });
    const [linkedAccountIdInput, setLinkedAccountIdInput] = useState('');

    useEffect(() => {
        if (account) {
            setPayoutForm({
                accountName: account.accountName || '',
                accountEmail: account.accountEmail || '',
                contactNumber: account.contactNumber || '',
            });
            if (account.razorpayLinkedAccountId) {
                setLinkedAccountIdInput(account.razorpayLinkedAccountId);
            }
        }
    }, [account]);

    const handleSavePayoutSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payoutForm.accountName || !payoutForm.accountEmail) {
            toast.error('Account name and email are required');
            return;
        }
        try {
            await setupAccountMutation.mutateAsync({
                accountName: payoutForm.accountName,
                accountEmail: payoutForm.accountEmail,
                contactNumber: payoutForm.contactNumber || undefined,
            });
            toast.success('Payout account details saved');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to save payout details');
        }
    };

    const handleAttachLinkedAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkedAccountIdInput.startsWith('acc_')) {
            toast.error('Razorpay linked account ID must start with acc_');
            return;
        }
        try {
            await attachLinkedAccountMutation.mutateAsync({
                razorpayLinkedAccountId: linkedAccountIdInput.trim(),
            });
            toast.success('Linked account attached and activated successfully!');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to attach linked account');
        }
    };

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Card */}
            <Card className="border-border/50">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-bold">Payout Account Status</CardTitle>
                            <CardDescription>Configure payouts to receive contest registration funds automatically via Razorpay Route</CardDescription>
                        </div>
                        <div>
                            {isActive && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> ACTIVE
                                </span>
                            )}
                            {status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    <Clock className="h-3.5 w-3.5" /> PENDING VERIFICATION
                                </span>
                            )}
                            {status === 'VERIFICATION_FAILED' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                    <AlertTriangle className="h-3.5 w-3.5" /> FAILED
                                </span>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isActive ? (
                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                Payouts are fully enabled for your organization!
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Linked Account ID: <span className="font-mono font-bold text-foreground">{account?.razorpayLinkedAccountId}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Registration fees collected from participants will automatically transfer to your bank account after platform commission deduction.
                            </p>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                Payout account setup is pending
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Complete your payout details below. Creating paid contests will be enabled once your Razorpay Route Linked Account is linked and marked Active.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Account Details Form */}
            <form onSubmit={handleSavePayoutSetup}>
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle>Payout Contact & Account Details</CardTitle>
                        <CardDescription>Enter primary business details for receiving Route transfers</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="payout-name">Legal Business / Account Holder Name</Label>
                                <Input
                                    id="payout-name"
                                    value={payoutForm.accountName}
                                    onChange={(e) => setPayoutForm((p) => ({ ...p, accountName: e.target.value }))}
                                    placeholder="Acme Education Pvt Ltd"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="payout-email">Payout Email Address</Label>
                                <Input
                                    id="payout-email"
                                    type="email"
                                    value={payoutForm.accountEmail}
                                    onChange={(e) => setPayoutForm((p) => ({ ...p, accountEmail: e.target.value }))}
                                    placeholder="payouts@acme.com"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="payout-phone">Contact Phone Number (Optional)</Label>
                            <Input
                                id="payout-phone"
                                value={payoutForm.contactNumber}
                                onChange={(e) => setPayoutForm((p) => ({ ...p, contactNumber: e.target.value }))}
                                placeholder="+91 98765 43210"
                            />
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={setupAccountMutation.isPending} className="gap-2">
                                {setupAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Details
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>

            {/* Manual Link Attachment (Admin / Dev Helper) */}
            <form onSubmit={handleAttachLinkedAccount}>
                <Card className="border-border/50 bg-secondary/10">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Razorpay Linked Account ID</CardTitle>
                        <CardDescription>
                            Attach your Razorpay Linked Account ID (<code className="font-mono text-xs">acc_...</code>) from your Razorpay Dashboard (Route → Linked Accounts).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Input
                                value={linkedAccountIdInput}
                                onChange={(e) => setLinkedAccountIdInput(e.target.value)}
                                placeholder="acc_N1x23456789"
                                className="font-mono text-sm"
                            />
                            <Button type="submit" disabled={attachLinkedAccountMutation.isPending || !linkedAccountIdInput} variant="outline">
                                {attachLinkedAccountMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Attach & Activate'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
