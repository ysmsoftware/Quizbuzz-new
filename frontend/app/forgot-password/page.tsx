'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { forgotPassword } from '@/lib/api/auth.api';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email) {
        setError('Please enter your email address');
        setLoading(false);
        return;
      }

      if (!email.includes('@')) {
        setError('Please enter a valid email');
        setLoading(false);
        return;
      }

      const response = await forgotPassword(email);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send reset link');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/50">
            <CardContent className="pt-12 pb-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-100 dark:bg-blue-950 p-4">
                  <CheckCircle2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Check Your Email</h2>
                <p className="text-muted-foreground">
                  We&apos;ve sent password reset instructions to <br />
                  <span className="font-semibold text-foreground">{email}</span>
                </p>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Please click the link in the email to set a new password. If you don&apos;t see it, check your spam folder.
              </p>

              <Button
                variant="outline"
                onClick={() => router.push('/login')}
                className="w-full mt-6"
              >
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>

        <Card className="border-border/50">
          <CardHeader className="space-y-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Mail className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Forgot Password?</CardTitle>
            <CardDescription className="text-center">
              Enter your email address and we&apos;ll send you a link to reset your password
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="border-border/50"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Remember your password? </span>
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">Demo: Use any valid email address</p>
      </div>
    </div>
  );
}
