'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, KeyRound, ArrowLeft, Check, Radar, Users2, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorAuth } from '@/lib/hooks/useAmbassadorAuth';

const emailSchema = z.object({ email: z.string().email('Please enter a valid email') });
type EmailFormData = z.infer<typeof emailSchema>;

const BRAND_POINTS = [
  { icon: Radar, text: 'Track your referral link performance in real time' },
  { icon: Users2, text: 'One profile works across every campaign you join' },
  { icon: LineChart, text: 'See rewards update as your registrations grow' },
];

/** Only a same-site relative path is accepted — `next=https://evil.com` or the
 *  protocol-relative `next=//evil.com` trick must never be honored as a post-login redirect. */
function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/ambassador/dashboard';
}

export default function AmbassadorLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));

  const { requestOtp, verifyOtp, requestOtpLoading, verifyOtpLoading } = useAmbassadorAuth();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [apiError, setApiError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const emailForm = useForm<EmailFormData>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  const handleRequestOtp = async (data: EmailFormData) => {
    setApiError('');
    try {
      await requestOtp(data.email);
      setEmail(data.email);
      setStep('otp');
    } catch (err: any) {
      setApiError(err.message || 'Failed to send OTP');
    }
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
      router.push(next);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid OTP. Please try again.');
    }
  };

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

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || '';
    setOtpDigits(next);
    const nextEmpty = next.findIndex((d) => !d);
    otpRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
      {/* Brand / onboarding panel */}
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
            Welcome back, Ambassador
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Sign in to manage your campaigns, referral links, and rewards.
          </p>

          <ul className="mt-9 space-y-4">
            {BRAND_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </span>
                <span className="text-sm text-primary-foreground/85">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-7 w-auto" />
          </div>

          <Link
            href="/ambassador"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Ambassador Program
          </Link>

          {apiError && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {apiError}
            </div>
          )}

          {step === 'email' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Ambassador Login
                  </CardTitle>
                  <CardDescription>Enter your email to receive a verification code</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={emailForm.handleSubmit(handleRequestOtp)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" type="email" placeholder="you@example.com" {...emailForm.register('email')} />
                      {emailForm.formState.errors.email && (
                        <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={requestOtpLoading}>
                      {requestOtpLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending OTP…
                        </>
                      ) : (
                        'Send Verification Code'
                      )}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      New here?{' '}
                      <Link href={`/ambassador/signup?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
                        Sign up instead
                      </Link>
                    </p>
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
                    <KeyRound className="h-5 w-5" />
                    Verify Your Email
                  </CardTitle>
                  <CardDescription>
                    We sent a 6-digit code to <strong>{email}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
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

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep('email');
                        setOtpDigits(['', '', '', '', '', '']);
                      }}
                      className="flex-1"
                    >
                      Change Email
                    </Button>
                    <Button onClick={handleVerifyOtp} disabled={verifyOtpLoading} className="flex-1">
                      {verifyOtpLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        'Verify Code'
                      )}
                    </Button>
                  </div>

                  <p className="text-center text-xs text-muted-foreground">
                    Didn&apos;t receive the code?{' '}
                    <button type="button" className="text-primary hover:underline" onClick={() => requestOtp(email)}>
                      Resend
                    </button>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Trouble signing in? <Link href="/contact" className="text-primary hover:underline">Contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
