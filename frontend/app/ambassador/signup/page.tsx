'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, CheckCircle, Megaphone, Mail, KeyRound, Check } from 'lucide-react';
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

const RAIL_STEPS: { key: Step; label: string }[] = [
  { key: 'identity', label: 'Your details' },
  { key: 'otp', label: 'Verify email' },
  { key: 'profile', label: 'Ambassador profile' },
  { key: 'done', label: 'All set' },
];

/** Only a same-site relative path is accepted — see the matching guard on the login page. */
function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/ambassador/dashboard';
}

export default function AmbassadorSignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const { types, isLoading: typesLoading } = usePlatformAmbassadorTypes();
  const { start, startLoading, verifyOtp, verifyOtpLoading, requestUploadUrl, complete, completeLoading } = useAmbassadorSignup();

  const [step, setStep] = useState<Step>('identity');
  const [email, setEmail] = useState('');
  const [apiError, setApiError] = useState('');

  const railIndex = RAIL_STEPS.findIndex((s) => s.key === step);

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
      setTimeout(() => router.push(next), 1200);
    } catch (err) {
      if (err instanceof AmbassadorApiError && err.violations?.length) {
        err.violations.forEach((v) => profileForm.setError(v.field, { message: v.issue }));
        return;
      }
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
      {/* Brand / step-rail panel */}
      <div
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 15%, oklch(0.62 0.14 175 / 0.55), transparent 55%), radial-gradient(circle at 85% 85%, oklch(0.85 0.15 85 / 0.35), transparent 50%), linear-gradient(160deg, oklch(0.4 0.1 180), oklch(0.28 0.08 190))',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(oklch(1 0 0 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.15) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        <div className="relative z-10 w-full max-w-sm">
          <div className="mb-10 inline-flex rounded-2xl bg-white px-4 py-2.5 shadow-lg">
            <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={140} height={40} className="h-7 w-auto" />
          </div>

          <h1 className="text-3xl font-bold leading-tight text-primary-foreground">
            Become a QuizBuzz Ambassador
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/80">
            A few quick steps and you&apos;ll be ready to start promoting campaigns and earning rewards.
          </p>

          <ol className="mt-9 space-y-5">
            {RAIL_STEPS.map((s, i) => {
              const isDone = i < railIndex;
              const isActive = i === railIndex;
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      isDone
                        ? 'bg-white text-primary'
                        : isActive
                          ? 'bg-white/20 text-primary-foreground ring-2 ring-white'
                          : 'bg-white/10 text-primary-foreground/60'
                    }`}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span
                    className={`text-sm ${
                      isActive ? 'font-medium text-primary-foreground' : 'text-primary-foreground/70'
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-lg space-y-4">
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-7 w-auto" />
          </div>

          <Link href="/ambassador" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
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
                    <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {apiError}
                    </div>
                  )}
                  <form onSubmit={handleStart} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        className="h-12 w-11 text-center text-2xl font-mono sm:h-14 sm:w-12"
                      />
                    ))}
                  </div>
                  {otpError && <p className="text-center text-sm text-destructive">{otpError}</p>}
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
                      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
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
                  <CheckCircle className="mx-auto mb-3 h-12 w-12 text-primary-foreground" />
                  <h2 className="text-xl font-bold text-primary-foreground">You&apos;re in!</h2>
                </div>
                <CardContent className="space-y-2 p-6 text-center">
                  <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
