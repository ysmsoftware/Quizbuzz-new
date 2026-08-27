'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, ArrowLeft, ClipboardList, Users2, Award } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/hooks/useAuth';

const ORG_POINTS = [
  { icon: ClipboardList, text: 'Drag-and-drop question builder with multiple question types' },
  { icon: Users2, text: 'Automated participant management and communication' },
  { icon: Award, text: 'Automated certificate generation once results are in' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { registerMutation, isLoggedIn } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      router.push('/org');
    }
  }, [isLoggedIn, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, checked, value } = e.currentTarget;
    let sanitizedValue = value;
    if (name === 'email') {
      sanitizedValue = value.replace(/[^a-zA-Z0-9@._\-+]/g, '');
    } else if (name === 'password' || name === 'confirmPassword') {
      sanitizedValue = value.replace(/[,.[\](){}/\\;:'"`]/g, '');
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : sanitizedValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.firstName || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address (e.g. name@example.com)');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      return;
    }

    if (!formData.agreeToTerms) {
      setError('Please agree to terms and conditions');
      return;
    }

    try {
      await registerMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      {/* Form panel — left */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-7 w-auto" />
          </div>

          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <Card className="border-border/50">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl">Create Your Organization Account</CardTitle>
              <CardDescription>
                Set up an account to create and manage contests on QuizBuzz
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
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={registerMutation.isPending}
                    className="border-border/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={registerMutation.isPending}
                    className="border-border/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    name="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={registerMutation.isPending}
                    className="border-border/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={registerMutation.isPending}
                    className="border-border/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Must be at least 6 characters with uppercase, lowercase, and numbers. Special characters allowed: @, #, $, %, ^, &, *, !, _, -, ?. No commas, dots, brackets, or slashes.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={registerMutation.isPending}
                    className="border-border/50"
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, agreeToTerms: !!checked }))
                    }
                    disabled={registerMutation.isPending}
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                    I agree to the{' '}
                    <Link href="#" className="text-primary hover:underline">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link href="#" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an organization account? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            We&apos;ll send a verification link to your email. Click the link to verify your account.
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Looking to take a quiz instead?{' '}
            <Link href="/contests" className="text-primary hover:underline">
              Browse contests
            </Link>
          </p>
        </div>
      </div>

      {/* Brand panel — right, for organizations */}
      <div
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 15%, oklch(0.85 0.15 85 / 0.35), transparent 50%), radial-gradient(circle at 15% 85%, oklch(0.62 0.14 175 / 0.55), transparent 55%), linear-gradient(200deg, oklch(0.4 0.1 180), oklch(0.28 0.08 190))',
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

          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
            For organizations
          </div>

          <h1 className="text-3xl font-bold leading-tight text-primary-foreground">
            Create and manage contests, end to end
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/80">
            This signup is for organizations that want to host contests on QuizBuzz — from a question bank all
            the way to certificates. Taking a quiz as a participant doesn&apos;t require an account here.
          </p>

          <ul className="mt-9 space-y-4">
            {ORG_POINTS.map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <point.icon className="h-3.5 w-3.5 text-primary-foreground" />
                </span>
                <span className="text-sm text-primary-foreground/85">{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
