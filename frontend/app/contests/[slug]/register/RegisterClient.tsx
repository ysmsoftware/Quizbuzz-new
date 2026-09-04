"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { State, City } from "country-state-city";
import { ArrowLeft, Loader2, CreditCard, CheckCircle, Mail, KeyRound } from "lucide-react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { contestService } from "@/lib/services/contest-service";
import { registrationService, type ExistingRegistrationInfo } from "@/lib/services/registration-service";
import { referenceDataService, type CollegeOption, type DepartmentOption } from "@/lib/services/reference-data-service";
import { Combobox, type ComboboxOption } from "@/components/shared/Combobox";
import { useRazorpay } from "@/lib/hooks/usePayment";
import type { PublicContestDetail } from "@/lib/types/public-contest";

// India-only state/city picker, same country-state-city dataset already used for org
// onboarding (OnboardingModal.tsx) — reused here instead of adding a new dependency.
const INDIA_ISO = "IN";
const STATE_OPTIONS: ComboboxOption[] = State.getStatesOfCountry(INDIA_ISO).map((s) => ({
  value: s.name,
  label: s.name,
}));

function getCityOptionsForState(stateName: string): ComboboxOption[] {
  const state = State.getStatesOfCountry(INDIA_ISO).find((s) => s.name === stateName);
  if (!state) return [];
  return City.getCitiesOfState(INDIA_ISO, state.isoCode).map((c) => ({ value: c.name, label: c.name }));
}

