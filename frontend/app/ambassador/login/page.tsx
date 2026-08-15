'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorAuth } from '@/lib/hooks/useAmbassadorAuth';

const emailSchema = z.object({ email: z.string().email('Please enter a valid email') });
type EmailFormData = z.infer<typeof emailSchema>;

export default function AmbassadorLoginPage() {
  const router = useRouter();

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
      router.push('/ambassador/dashboard');
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-4">
        <Link
          href="/ambassador"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Ambassador Program
        </Link>
        {apiError && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                  <p className="text-xs text-center text-muted-foreground">
                    New here?{' '}
                    <Link href="/ambassador/signup" className="text-primary hover:underline">
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
                      className="w-11 h-12 sm:w-12 sm:h-14 text-center text-2xl font-mono"
                    />
                  ))}
                </div>

                {otpError && <p className="text-sm text-destructive text-center">{otpError}</p>}

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

                <p className="text-xs text-center text-muted-foreground">
                  Didn&apos;t receive the code?{' '}
                  <button type="button" className="text-primary hover:underline" onClick={() => requestOtp(email)}>
                    Resend
                  </button>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
