'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Building2, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import * as orgApi from '@/lib/api/organization.api';
import { toast } from 'sonner';

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'prompt' | 'submitting' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<orgApi.InviteDetails | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
  });

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No invitation token provided in the URL link.');
      return;
    }

    let isMounted = true;

    async function loadInviteDetails() {
      try {
        const res = await orgApi.getInviteDetails(token as string);
        const data = res?.data || res;
        if (isMounted) {
          if (data && data.valid) {
            setInviteDetails(data as orgApi.InviteDetails);
            setStatus('prompt');
          } else {
            setStatus('error');
            setErrorMessage('Invitation link is invalid or has expired.');
          }
        }
      } catch (err: any) {
        console.error('Fetch invite details error:', err);
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err?.message || 'Invitation link is invalid or has expired.');
        }
      }
    }

    loadInviteDetails();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAcceptSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token) return;

    if (!inviteDetails?.hasAccount) {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        toast.error('Please enter your first and last name');
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    setStatus('submitting');
    try {
      await orgApi.acceptInvite({
        token,
        firstName: inviteDetails?.hasAccount ? undefined : formData.firstName.trim(),
        lastName: inviteDetails?.hasAccount ? undefined : formData.lastName.trim(),
        password: inviteDetails?.hasAccount ? undefined : formData.password,
      });

      setStatus('success');
      toast.success('Successfully joined organization!');

      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      console.error('Accept invite error:', err);
      setStatus('prompt');
      toast.error(err?.message || 'Failed to accept invitation. Please try again.');
    }
  };

  return (
    <Card className="w-full max-w-md border-border/60 shadow-xl bg-card">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <CardTitle className="text-2xl font-bold">Organization Invitation</CardTitle>
        <CardDescription>
          Join your workspace team on QuizBuzz
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2">
        {status === 'loading' && (
          <div className="py-8 space-y-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground font-medium">
              Validating invitation link...
            </p>
          </div>
        )}

        {(status === 'prompt' || status === 'submitting') && inviteDetails && (
          <div className="space-y-5">
            {/* Invitation Details Banner */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                <span>{inviteDetails.orgName}</span>
                <Badge variant="outline" className="ml-auto text-xs uppercase bg-primary/10 text-primary border-primary/30">
                  {inviteDetails.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Invited Email: <span className="font-semibold text-foreground">{inviteDetails.email}</span>
              </p>
            </div>

            {inviteDetails.hasAccount ? (
              /* Existing User Prompt */
              <div className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground text-center">
                  An existing QuizBuzz account was found for your email. Click below to accept the invitation and join this workspace.
                </p>
                <Button
                  onClick={() => handleAcceptSubmit()}
                  disabled={status === 'submitting'}
                  className="w-full gap-2"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Accepting Invitation...</span>
                    </>
                  ) : (
                    <>
                      <span>Accept & Join Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* New User Setup Form */
              <form onSubmit={handleAcceptSubmit} className="space-y-4 pt-1">
                <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-800 dark:text-blue-300">
                  Set up your account details below to accept this invitation and access the workspace.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs font-semibold">First Name *</Label>
                    <Input
                      id="firstName"
                      placeholder="Jane"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      disabled={status === 'submitting'}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs font-semibold">Last Name *</Label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      disabled={status === 'submitting'}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold">Set Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={status === 'submitting'}
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="w-full gap-2 pt-2"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account & Join Workspace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">Welcome to the Workspace!</h3>
              <p className="text-sm text-muted-foreground">
                Your account is ready and you have joined the organization. Redirecting to login...
              </p>
            </div>
            <Link href="/login" className="inline-block w-full">
              <Button className="w-full gap-2 mt-2">
                <span>Continue to Login</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-destructive">Invitation Failed</h3>
              <p className="text-sm text-muted-foreground">
                {errorMessage || 'This invitation link is invalid or has expired.'}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" className="w-full">
                <Button variant="default" className="w-full">
                  Go to Login
                </Button>
              </Link>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Suspense
        fallback={
          <Card className="w-full max-w-md border-border/60 shadow-xl bg-card p-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading invitation...</p>
          </Card>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