// Sentinel Combobox value meaning "not in the catalog" — reveals a free-text fallback input.
const OTHER_VALUE = "__OTHER__";

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
  collegeId: z.string().optional(),
  departmentId: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  referralCode: z.string().optional(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

type EmailFormData = z.infer<typeof emailSchema>;
type DetailsFormData = z.infer<typeof detailsSchema>;

// ─── Step Type ──────────────────────────────────────────────────────────────

type Step = "email" | "otp" | "resume-or-fresh" | "already-registered" | "details" | "payment" | "success";

const STEP_LABELS: Record<Step, string> = {
  email: "Email",
  otp: "Verify",
  "resume-or-fresh": "Resume",
  "already-registered": "Status",
  details: "Details",
  payment: "Payment",
  success: "Done",
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function RegisterClient() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background" />}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  // Prefills from the `?ref=` link param, but stays editable — someone who has a
  // code without the link needs somewhere to type it in.
  const referralCodeFromLink = searchParams.get("ref") || "";

  // State
  const [contest, setContest] = useState<PublicContestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [contactToken, setContactToken] = useState("");
  // The email/phone this registration actually landed on, from the register
  // API response — may differ from what was typed if an existing contact
  // was matched by phone under an older email. Shown on the success screen
  // instead of just echoing back what was typed. See registration audit,
  // issue A.
  const [registeredContact, setRegisteredContact] = useState<{ email: string; phone?: string } | null>(null);
  // Tracks the last phone number we already looked up, so re-blurring the
  // same value doesn't re-fire the request.
  const lastPhoneLookupRef = useRef<string | null>(null);
  // Values for the contest's organizer-defined registrationFields, keyed by field id.
  // Kept outside react-hook-form since the set of fields is dynamic per contest.
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  // College/Department catalog (see backend/src/common/colleges.ts) — the Combobox's
  // selected value is either a real catalog id or OTHER_VALUE, which reveals a
  // free-text fallback input. Kept outside react-hook-form (like customFieldValues)
  // since it drives which UI is shown, not just a submitted value.
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  // City has no separate id — the catalog is India's own city/town list (country-state-city),
  // so the selected value IS the submitted "city" string, unlike college/department above.
  const [selectedCityValue, setSelectedCityValue] = useState<string>("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [registrationRef, setRegistrationRef] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [existingInfo, setExistingInfo] = useState<ExistingRegistrationInfo | null>(null);
  const [apiError, setApiError] = useState("");
  const [razorpayOrder, setRazorpayOrder] = useState<{
    amount: number;
    currency: string;
    description: string;
  } | null>(null);

  const { state: paymentState, error: paymentError, initiatePayment, retryPayment } = useRazorpay();

  // Auto-transition to success step when payment is successful
  useEffect(() => {
    if (paymentState === "success" && step === "payment") {
      setStep("success");
    }
  }, [paymentState, step]);

  // Celebrate on successful registration
  useEffect(() => {
    if (step === "success") {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      
      const end = Date.now() + 1500;
      const interval = setInterval(() => {
        if (Date.now() > end) return clearInterval(interval);
        confetti({
          startVelocity: 15,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random(), y: Math.random() - 0.2 },
          particleCount: 20
        });
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [step]);

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
      referralCode: referralCodeFromLink,
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

  useEffect(() => {
    referenceDataService.getColleges().then(setColleges).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCollegeId || selectedCollegeId === OTHER_VALUE) {
      setDepartments([]);
      return;
    }
    referenceDataService.getDepartments(selectedCollegeId).then(setDepartments).catch(() => setDepartments([]));
  }, [selectedCollegeId]);

  const collegeOptions: ComboboxOption[] = [
    ...colleges.map((c) => ({ value: c.id, label: c.name })),
    { value: OTHER_VALUE, label: "Other (not listed)" },
  ];
  const departmentOptions: ComboboxOption[] = [
    ...departments.map((d) => ({ value: d.id, label: d.name })),
    { value: OTHER_VALUE, label: "Other (not listed)" },
  ];

  const stateValue = detailsForm.watch("state") ?? "";
  const cityOptions: ComboboxOption[] = [
    ...getCityOptionsForState(stateValue),
    { value: OTHER_VALUE, label: "Other (not listed)" },
  ];

  const handleStateSelect = (value: string) => {
    detailsForm.setValue("state", value);
    setSelectedCityValue("");
    detailsForm.setValue("city", "");
  };

  const handleCitySelect = (value: string) => {
    setSelectedCityValue(value);
    detailsForm.setValue("city", value === OTHER_VALUE ? "" : value);
  };

  const handleCollegeSelect = (value: string) => {
    setSelectedCollegeId(value);
    setSelectedDepartmentId("");
    detailsForm.setValue("department", "");
    detailsForm.setValue("departmentId", undefined);
    if (value === OTHER_VALUE) {
      detailsForm.setValue("college", "");
      detailsForm.setValue("collegeId", undefined);
    } else {
      const college = colleges.find((c) => c.id === value);
      detailsForm.setValue("college", college?.name ?? "");
      detailsForm.setValue("collegeId", value);
    }
  };

  const handleDepartmentSelect = (value: string) => {
    setSelectedDepartmentId(value);
    if (value === OTHER_VALUE) {
      detailsForm.setValue("department", "");
      detailsForm.setValue("departmentId", undefined);
    } else {
      const department = departments.find((d) => d.id === value);
      detailsForm.setValue("department", department?.name ?? "");
      detailsForm.setValue("departmentId", value);
    }
  };

  // Applies a known contact's college/department onto the selection state: a real
  // catalog id selects that entry (departments load via the effect above), a
  // free-text name with no id falls back to "Other" so the name isn't lost, and
  // no data at all leaves nothing selected.
  const applyKnownCollegeSelection = (collegeId: string | null | undefined, college: string | null | undefined) =>
    collegeId || (college ? OTHER_VALUE : "");

  // Same idea for city: no id to match on, so look the known city up in its known state's
  // city list — an exact match selects that entry, otherwise (or with no matching state)
  // it falls back to "Other" so the name is still shown, editable, in the fallback input.
  const applyKnownCitySelection = (state: string | null | undefined, city: string | null | undefined) => {
    if (!city) return "";
    const match = getCityOptionsForState(state || "").find((c) => c.value.toLowerCase() === city.toLowerCase());
    return match ? match.value : OTHER_VALUE;
  };

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

      // Check for an existing registration attempt
      const statusRes = await registrationService.checkRegistrationStatus(slug, result.contactToken);
      if (statusRes.existing) {
        setExistingInfo(statusRes.existing);
        setParticipantId(statusRes.existing.participantId);
        setRegistrationRef(statusRes.existing.registrationRef);

        if (statusRes.existing.status === "REGISTERED") {
          setStep("already-registered");
        } else if (statusRes.existing.status === "PENDING_PAYMENT") {
          setStep("resume-or-fresh");
        } else {
          setStep("details");
        }
      } else {
        // No registration for THIS contest yet — but if this email has
        // registered before (any contest in this org), prefill the form
        // from that known contact instead of leaving it blank. Fields
        // stay editable, so a stale phone/college can still be corrected.
        if (statusRes.knownContact) {
          const known = statusRes.knownContact;
          detailsForm.reset({
            firstName: known.firstName || "",
            lastName: known.lastName || "",
            phone: known.phone || "",
            college: known.college || "",
            department: known.department || "",
            collegeId: known.collegeId || undefined,
            departmentId: known.departmentId || undefined,
            city: known.city || "",
            state: known.state || "",
            referralCode: detailsForm.getValues("referralCode"),
            termsAccepted: false,
          });
          setSelectedCollegeId(applyKnownCollegeSelection(known.collegeId, known.college));
          setSelectedDepartmentId(applyKnownCollegeSelection(known.departmentId, known.department));
          setSelectedCityValue(applyKnownCitySelection(known.state, known.city));
        }
        setStep("details");
      }
    } catch (err: any) {
      setOtpError(err.message || "Invalid OTP. Please try again.");
    }
    setSubmitting(false);
  };

  // Phone-triggered prefill: the email-match prefill above only fires right
  // after OTP verification, before the participant has even typed a phone
  // number — so a returning participant who registers with a NEW email but
  // an OLD phone number never got prefilled, even though the same
  // "existing contact" data exists in the system (findByEmailOrPhone on the
  // backend already matches by phone at final submission). This mirrors
  // that: once the phone field has a complete number, re-check registration
  // status with that phone and fill in any fields still left blank — never
  // overwriting anything the participant already typed. See registration
  // audit, issue A.
  const handlePhoneBlur = async (rawPhone: string) => {
    const digits = rawPhone.replace(/\D/g, "").replace(/^(91|0{2}91)/, "");
    if (!/^\d{10}$/.test(digits) || digits === lastPhoneLookupRef.current) return;
    lastPhoneLookupRef.current = digits;
    try {
      const statusRes = await registrationService.checkRegistrationStatus(slug, contactToken, digits);
      if (statusRes.knownContact) {
        const known = statusRes.knownContact;
        const current = detailsForm.getValues();
        const nextCollege = current.college || known.college || "";
        const nextCollegeId = current.college ? current.collegeId : known.collegeId || undefined;
        const nextDepartment = current.department || known.department || "";
        const nextDepartmentId = current.department ? current.departmentId : known.departmentId || undefined;
        const nextState = current.state || known.state || "";
        const nextCity = current.city || known.city || "";
        detailsForm.reset({
          firstName: current.firstName || known.firstName || "",
          lastName: current.lastName || known.lastName || "",
          phone: current.phone,
          college: nextCollege,
          department: nextDepartment,
          collegeId: nextCollegeId,
          departmentId: nextDepartmentId,
          city: nextCity,
          state: nextState,
          referralCode: current.referralCode,
          termsAccepted: current.termsAccepted,
        });
        // Only override the dropdown selection if the participant hadn't already
        // picked something on this form — never clobber an in-progress choice.
        if (!current.college) setSelectedCollegeId(applyKnownCollegeSelection(known.collegeId, known.college));
        if (!current.department) setSelectedDepartmentId(applyKnownCollegeSelection(known.departmentId, known.department));
        if (!current.city) setSelectedCityValue(applyKnownCitySelection(nextState, nextCity));
      }
    } catch {
      // Best-effort — a failed lookup should never block filling in the form.
    }
  };

  const handleRegister = async (formData: DetailsFormData) => {
    if (!contest) return;

    const registrationFields = contest.registrationFields || [];
    const missingRequired = registrationFields.find(
      (f) => f.required && !customFieldValues[f.id]?.trim()
    );
    if (missingRequired) {
      setApiError(`${missingRequired.label} is required`);
      return;
    }

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
        collegeId: formData.collegeId || undefined,
        departmentId: formData.departmentId || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        referralCode: formData.referralCode?.trim() || undefined,
        customFields: registrationFields.length > 0 ? customFieldValues : undefined,
      });

      setRegistrationRef(result.data.registrationRef);
      setParticipantId(result.data.participantId);
      setRegisteredContact({
        email: result.data.contactEmail || email,
        phone: result.data.contactPhone,
      });

      if (result.data.paymentRequired && result.data.payment) {
        setRazorpayOrder(result.data.payment);
        setStep("payment");
      } else {
        setStep("success");
      }
    } catch (err: any) {
      setApiError(err.message || "Registration failed");
    }
    setSubmitting(false);
  };

  const handlePayment = async () => {
    if (!contest || !participantId) return;
    await initiatePayment(contest.id, participantId, {
      amount: razorpayOrder?.amount || 0,
      currency: razorpayOrder?.currency || "INR",
      eventTitle: contest.title,
      contactName: `${detailsForm.getValues("firstName")} ${detailsForm.getValues("lastName") ?? ""}`.trim(),
      contactEmail: email,
      contactPhone: detailsForm.getValues("phone") ?? "",
      callbackQueryParams: { ref: registrationRef }
    });
  };

  const handleRetryPayment = async () => {
    if (!contest || !participantId) return;
    await handlePayment();
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

  const contestStartDate = new Date(contest.startTime);
  const formattedDate = contestStartDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = contestStartDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      {/* Razorpay checkout SDK — loaded once, needed only on the payment step */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
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

        {/* ── Step: Already Registered ─────────────────────────────────────── */}
        {step === "already-registered" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-6 w-6" />
                  Already Registered
                </CardTitle>
                <CardDescription>
                  You are already registered for {contest?.title}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-center">
                <div className="rounded-lg bg-muted p-4 space-y-1">
                  <p className="text-xs text-muted-foreground">Registration Reference</p>
                  <p className="text-lg font-mono font-bold text-foreground">{registrationRef}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your seat is confirmed. You can access the quiz when it goes live.
                </p>
                <Button asChild className="w-full">
                  <Link href={`/quiz/${slug}/join`}>Go to Quiz Page</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Step: Resume or Fresh ────────────────────────────────────────── */}
        {step === "resume-or-fresh" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card>
              <CardHeader>
                <CardTitle>Existing Registration Found</CardTitle>
                <CardDescription>
                  You started registering for {contest?.title} earlier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {existingInfo?.payment?.resumable ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <h4 className="font-medium text-foreground">Active Payment Window Available</h4>
                    <p className="text-sm text-muted-foreground">
                      Your payment order is still valid. You can resume checkout immediately without re-entering your details.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (!contest) return;
                        setRazorpayOrder({
                          amount: Number(contest.paymentConfig?.amount || 0),
                          currency: contest.paymentConfig?.currency || "INR",
                          description: `Registration fee for ${contest.title}`,
                        });
                        setStep("payment");
                      }}
                    >
                      Resume Payment (₹{contest?.paymentConfig?.amount})
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted p-4 space-y-2">
                    <h4 className="font-medium text-foreground">Payment Session Timed Out</h4>
                    <p className="text-sm text-muted-foreground">
                      Your previous payment order window has expired. Proceeding will issue a fresh payment order for your registration.
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t">
                  <Button
                    variant={existingInfo?.payment?.resumable ? "outline" : "default"}
                    className="w-full"
                    onClick={() => setStep("details")}
                  >
                    Start Fresh / Review Details
                  </Button>
                </div>
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
                        {...detailsForm.register("phone", {
                          onBlur: (e) => handlePhoneBlur(e.target.value),
                        })}
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
                        <Combobox
                          options={collegeOptions}
                          value={selectedCollegeId}
                          onChange={handleCollegeSelect}
                          placeholder="Select your college"
                          searchPlaceholder="Search colleges..."
                        />
                        {selectedCollegeId === OTHER_VALUE && (
                          <Input
                            placeholder="Enter your college name"
                            {...detailsForm.register("college")}
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        {selectedCollegeId && selectedCollegeId !== OTHER_VALUE ? (
                          <>
                            <Combobox
                              options={departmentOptions}
                              value={selectedDepartmentId}
                              onChange={handleDepartmentSelect}
                              placeholder="Select your department"
                              searchPlaceholder="Search departments..."
                            />
                            {selectedDepartmentId === OTHER_VALUE && (
                              <Input
                                placeholder="Enter your department"
                                {...detailsForm.register("department")}
                              />
                            )}
                          </>
                        ) : (
                          <Input
                            id="department"
                            placeholder="Computer Science"
                            {...detailsForm.register("department")}
                          />
                        )}
                      </div>
                    </div>

                    {/* State & City */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Combobox
                          options={STATE_OPTIONS}
                          value={stateValue}
                          onChange={handleStateSelect}
                          placeholder="Select your state"
                          searchPlaceholder="Search states..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Combobox
                          options={cityOptions}
                          value={selectedCityValue}
                          onChange={handleCitySelect}
                          placeholder={stateValue ? "Select your city" : "Select a state first"}
                          searchPlaceholder="Search cities..."
                          disabled={!stateValue}
                        />
                        {selectedCityValue === OTHER_VALUE && (
                          <Input
                            placeholder="Enter your city"
                            {...detailsForm.register("city")}
                          />
                        )}
                      </div>
                    </div>

                    {/* Referral Code — locked once it arrives via ?ref= on the link; only
                        editable when nobody's link supplied one, so someone who clicked
                        an ambassador's link can't accidentally overwrite their attribution. */}
                    <div className="space-y-2">
                      <Label htmlFor="referralCode">Referral Code (optional)</Label>
                      <Input
                        id="referralCode"
                        placeholder="Have an ambassador's code? Enter it here"
                        disabled={!!referralCodeFromLink}
                        className={referralCodeFromLink ? "bg-muted" : undefined}
                        {...detailsForm.register("referralCode")}
                      />
                    </div>

                    {/* Organizer-defined extra fields */}
                    {(contest.registrationFields || []).map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={`custom-${field.id}`}>
                          {field.label} {field.required && "*"}
                        </Label>
                        {field.type === "select" ? (
                          <select
                            id={`custom-${field.id}`}
                            value={customFieldValues[field.id] || ""}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Select…</option>
                            {(field.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`custom-${field.id}`}
                            type={field.type}
                            placeholder={field.placeholder}
                            value={customFieldValues[field.id] || ""}
                            onChange={(e) =>
                              setCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    ))}
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
                    <span className="text-foreground">₹{razorpayOrder.amount}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">₹{razorpayOrder.amount}</span>
                  </div>
                </div>

                {/* ── Polling states ───────────────────────── */}
                {(paymentState === "verifying" || paymentState === "polling") && (
                  <div className="rounded-lg bg-muted/50 border p-4 flex flex-col items-center gap-3 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="font-medium text-foreground">Confirming your payment…</p>
                    <p className="text-sm text-muted-foreground">
                      This may take a moment. If you paid via UPI, please return to this page — we’ll detect it automatically.
                    </p>
                  </div>
                )}

                {paymentState === "failed" && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-3">
                    <p className="font-medium text-destructive">Payment failed</p>
                    <p className="text-sm text-muted-foreground">
                      {paymentError || "Your payment was not completed."}
                    </p>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleRetryPayment}
                    >
                      Try Again
                    </Button>
                  </div>
                )}

                {paymentState === "timeout" && (
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-3">
                    <p className="font-medium text-yellow-800">Taking longer than expected</p>
                    <p className="text-sm text-yellow-700">
                      Your payment may still be processing. If the amount was debited from your account, it will be confirmed automatically within a few minutes. You can safely close this page.
                    </p>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleRetryPayment}
                    >
                      Check Again
                    </Button>
                  </div>
                )}

                {apiError && (
                  <p className="text-sm text-destructive text-center">{apiError}</p>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Razorpay secure checkout • UPI, Cards, Netbanking accepted
                </p>

                {/* Only show action buttons when idle or after failure reset */}
                {(paymentState === "idle" || paymentState === "creating_order" || paymentState === "checkout_open") && (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep("details")}
                      disabled={paymentState !== "idle"}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button onClick={handlePayment} disabled={paymentState !== "idle"} className="flex-1">
                      {paymentState !== "idle" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        `Pay ₹${razorpayOrder.amount}`
                      )}
                    </Button>
                  </div>
                )}

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
                {/* Registered Email Information */}
                <div className="rounded-lg border border-primary/20 p-4 bg-primary/5 text-center space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Registered Email Address</p>
                  <p className="text-lg font-semibold text-foreground">{registeredContact?.email || email}</p>
                  <p className="text-xs text-muted-foreground">
                    This is your registered email and will be used for joining the contest.
                  </p>
                  {/* An existing contact (matched by phone number) was found under a
                      different, older email — the registration is tied to THAT email,
                      not the one just typed above. Surfaced explicitly instead of
                      silently registering under the old email. See registration
                      audit, issue A. */}
                  {registeredContact && registeredContact.email !== email && (
                    <p className="text-xs text-amber-600 dark:text-amber-500 pt-1 font-medium">
                      Note: we found an existing account of yours under this phone number, registered with {registeredContact.email}. Your registration for this contest is linked to that email — use it (not {email}) to join.
                    </p>
                  )}
                </div>

                {/* Registration Details */}
                <div className="space-y-3">
                  <h3 className="font-medium text-foreground">Registration Details</h3>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="text-foreground font-medium">
                        {detailsForm.getValues("firstName")} {detailsForm.getValues("lastName")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-foreground font-medium">{registeredContact?.email || email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registration ID</span>
                      <span className="text-foreground font-mono text-xs font-medium">{registrationRef}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contest Date</span>
                      <span className="text-foreground font-medium">{formattedDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Time</span>
                      <span className="text-foreground font-medium">{formattedTime}</span>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <div className="rounded-lg bg-muted p-4">
                  <h3 className="font-medium text-foreground mb-2">What&apos;s Next?</h3>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>1. Check your email for confirmation</li>
                    <li>2. Note the contest date and time</li>
                    <li>3. Prepare your system and ensure proctoring requirements are met</li>
                    <li>4. Join the contest using your registered email ID and the join code received in your email</li>
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
