'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Globe, Palette, Loader2, Building2, CreditCard, Users } from 'lucide-react';
import { PlanBillingTabContent } from '@/components/features/organization/PlanBillingTabContent';
import { MembersTabContent } from '@/components/features/organization/MembersTabContent';
import { GeneralSettingsTabContent } from '@/components/features/organization/GeneralSettingsTabContent';
import { ProfileDetailsTabContent } from '@/components/features/organization/ProfileDetailsTabContent';
import { AppearanceSettingsTabContent } from '@/components/features/organization/AppearanceSettingsTabContent';

export default function SettingsPage() {
    const router = useRouter();
    const { activeOrg, admin, meQuery } = useAuth();
    const orgId = activeOrg?.id || '';
    const { org, loading: orgLoading, error: orgError, updateOrgMutation, updateOrgProfileMutation } = useOrganization(orgId);

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tabParam = params.get('tab');
            if (tabParam) setActiveTab(tabParam);

            const subStatus = params.get('subscription');
            if (subStatus === 'success') {
                toast.success('Subscription updated successfully! Your new plan features are now active.');
            } else if (subStatus === 'failed') {
                toast.error('Payment was not completed or failed. Your plan was not changed.');
            }
        }
    }, []);

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
                    <Link href="/org" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back</span>
                    </Link>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <div className="w-[60px]" />
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col md:flex-row gap-8 items-start">
                    <TabsList className="flex flex-col w-full md:w-64 h-auto p-2 bg-card/60 rounded-xl border border-border/50 gap-1 shrink-0 sticky top-20">
                        <TabsTrigger
                            value="general"
                            className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm cursor-pointer"
                        >
                            <Globe className="h-4 w-4 shrink-0" />
                            <span>General</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="members"
                            className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm cursor-pointer"
                        >
                            <Users className="h-4 w-4 shrink-0" />
                            <span>Members</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="profile"
                            className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm cursor-pointer"
                        >
                            <Building2 className="h-4 w-4 shrink-0" />
                            <span>Profile Details</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="billing"
                            className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm cursor-pointer"
                        >
                            <CreditCard className="h-4 w-4 shrink-0" />
                            <span>Plan & Billing</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="appearance"
                            className="w-full justify-start gap-3 px-3.5 py-2.5 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm cursor-pointer"
                        >
                            <Palette className="h-4 w-4 shrink-0" />
                            <span>Appearance</span>
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 w-full min-w-0">
                        <TabsContent value="general" className="mt-0 space-y-6 focus-visible:outline-none">
                            <GeneralSettingsTabContent
                                formData={formData}
                                org={org}
                                admin={admin}
                                isSaving={isSaving}
                                handleInputChange={handleInputChange}
                                handleSaveGeneral={handleSaveGeneral}
                            />
                        </TabsContent>

                        <TabsContent value="members" className="mt-0 space-y-6 focus-visible:outline-none">
                            <MembersTabContent orgId={orgId} />
                        </TabsContent>

                        <TabsContent value="profile" className="mt-0 space-y-6 focus-visible:outline-none">
                            <ProfileDetailsTabContent
                                profileData={profileData}
                                isSavingProfile={isSavingProfile}
                                handleProfileInputChange={handleProfileInputChange}
                                handleProfileSelectChange={handleProfileSelectChange}
                                handleSaveProfile={handleSaveProfile}
                            />
                        </TabsContent>

                        <TabsContent value="billing" className="mt-0 space-y-6 focus-visible:outline-none">
                            <PlanBillingTabContent org={org} />
                        </TabsContent>

                        <TabsContent value="appearance" className="mt-0 space-y-6 focus-visible:outline-none">
                            <AppearanceSettingsTabContent />
                        </TabsContent>
                    </div>
                </Tabs>
            </main>
        </div>
    );
}
