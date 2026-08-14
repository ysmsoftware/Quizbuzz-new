'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { useAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useAmbassadorApply } from '@/lib/hooks/useAmbassadorApply';
import { AmbassadorApiError } from '@/lib/services/ambassador-service';
import { DynamicApplicationFields, buildZodSchemaFor } from '@/components/features/ambassador/DynamicApplicationFields';

const baseSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  ambassadorType: z.string().min(1, 'Please select a type'),
});

type BaseFormData = z.infer<typeof baseSchema>;

export default function AmbassadorApplyPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const { types, isLoading: typesLoading } = useAmbassadorTypes(orgSlug);
  const { requestUploadUrl, apply, applyLoading } = useAmbassadorApply();

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [watchedType, setWatchedType] = useState('');

  const schema = useMemo(() => {
    const selected = types.find((t) => t.key === watchedType);
    const dynamicSchema = buildZodSchemaFor(selected?.applicationFields ?? []);
    return baseSchema.merge(dynamicSchema);
  }, [types, watchedType]);

  const form = useForm<BaseFormData & Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', ambassadorType: '' },
  });

  const selectedType = types.find((t) => t.key === watchedType);

  const handleTypeChange = (value: string) => {
    setWatchedType(value);
    form.setValue('ambassadorType', value, { shouldValidate: true });
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setProofError('');
    setSubmitError('');
    if (!proofFile) {
      setProofError('Proof document is required');
      return;
    }

    const { ambassadorType, firstName, lastName, email, phone, ...applicationData } = data;

    try {
      const { storageKey, url } = await requestUploadUrl({
        organizationId: orgSlug,
        filename: proofFile.name,
        mimeType: proofFile.type,
      });

      await fetch(url, { method: 'PUT', body: proofFile, headers: { 'Content-Type': proofFile.type } });
      const proofUrl = url.split('?')[0];

      await apply({
        organizationId: orgSlug,
        firstName,
        lastName: lastName || undefined,
        email,
        phone: phone || undefined,
        ambassadorType,
        applicationData,
        proofStorageKey: storageKey,
        proofUrl,
      });

      setSubmitted(true);
    } catch (err) {
      if (err instanceof AmbassadorApiError) {
        // 400 INVALID_APPLICATION_DATA — highlight exactly which field(s) failed instead of a bare toast.
        if (err.violations?.length) {
          err.violations.forEach((v) => form.setError(v.field as keyof typeof data, { message: v.issue }));
          return;
        }
        // 409 AMBASSADOR_APPLICATION_EXISTS — surfaced on the email field, since that's what's in conflict.
        if (err.code === 'AMBASSADOR_APPLICATION_EXISTS') {
          form.setError('email', { message: err.message });
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="overflow-hidden">
            <div className="bg-primary p-6 text-center">
              <CheckCircle className="h-12 w-12 text-primary-foreground mx-auto mb-3" />
              <h2 className="text-xl font-bold text-primary-foreground">Application Submitted</h2>
            </div>
            <CardContent className="p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                We&apos;ll review your application and email you once a decision is made.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Megaphone className="h-5 w-5 text-primary shrink-0" />
              Become an Ambassador
            </CardTitle>
            <CardDescription>Apply to promote our contests and earn rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" {...form.register('firstName')} />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" {...form.register('lastName')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" {...form.register('phone')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ambassadorType">Ambassador Type *</Label>
                <Select value={watchedType} onValueChange={handleTypeChange} disabled={typesLoading}>
                  <SelectTrigger id="ambassadorType" className="w-full">
                    <SelectValue placeholder={typesLoading ? 'Loading types…' : 'Select a type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.ambassadorType && (
                  <p className="text-sm text-destructive">{form.formState.errors.ambassadorType.message}</p>
                )}
              </div>

              {selectedType && selectedType.applicationFields.length > 0 && (
                <DynamicApplicationFields
                  fields={selectedType.applicationFields}
                  register={form.register}
                  control={form.control}
                  errors={form.formState.errors}
                />
              )}

              {selectedType && (
                <FileUpload
                  label={`${selectedType.proofFieldLabel} *`}
                  accept="image/*,application/pdf"
                  preview={proofPreview}
                  onFileSelect={(file, preview) => {
                    setProofFile(file);
                    setProofPreview(preview);
                    setProofError('');
                  }}
                  onClear={() => {
                    setProofFile(null);
                    setProofPreview(null);
                  }}
                  aspectRatio="auto"
                />
              )}
              {proofError && <p className="text-sm text-destructive">{proofError}</p>}

              {submitError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {submitError}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={applyLoading}>
                {applyLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
