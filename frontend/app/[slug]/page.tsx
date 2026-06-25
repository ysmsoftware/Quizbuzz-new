'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Calendar, 
  Clock, 
  Trophy, 
  ShieldCheck, 
  ArrowRight, 
  Mail, 
  Phone, 
  Building, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Shield,
  Zap,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { usePublicContest, useRegistration } from '@/lib/hooks/useRegistration';
import { usePayment } from '@/lib/hooks/usePayment';
import { deriveContestPhase } from '@/lib/utils/contest';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Step = 'landing' | 'email' | 'otp' | 'form' | 'payment' | 'success';

// Lazily loads the Razorpay checkout script. Resolves true once available,
// false if loading failed. Idempotent — safe to call multiple times.
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    ) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export default function PublicRegistrationPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const { data: contest, isLoading: contestLoading, error: contestError } = usePublicContest(slug);
  const { requestOtpMutation, verifyOtpMutation, registerMutation } = useRegistration(slug);
  const [step, setStep] = useState<Step>('landing');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [contactToken, setContactToken] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [registrationRef, setRegistrationRef] = useState('');
  
  // Registration Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    college: '',
    department: '',
    city: '',
    state: '',
  });

  // Payment Hooks (Conditional)
  const { verifyMutation, retryMutation } = usePayment(participantId);

  const phase = useMemo(() => {
    if (!contest) return 'DRAFT' as const;
    return deriveContestPhase(contest as any);
  }, [contest]);

  const isRegistrationOpen = phase === 'PUBLISHED';

  // Handle Step Transitions
  const nextStep = () => {
    const order: Step[] = ['landing', 'email', 'otp', 'form', 'payment', 'success'];
    const currentIndex = order.indexOf(step);
    if (currentIndex < order.length - 1) {
      setStep(order[currentIndex + 1]);
    }
  };

  // Logic: Step 1 (Request OTP)
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestOtpMutation.mutateAsync(email);
      toast.success('OTP sent to your email');
      nextStep();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send OTP');
    }
  };

  // Logic: Step 2 (Verify OTP)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await verifyOtpMutation.mutateAsync({ email, otp }) as any;
      setContactToken(res.data.contactToken);
      toast.success('Email verified successfully');
      nextStep();
    } catch (err: any) {
      toast.error(err.message || 'Invalid OTP');
    }
  };

  // Logic: Step 3 (Register)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await registerMutation.mutateAsync({
        contactToken,
        email,
        ...formData,
      }) as any;

      setParticipantId(res.data.participantId);

      if (res.data.paymentRequired) {
        setStep('payment');
        handlePayment(res.data.payment, res.data.participantId);
      } else {
        router.push(`/quiz/registration-success?ref=${res.data.registrationRef}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    }
  };

  // Logic: Step 4 (Payment)
  const handlePayment = async (paymentData: any, pId: string) => {
    const success = await loadRazorpayScript();
    if (!success) {
      toast.error('Failed to load payment gateway');
      return;
    }

    const options = {
      key: paymentData.keyId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      order_id: paymentData.orderId,
      name: (contest as any)?.organization?.name || "QuizBuzz",
      description: `Registration Fee for ${(contest as any)?.title}`,
      handler: async (response: any) => {
        try {
          const verifyRes = await verifyMutation.mutateAsync({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }) as any;
          router.push(`/quiz/registration-success?ref=${verifyRes.data.registrationRef}`);
          toast.success('Payment successful! You are registered.');
        } catch (err) {
          toast.error('Payment verification failed. Please contact support.');
        }
      },
      prefill: {
        name: `${formData.firstName} ${formData.lastName}`,
        email: email,
        contact: formData.phone,
      },
      theme: { color: (contest as any)?.organization?.primaryColor || "#6366f1" },
      modal: {
        ondismiss: () => {
          toast.info('Payment window closed. You can retry from your dashboard.');
        }
      }
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  if (contestLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading contest details...</p>
        </div>
      </div>
    );
  }

  if (contestError || !contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold">Contest Not Found</h1>
          <p className="text-muted-foreground">The contest you are looking for does not exist or has been removed.</p>
          <Button onClick={() => router.push('/')} variant="outline" className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -left-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        <AnimatePresence mode="wait">
          {step === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-2 gap-12 items-center"
            >
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
                    {(contest as any).organization?.name}
                  </Badge>
                  <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight">
                    {(contest as any).title}
                  </h1>
                  <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
                    {(contest as any).description || "Join the ultimate challenge and showcase your skills. Register now to participate in this exclusive contest."}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                      <p className="font-semibold">{format(new Date((contest as any).startTime), 'PPP')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Duration</p>
                      <p className="font-semibold">{(contest as any).durationMinutes} Minutes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Prize Pool</p>
                      <p className="font-semibold">₹{(contest as any).settings?.prizePool || 0}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-secondary/30 border border-border/50">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Proctored</p>
                      <p className="font-semibold">{(contest as any).settings?.proctoringEnabled ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  {isRegistrationOpen ? (
                    <Button size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-lg shadow-primary/20 group" onClick={nextStep}>
                      Register Now
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  ) : (
                    <Button size="lg" disabled className="h-14 px-8 text-lg rounded-2xl">
                      Registration {phase === 'DRAFT' ? 'Opening Soon' : 'Closed'}
                    </Button>
                  )}
                  <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-2xl">
                    View Rules
                  </Button>
                </div>
              </div>

              <div className="hidden lg:block relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-3xl opacity-30" />
                <Card className="relative bg-background/50 backdrop-blur-xl border-border/50 overflow-hidden rounded-3xl shadow-2xl">
                  <div className="p-8 space-y-6">
                    <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center mb-8">
                      <Zap className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold">Registration Checklist</h3>
                    <ul className="space-y-4">
                      {[
                        "Verified Email/WhatsApp",
                        "Profile Details",
                        "Registration Fee (if applicable)",
                        "Stable Internet Connection"
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <span className="font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-6 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4" />
                        Secure registration via QuizBuzz
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {(step === 'email' || step === 'otp' || step === 'form') && (
            <motion.div
              key="auth-flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <Card className="bg-background/50 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-8 sm:p-12">
                  {/* Progress Indicator */}
                  <div className="flex justify-between mb-12">
                    {['Email', 'Verify', 'Profile'].map((s, i) => {
                      const steps: Step[] = ['email', 'otp', 'form'];
                      const active = steps.indexOf(step) >= i;
                      return (
                        <div key={s} className="flex items-center gap-2">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                            active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                          )}>
                            {i + 1}
                          </div>
                          <span className={cn(
                            "text-sm font-medium hidden sm:inline",
                            active ? "text-foreground" : "text-muted-foreground"
                          )}>{s}</span>
                        </div>
                      );
                    })}
                  </div>

                  {step === 'email' && (
                    <form onSubmit={handleRequestOtp} className="space-y-6">
                      <div className="space-y-4">
                        <h2 className="text-3xl font-bold tracking-tight">Let's get started</h2>
                        <p className="text-muted-foreground">
                          Enter your email to receive a secure verification code.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            className="h-14 pl-12 rounded-2xl text-lg bg-secondary/30 border-border/50 focus:bg-background"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={requestOtpMutation.isPending}
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-14 text-lg rounded-2xl group"
                        disabled={requestOtpMutation.isPending}
                      >
                        {requestOtpMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Send Code
                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </form>
                  )}

                  {step === 'otp' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <div className="space-y-4">
                        <h2 className="text-3xl font-bold tracking-tight">Verify email</h2>
                        <p className="text-muted-foreground">
                          Enter the 6-digit code sent to <span className="text-foreground font-semibold">{email}</span>.
                        </p>
                      </div>
                      <Input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        className="h-20 text-center text-4xl tracking-[1em] font-mono rounded-2xl bg-secondary/30 border-border/50"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        required
                        autoFocus
                        disabled={verifyOtpMutation.isPending}
                      />
                      <Button 
                        type="submit" 
                        className="w-full h-14 text-lg rounded-2xl"
                        disabled={verifyOtpMutation.isPending}
                      >
                        {verifyOtpMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : 'Verify Code'}
                      </Button>
                      <button 
                        type="button"
                        className="w-full text-sm text-primary hover:underline"
                        onClick={() => setStep('email')}
                      >
                        Change Email
                      </button>
                    </form>
                  )}

                  {step === 'form' && (
                    <form onSubmit={handleRegister} className="space-y-6">
                      <div className="space-y-4">
                        <h2 className="text-3xl font-bold tracking-tight">Almost there</h2>
                        <p className="text-muted-foreground">
                          Fill in your professional details to complete registration.
                        </p>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">First Name</label>
                          <Input
                            placeholder="John"
                            className="h-12 rounded-xl bg-secondary/30"
                            value={formData.firstName}
                            onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Last Name</label>
                          <Input
                            placeholder="Doe"
                            className="h-12 rounded-xl bg-secondary/30"
                            value={formData.lastName}
                            onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="+91 98765 43210"
                            className="h-12 pl-10 rounded-xl bg-secondary/30"
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">College / Organization</label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="IIT Bombay"
                            className="h-12 pl-10 rounded-xl bg-secondary/30"
                            value={formData.college}
                            onChange={(e) => setFormData({...formData, college: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">City</label>
                          <Input
                            placeholder="Mumbai"
                            className="h-12 rounded-xl bg-secondary/30"
                            value={formData.city}
                            onChange={(e) => setFormData({...formData, city: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">State</label>
                          <Input
                            placeholder="Maharashtra"
                            className="h-12 rounded-xl bg-secondary/30"
                            value={formData.state}
                            onChange={(e) => setFormData({...formData, state: e.target.value})}
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-14 text-lg rounded-2xl"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : 'Complete Registration'}
                      </Button>
                    </form>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'payment' && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <Card className="bg-background/50 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl overflow-hidden text-center">
                <div className="p-12 space-y-8">
                  <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                    <Shield className="h-10 w-10 text-primary" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight">Final Step: Payment</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      To complete your registration for <span className="text-foreground font-semibold">{(contest as any).title}</span>, 
                      please pay the registration fee of <span className="text-foreground font-bold">₹{(contest as any).settings?.registrationFee || 0}</span>.
                    </p>
                  </div>
                  
                  <div className="bg-secondary/30 p-6 rounded-2xl border border-border/50 text-left space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registration Fee</span>
                      <span>₹{(contest as any).settings?.registrationFee || 0}.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="text-green-500">Free</span>
                    </div>
                    <div className="pt-3 border-t border-border/50 flex justify-between font-bold text-lg">
                      <span>Total Amount</span>
                      <span>₹{(contest as any).settings?.registrationFee || 0}.00</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Button 
                      className="w-full h-14 text-lg rounded-2xl"
                      onClick={() => retryMutation.mutateAsync().then(res => handlePayment(res.data, participantId))}
                      disabled={retryMutation.isPending}
                    >
                      {retryMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : 'Pay via Razorpay'}
                    </Button>
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Lock className="h-3 w-3" />
                      Secure SSL Encrypted Payment
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <Card className="bg-background/50 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl overflow-hidden text-center">
                <div className="p-12 space-y-8">
                  <div className="h-24 w-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-4xl font-extrabold tracking-tight">You're in!</h2>
                    <p className="text-muted-foreground leading-relaxed">
                      Registration successful for <span className="text-foreground font-semibold">{(contest as any).title}</span>. 
                      A confirmation email with instructions has been sent to <span className="text-foreground font-medium">{email}</span>.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-secondary/30 border border-border/50">
                    <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider font-bold">Registration Reference</p>
                    <p className="text-3xl font-mono font-bold tracking-widest text-primary">{registrationRef}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-12 rounded-xl" onClick={() => router.push('/')}>
                      Go to Home
                    </Button>
                    <Button className="h-12 rounded-xl" onClick={() => router.push('/dashboard')}>
                      Go to Dashboard
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Branding */}
      <div className="fixed bottom-8 left-0 right-0 text-center pointer-events-none">
        <p className="text-sm text-muted-foreground opacity-50">
          Powered by <span className="font-bold text-primary">QuizBuzz</span>
        </p>
      </div>
    </div>
  );
}
