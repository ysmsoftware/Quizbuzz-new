'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChipSelect } from '@/components/shared/ChipSelect';
import { Heart, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { USE_CASES, ORG_SIZES, CONTEST_VOLUMES, PARTICIPANT_VOLUMES } from '@/lib/constants/org-profile-options';

interface ProfileDetailsTabContentProps {
    profileData: {
        primaryUseCase: string;
        useCaseOther: string;
        sizeBucket: string;
        expectedContestsPerMonth: string;
        expectedParticipants: string;
        heardAboutSource: string;
        heardAboutOther: string;
        primaryContactName: string;
        primaryContactPhone: string;
        primaryContactEmail: string;
        country: string;
        state: string;
        city: string;
        timezone: string;
        preferredCurrency: string;
        gstNumber: string;
        billingAddress: string;
        marketingOptIn: boolean;
    };
    isSavingProfile: boolean;
    handleProfileInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleProfileSelectChange: (key: string, value: any) => void;
    handleSaveProfile: (e: React.FormEvent) => void;
}

export function ProfileDetailsTabContent({
    profileData,
    isSavingProfile,
    handleProfileInputChange,
    handleProfileSelectChange,
    handleSaveProfile,
}: ProfileDetailsTabContentProps) {
    return (
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
    );
}

export default ProfileDetailsTabContent;
