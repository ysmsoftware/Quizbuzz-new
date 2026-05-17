'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'sonner';

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const { verifyEmailMutation, resendVerificationMutation } = useAuth();

  // Handle resend countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleVerify = () => {
    if (!email) {
      toast.error("Email address is missing. Please try registering again.");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Please enter the full 6-digit code.");
      return;
    }

    verifyEmailMutation.mutate({ email, otp }, {
      onSuccess: () => {
        toast.success("Email verified successfully!");
      },
      onError: (error: any) => {
        toast.error(error.message || "Invalid or expired OTP code.");
      }
    });
  };

  const handleResend = () => {
    if (!email) return;
    
    resendVerificationMutation.mutate(email, {
      onSuccess: () => {
        toast.success("A new code has been sent to your email.");
        setResendTimer(60); // 60s cooldown
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to resend verification code.");
      }
    });
  };

  // 1. Missing Email State
  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Link href="/register" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 group transition-colors">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Register
          </Link>

          <Card className="border-border/50 shadow-xl border-destructive/20">
            <CardContent className="pt-12 pb-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-destructive/10 p-4">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-destructive">Invalid Access</h2>
                <p className="text-muted-foreground">
                  We couldn&apos;t find an email address to verify. Please try registering again or check your email link.
                </p>
              </div>

              <Button onClick={() => router.push('/register')} className="w-full h-11 font-medium">
                Go to Registration
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 2. Success State
  if (verifyEmailMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50 shadow-xl overflow-hidden">
            <div className="h-2 bg-green-500" />
            <CardContent className="pt-12 pb-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 dark:bg-green-950 p-4 animate-bounce-subtle">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Email Verified!</h2>
                <p className="text-muted-foreground italic">&quot;Your gateway to the world of quizzes is now open.&quot;</p>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                Account: <span className="font-medium text-foreground">{email}</span>
              </div>

              <Button 
                onClick={() => router.push('/login')} 
                className="w-full h-12 text-base font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 3. Verification Form (Default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 group transition-colors">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Login
        </Link>

        <Card className="border-border/50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <CardHeader className="space-y-2 pb-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-4 border border-primary/20">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold text-center tracking-tight">Verify Email</CardTitle>
            <CardDescription className="text-center text-base">
              Enter the 6-digit code sent to <br />
              <span className="font-semibold text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 pb-8 space-y-8">
            <div className="flex justify-center">
              <InputOTP 
                maxLength={6} 
                value={otp} 
                onChange={setOtp}
                onComplete={handleVerify}
                disabled={verifyEmailMutation.isPending}
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot 
                      key={index} 
                      index={index} 
                      className="w-12 h-14 sm:w-14 sm:h-16 text-xl sm:text-2xl font-bold border-2 rounded-xl focus:ring-primary focus:border-primary transition-all"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="space-y-4">
              <Button 
                onClick={handleVerify} 
                disabled={otp.length !== 6 || verifyEmailMutation.isPending}
                className="w-full h-12 text-base font-semibold shadow-xl shadow-primary/10 group relative overflow-hidden"
              >
                {verifyEmailMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Verify Account
                    <span className="absolute inset-y-0 right-0 flex items-center pr-4 transition-transform group-hover:translate-x-1">
                      <RefreshCw className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                    </span>
                  </>
                )}
              </Button>

              <div className="flex flex-col items-center gap-3 text-sm">
                <div className="text-muted-foreground">
                  Didn&apos;t receive the code?
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={resendTimer > 0 || resendVerificationMutation.isPending}
                  className="text-primary hover:text-primary/80 font-semibold h-auto p-0 hover:bg-transparent"
                >
                  {resendTimer > 0 ? (
                    `Resend in ${resendTimer}s`
                  ) : resendVerificationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Resend New Code"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Checking your spam folder often helps if the email doesn&apos;t arrive within a minute.
        </p>
      </div>
    </div>
  );
}
