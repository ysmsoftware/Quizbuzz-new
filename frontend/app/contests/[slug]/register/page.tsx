"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CreditCard, CheckCircle, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { contestService } from "@/lib/services/contest-service";
import { registrationService } from "@/lib/services/registration-service";
import type { PublicContestDetail } from "@/lib/types/public-contest";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

const detailsSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional().or(z.literal("")),
  college: z.string().optional(),
  department: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

type EmailFormData = z.infer<typeof emailSchema>;
type DetailsFormData = z.infer<typeof detailsSchema>;

// ─── Step Type ──────────────────────────────────────────────────────────────

type Step = "email" | "otp" | "details" | "payment" | "success";

const STEP_LABELS: Record<Step, string> = {
  email: "Email",
  otp: "Verify",
  details: "Details",
  payment: "Payment",
  success: "Done",
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function RegisterPage() {
  const params = useParams();
  const slug = params.slug as string;

  // State
  const [contest, setContest] = useState<PublicContestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [contactToken, setContactToken] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [registrationRef, setRegistrationRef] = useState("");
  const [apiError, setApiError] = useState("");
  const [razorpayOrder, setRazorpayOrder] = useState<{
    amount: number;
    currency: string;
    description: string;
  } | null>(null);

  // OTP input refs
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email form
  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  // Details form
  const detailsForm = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      college: "",
      department: "",
      city: "",
      state: "",
      termsAccepted: false,
    },
  });

  // ─── Load Contest ───────────────────────────────────────────────────────────

  useEffect(() => {
    const loadContest = async () => {
      try {
        const response = await contestService.getContestBySlug(slug);
        if (response.success && response.data) {
          setContest(response.data);
        }
      } catch {
        // Contest not found
      }
      setLoading(false);
    };
    loadContest();
  }, [slug]);

  // ─── Step Handlers ──────────────────────────────────────────────────────────

  const handleRequestOtp = async (data: EmailFormData) => {
    setSubmitting(true);
    setApiError("");
    try {
      await registrationService.requestOtp(data.email);
      setEmail(data.email);
      setStep("otp");
    } catch (err: any) {
      setApiError(err.message || "Failed to send OTP");
    }
    setSubmitting(false);
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== 6) {
      setOtpError("Please enter all 6 digits");
      return;
    }

    setSubmitting(true);
    setOtpError("");
    try {
      const result = await registrationService.verifyOtp(email, otp);
      setContactToken(result.contactToken);
      setStep("details");
    } catch (err: any) {
      setOtpError(err.message || "Invalid OTP. Please try again.");
    }
    setSubmitting(false);
  };

  const handleRegister = async (formData: DetailsFormData) => {
    if (!contest) return;

    setSubmitting(true);
    setApiError("");
    try {
      const result = await registrationService.registerForContest(slug, {
        contactToken,
        email,
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        phone: formData.phone || undefined,
        college: formData.college || undefined,
        department: formData.department || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
      });

      if (result.data.paymentRequired && result.data.payment) {
        setRazorpayOrder(result.data.payment);
        setRegistrationRef(result.data.registrationRef);
        setStep("payment");
      } else {
        setRegistrationRef(result.data.registrationRef);
        setStep("success");
      }
    } catch (err: any) {
      setApiError(err.message || "Registration failed");
    }
    setSubmitting(false);
  };

  const handlePayment = async () => {
    // Online payment coming soon (full Razorpay integration is Wave 5)
    setSubmitting(true);
    setApiError("Online payment coming soon. Please contact the organizer for payment instructions.");
    setSubmitting(false);
  };

  // ─── OTP Input Helpers ──────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setOtpError("");

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);
    // Focus the next empty or the last
    const nextEmpty = newDigits.findIndex((d) => !d);
    otpRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();
  };

  // ─── Compute visible steps for progress bar ────────────────────────────────

  const fee = contest?.paymentConfig?.amount ?? 0;
  const visibleSteps: Step[] = fee > 0
    ? ["email", "otp", "details", "payment", "success"]
    : ["email", "otp", "details", "success"];

  const currentStepIndex = visibleSteps.indexOf(step);

  // ─── Loading / Not Found ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Contest not found</h1>
        <Link href="/contests">
          <Button variant="outline">Browse Contests</Button>
        </Link>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back Navigation */}
        <Link
          href={`/contests/${slug}`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to contest
        </Link>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {visibleSteps.map((s, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isCompleted ? "bg-primary text-primary-foreground" : ""}
                    ${isActive ? "bg-primary text-primary-foreground" : ""}
                    ${!isActive && !isCompleted ? "bg-muted text-muted-foreground" : ""}
                  `}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  {STEP_LABELS[s]}
                </span>
                {index < visibleSteps.length - 1 && (
                  <div className="w-8 sm:w-12 h-0.5 bg-muted mx-1" />
                )}
              </div>
            );
          })}
        </div>

        {/* Global error */}
        {apiError && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {apiError}
          </div>
        )}

        {/* ── Step: Email ────────────────────────────────────────────────── */}
        {step === "email" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Register for {contest.title}
                </CardTitle>
                <CardDescription>
                  Enter your email to receive a verification code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={emailForm.handleSubmit(handleRequestOtp)} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      {...emailForm.register("email")}
                    />
                    {emailForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {emailForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      "Send Verification Code"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step: OTP ──────────────────────────────────────────────────── */}
        {step === "otp" && (
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
                {/* OTP Inputs */}
                <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, i) => (
                    <Input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-mono"
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-sm text-destructive text-center">{otpError}</p>
                )}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => { setStep("email"); setOtpDigits(["", "", "", "", "", ""]); }}
                    className="flex-1"
                  >
                    Change Email
                  </Button>
                  <Button onClick={handleVerifyOtp} disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Didn&apos;t receive the code?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setSubmitting(true);
                      registrationService.requestOtp(email).finally(() => setSubmitting(false));
                    }}
                  >
                    Resend
                  </button>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step: Details ───────────────────────────────────────────────── */}
        {step === "details" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
                <CardDescription>
                  Fill in your information to complete registration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={detailsForm.handleSubmit(handleRegister)} className="space-y-6">
                  <div className="space-y-4">
                    {/* Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          placeholder="John"
                          {...detailsForm.register("firstName")}
                        />
                        {detailsForm.formState.errors.firstName && (
                          <p className="text-sm text-destructive">
                            {detailsForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Doe"
                          {...detailsForm.register("lastName")}
                        />
                      </div>
                    </div>

                    {/* Verified Email (read-only) */}
                    <div className="space-y-2">
                      <Label>Email (verified)</Label>
                      <Input value={email} disabled className="bg-muted" />
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        {...detailsForm.register("phone")}
                      />
                      {detailsForm.formState.errors.phone && (
                        <p className="text-sm text-destructive">
                          {detailsForm.formState.errors.phone.message}
                        </p>
                      )}
                    </div>

                    {/* College & Department */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="college">College / Institution</Label>
                        <Input
                          id="college"
                          placeholder="XYZ University"
                          {...detailsForm.register("college")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          placeholder="Computer Science"
                          {...detailsForm.register("department")}
                        />
                      </div>
                    </div>

                    {/* City & State */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="Mumbai"
                          {...detailsForm.register("city")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          placeholder="Maharashtra"
                          {...detailsForm.register("state")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Terms */}
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={detailsForm.watch("termsAccepted")}
                      onCheckedChange={(checked) =>
                        detailsForm.setValue("termsAccepted", checked === true, { shouldValidate: true })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                        I accept the{" "}
                        <Link href="/terms" className="text-primary hover:underline">
                          terms and conditions
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-primary hover:underline">
                          privacy policy
                        </Link>
                      </Label>
                      {detailsForm.formState.errors.termsAccepted && (
                        <p className="text-sm text-destructive">
                          {detailsForm.formState.errors.termsAccepted.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Entry Fee Summary */}
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Entry Fee</span>
                      <span className="font-semibold text-foreground">
                        {fee > 0 ? `₹${fee}` : "Free"}
                      </span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : fee > 0 ? (
                      "Continue to Payment"
                    ) : (
                      "Complete Registration"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step: Payment ───────────────────────────────────────────────── */}
        {step === "payment" && razorpayOrder && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment
                </CardTitle>
                <CardDescription>
                  Complete your payment to confirm registration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Summary */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="font-medium text-foreground">Order Summary</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{contest.title}</span>
                    <span className="text-foreground">
                      ₹{razorpayOrder.amount}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">
                      ₹{razorpayOrder.amount}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Razorpay payment gateway will open for secure payment processing.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("details")}
                    disabled={submitting}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button onClick={handlePayment} disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `Pay ₹${razorpayOrder.amount}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step: Success ───────────────────────────────────────────────── */}
        {step === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="overflow-hidden">
              <div className="bg-primary p-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold text-primary-foreground">
                  Registration Successful!
                </h2>
                <p className="text-primary-foreground/80 mt-2">
                  You are registered for {contest.title}
                </p>
              </div>

              <CardContent className="p-6 space-y-6">
                {/* Registration Ref Card */}
                <div className="rounded-lg border-2 border-dashed border-primary/30 p-6 bg-primary/5">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Your Registration ID</p>
                    <p className="text-3xl font-mono font-bold text-primary tracking-wider">
                      {registrationRef}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Save this ID - you will need it to access the quiz
                    </p>
                  </div>
                </div>

                {/* Registration Details */}
                <div className="space-y-3">
                  <h3 className="font-medium text-foreground">Registration Details</h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="text-foreground">
                        {detailsForm.getValues("firstName")} {detailsForm.getValues("lastName")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-foreground">{email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contest Date</span>
                      <span className="text-foreground">
                        {new Date(contest.startTime).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="rounded-lg bg-muted p-4">
                  <h3 className="font-medium text-foreground mb-2">What&apos;s Next?</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>1. Check your email for confirmation</li>
                    <li>2. Note the contest date and time</li>
                    <li>3. Prepare your system for proctoring requirements</li>
                    <li>4. Join the quiz using your Registration ID</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Link href="/contests" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Browse More Contests
                    </Button>
                  </Link>
                  <Link href={`/quiz/${contest.slug}/join`} className="flex-1">
                    <Button className="w-full">Go to Quiz Entry</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
