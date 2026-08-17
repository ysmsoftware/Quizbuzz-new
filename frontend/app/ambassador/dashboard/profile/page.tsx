'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { useAmbassadorMe } from '@/lib/hooks/useAmbassadorMe';
import { useUpdateAmbassadorProfile } from '@/lib/hooks/useUpdateAmbassadorProfile';
import { ambassadorService, AmbassadorApiError } from '@/lib/services/ambassador-service';
import { useQueryClient } from '@tanstack/react-query';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});
type ProfileFormData = z.infer<typeof profileSchema>;

export default function AmbassadorProfilePage() {
  const { ambassador } = useAmbassadorMe();
  if (!ambassador) return null;
  return <ProfileForm ambassador={ambassador} />;
}

function ProfileForm({ ambassador }: { ambassador: NonNullable<ReturnType<typeof useAmbassadorMe>['ambassador']> }) {
  const { updateProfile, isUpdating } = useUpdateAmbassadorProfile();
  const queryClient = useQueryClient();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isReplacingProof, setIsReplacingProof] = useState(false);

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

  const handleReplaceProof = async () => {
    if (!proofFile) return;
    setIsReplacingProof(true);
    try {
      const { storageKey, url } = await ambassadorService.requestAuthenticatedUploadUrl({
        filename: proofFile.name,
        mimeType: proofFile.type,
      });
      await fetch(url, { method: 'PUT', body: proofFile, headers: { 'Content-Type': proofFile.type } });
      const proofUrl = url.split('?')[0];
      await ambassadorService.updateProof({ proofStorageKey: storageKey, proofUrl });
      queryClient.invalidateQueries({ queryKey: ['ambassador-me'] });
      setProofFile(null);
      setProofPreview(null);
      toast.success('Proof document updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to replace document');
    } finally {
      setIsReplacingProof(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium text-foreground truncate">{ambassador.email}</span>
            </div>
            <p className="text-xs text-muted-foreground">Contact support to change your email.</p>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Ambassador type</span>
              <span className="font-medium text-foreground">{ambassador.ambassadorType}</span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium text-foreground">
                {new Date(ambassador.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit details</CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
                {form.formState.errors.phone && (
                  <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proof document</CardTitle>
            <CardDescription>
              <a href={ambassador.proofUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                View current document
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FileUpload
              label="Replace document"
              accept="image/*,application/pdf"
              preview={proofPreview}
              onFileSelect={(file, preview) => {
                setProofFile(file);
                setProofPreview(preview);
              }}
              onClear={() => {
                setProofFile(null);
                setProofPreview(null);
              }}
            />
            {proofFile && (
              <Button size="sm" onClick={handleReplaceProof} disabled={isReplacingProof}>
                {isReplacingProof ? 'Uploading…' : 'Upload replacement'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
