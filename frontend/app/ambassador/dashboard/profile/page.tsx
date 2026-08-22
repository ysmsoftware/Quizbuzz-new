'use client';

import { useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Camera, LogOut, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { useUpdateAmbassadorProfile } from '@/lib/hooks/useUpdateAmbassadorProfile';
import { useAmbassadorProfileImage } from '@/lib/hooks/useAmbassadorProfileImage';
import { useAmbassadorLogout } from '@/lib/hooks/useAmbassadorLogout';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useMyCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { AmbassadorApiError } from '@/lib/services/ambassador-service';
import { AmbassadorAvatar } from '@/components/features/ambassador/AmbassadorAvatar';
import { ApplicationDetailsCard } from '@/components/features/ambassador/ApplicationDetailsCard';
import { VerificationDocumentCard } from '@/components/features/ambassador/VerificationDocumentCard';
import { MyApplicationsCard } from '@/components/features/ambassador/MyApplicationsCard';
import { Rupees } from '@/components/features/ambassador/Rupees';
import type { Ambassador } from '@/lib/types/ambassador';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export default function AmbassadorProfilePage() {
  const { ambassador } = useAmbassadorMe();
  if (!ambassador) return null;
  return <ProfileContent ambassador={ambassador} />;
}

function ProfileContent({ ambassador }: { ambassador: Ambassador }) {
  const { updateProfile, isUpdating } = useUpdateAmbassadorProfile();
  const { uploadPhoto, removePhoto, isUploading: isUploadingPhoto } = useAmbassadorProfileImage();
  const { logout, isLoggingOut } = useAmbassadorLogout();
  const { types: platformTypes } = usePlatformAmbassadorTypes();
  const { campaigns } = useMyCampaigns({ limit: 100 });
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Every "what fields does this ambassador type ask for" answer comes from the live
  // platform catalog, not from whatever was captured at this person's signup time — a type
  // can gain/rename/drop fields afterward (managed on the ops side), and this page should
  // always reflect the current definition, not a stale snapshot.
  const type = platformTypes.find((t) => t.key === ambassador.ambassadorType);

  const approvedCampaigns = useMemo(() => campaigns.filter((c) => c.status === 'APPROVED'), [campaigns]);
  const stats = useMemo(
    () => ({
      campaigns: campaigns.length,
      registrations: approvedCampaigns.reduce((sum, c) => sum + c.stats.registrationCount, 0),
      earned: approvedCampaigns.reduce((sum, c) => sum + c.stats.accruedAmount, 0),
    }),
    [campaigns, approvedCampaigns]
  );

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: ambassador.firstName,
      lastName: ambassador.lastName ?? '',
      phone: ambassador.phone ?? '',
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await updateProfile({
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone || undefined,
      });
      toast.success('Profile updated');
    } catch (err) {
      if (err instanceof AmbassadorApiError && err.violations?.length) {
        err.violations.forEach((v) => form.setError(v.field as keyof ProfileFormData, { message: v.issue }));
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) uploadPhoto(file);
    e.currentTarget.value = '';
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        {/* Identity header — mirrors the dashboard's IdentityHero treatment so the profile
            page reads as the same product, not a bolted-on settings form. */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 sm:p-7 mb-6">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(420px 220px at 10% -20%, color-mix(in oklch, var(--primary) 18%, transparent), transparent), radial-gradient(340px 200px at 95% 130%, color-mix(in oklch, var(--accent) 28%, transparent), transparent)',
            }}
          />
          <div className="relative flex flex-wrap items-center gap-5">
            <div className="relative shrink-0">
              <AmbassadorAvatar
                firstName={ambassador.firstName}
                lastName={ambassador.lastName}
                profileImageUrl={ambassador.profileImageUrl}
                size={72}
                className="shadow-lg shadow-primary/20"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card border-2 border-background text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>

            <div className="min-w-[200px] flex-1">
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-foreground">
                  {ambassador.firstName} {ambassador.lastName}
                </h1>
                {type && <span className="inline-flex items-center text-[11px] font-bold rounded-full px-2.5 py-1 bg-primary/12 text-primary">{type.label}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {ambassador.email} · Ambassador since{' '}
                {new Date(ambassador.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
              {ambassador.profileImageUrl && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors mt-1.5"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove photo
                </button>
              )}
            </div>

            <div className="flex gap-6 sm:gap-8 flex-wrap">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Campaigns</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stats.campaigns}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Registrations</p>
                <p className="text-xl font-bold text-foreground tabular-nums">{stats.registrations}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Earned</p>
                <p className="text-xl font-bold text-foreground tabular-nums">
                  <Rupees amount={stats.earned} />
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <Card className="border-border/50">
              <CardContent className="pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                <h2 className="text-base font-bold text-foreground mt-0.5 mb-4">Contact details</h2>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First name</Label>
                      <Input id="firstName" autoComplete="given-name" {...form.register('firstName')} />
                      {form.formState.errors.firstName && (
                        <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last name</Label>
                      <Input id="lastName" autoComplete="family-name" {...form.register('lastName')} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
                      {form.formState.errors.phone && <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={ambassador.email} disabled />
                      <p className="text-xs text-muted-foreground">Contact support to change your email</p>
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={isUpdating}>
                    {isUpdating ? 'Saving…' : 'Save changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <ApplicationDetailsCard
              applicationFields={type?.applicationFields ?? []}
              applicationData={ambassador.applicationData}
              onSave={(data) => updateProfile({ applicationData: data })}
            />

            <VerificationDocumentCard proofUrl={ambassador.proofUrl} proofFieldLabel={type?.proofFieldLabel ?? 'Proof document'} />
          </div>

          <div className="space-y-5">
            <MyApplicationsCard />

            <Card className="border-border/50">
              <CardContent className="pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Account</p>
                <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" disabled={isLoggingOut} onClick={() => logout()}>
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Logging out…' : 'Log out'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
