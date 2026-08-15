'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, CheckCircle, Megaphone, Mail, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload } from '@/components/features/shared/FileUpload';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { useAmbassadorSignup } from '@/lib/hooks/useAmbassadorApply';
import { AmbassadorApiError } from '@/lib/services/ambassador-service';
import { DynamicApplicationFields, buildZodSchemaFor } from '@/components/features/ambassador/DynamicApplicationFields';

const identitySchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
});
type IdentityFormData = z.infer<typeof identitySchema>;

type Step = 'identity' | 'otp' | 'profile' | 'done';

export default function AmbassadorSignupPage() {
  const router = useRouter();
  const { types, isLoading: typesLoading } = usePlatformAmbassadorTypes();
  const { start, startLoading, verifyOtp, verifyOtpLoading, requestUploadUrl, complete, completeLoading } = useAmbassadorSignup();

  const [step, setStep] = useState<Step>('identity');
  const [email, setEmail] = useState('');
  const [apiError, setApiError] = useState('');

  // ── Step 1: identity ──────────────────────────────────────────────────────
  const identityForm = useForm<IdentityFormData>({
    resolver: zodResolver(identitySchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '' },
  });

  const handleStart = identityForm.handleSubmit(async (data) => {
    setApiError('');
    try {
      await start({ firstName: data.firstName, lastName: data.lastName || undefined, email: data.email, phone: data.phone || undefined });
      setEmail(data.email);
      setStep('otp');
    } catch (err) {
      if (err instanceof AmbassadorApiError && err.code === 'AMBASSADOR_APPLICATION_EXISTS') {
        identityForm.setError('email', { message: err.message });
        return;
      }
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  // ── Step 2: OTP ────────────────────────────────────────────────────────────
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    setOtpError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 digits');
      return;
    }
    setOtpError('');
    try {
      await verifyOtp({ email, otp });
      setStep('profile');
    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP. Please try again.');
    }
  };

  // ── Step 3: type + proof ─────────────────────────────────────────────────
  const [watchedType, setWatchedType] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [proofError, setProofError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const profileSchema = useMemo(() => {
    const selected = types.find((t) => t.key === watchedType);
    return buildZodSchemaFor(selected?.applicationFields ?? []);
  }, [types, watchedType]);

  const profileForm = useForm<Record<string, string>>({ resolver: zodResolver(profileSchema) });
  const selectedType = types.find((t) => t.key === watchedType);

  const handleTypeChange = (value: string) => {
    setWatchedType(value);
  };

  const onSubmitProfile = profileForm.handleSubmit(async (applicationData) => {
    setProofError('');
    setSubmitError('');
    if (!watchedType) {
      setSubmitError('Please select an ambassador type');
      return;
    }
    if (!proofFile) {
      setProofError('Proof document is required');
      return;
    }

    try {
      const { storageKey, url } = await requestUploadUrl({ filename: proofFile.name, mimeType: proofFile.type });
      await fetch(url, { method: 'PUT', body: proofFile, headers: { 'Content-Type': proofFile.type } });
      const proofUrl = url.split('?')[0];

      await complete({
        email,
        ambassadorType: watchedType,
        applicationData,
        proofStorageKey: storageKey,
        proofUrl,
      });

      setStep('done');
      setTimeout(() => router.push('/ambassador/dashboard'), 1200);
    } catch (err) {
      if (err instanceof AmbassadorApiError && err.violations?.length) {
        err.violations.forEach((v) => profileForm.setError(v.field, { message: v.issue }));
        return;
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        <Link href="/ambassador" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Ambassador Program
        </Link>

        {step === 'identity' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Become an Ambassador
                </CardTitle>
                <CardDescription>Tell us who you are — we&apos;ll email you a verification code.</CardDescription>
              </CardHeader>
              <CardContent>
                {apiError && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {apiError}
                  </div>
                )}
                <form onSubmit={handleStart} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input id="firstName" {...identityForm.register('firstName')} />
                      {identityForm.formState.errors.firstName && (
                        <p className="text-sm text-destructive">{identityForm.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" {...identityForm.register('lastName')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...identityForm.register('email')} />
                    {identityForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{identityForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" {...identityForm.register('phone')} />
                  </div>
                  <Button type="submit" className="w-full" disabled={startLoading}>
                    {startLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending code…
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'otp' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Verify Your Email
                </CardTitle>
                <CardDescription>
                  We sent a 6-digit code to <strong>{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center gap-2 sm:gap-3">
                  {otpDigits.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-12 sm:w-12 sm:h-14 text-center text-2xl font-mono"
                    />
                  ))}
                </div>
                {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}
                <Button onClick={handleVerifyOtp} disabled={verifyOtpLoading} className="w-full">
                  {verifyOtpLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'profile' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Almost there
                </CardTitle>
                <CardDescription>Pick the ambassador type that fits you, and upload proof of ID.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmitProfile} className="space-y-5">
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
                  </div>

                  {selectedType && selectedType.applicationFields.length > 0 && (
                    <DynamicApplicationFields
                      fields={selectedType.applicationFields}
                      register={profileForm.register}
                      control={profileForm.control}
                      errors={profileForm.formState.errors}
                    />
                  )}

                  {selectedType && (
                    <FileUpload
                      label={`${selectedType.proofFieldLabel} *`}
                      accept="image/*"
                      maxSizeMB={0.5}
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

                  <Button type="submit" className="w-full" disabled={completeLoading || !watchedType}>
                    {completeLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Finishing up…
                      </>
                    ) : (
                      'Complete Signup'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'done' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="overflow-hidden">
              <div className="bg-primary p-6 text-center">
                <CheckCircle className="h-12 w-12 text-primary-foreground mx-auto mb-3" />
                <h2 className="text-xl font-bold text-primary-foreground">You&apos;re in!</h2>
              </div>
              <CardContent className="p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
