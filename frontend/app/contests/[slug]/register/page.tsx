"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CreditCard, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { contestService } from "@/lib/services/contest-service";
import { registrationService } from "@/lib/services/registration-service";
import type { Contest, RegistrationField } from "@/lib/types";

const baseSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions",
  }),
});

export default function RegisterPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof baseSchema>>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      termsAccepted: false,
    },
  });

  useEffect(() => {
    const loadContest = async () => {
      const response = await contestService.getContestBySlug(slug);
      if (response.success && response.data) {
        setContest(response.data);
      } else {
        setContest(null);
      }
      setLoading(false);
    };
    loadContest();
  }, [slug]);

  const onSubmit = async (data: z.infer<typeof baseSchema>) => {
    if (!contest) return;

    setSubmitting(true);

    // Simulate form processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (contest.fee > 0) {
      // Move to payment step
      setStep("payment");
      setSubmitting(false);
    } else {
      // Free contest - register directly
      await completeRegistration(data);
    }
  };

  const completeRegistration = async (formData: z.infer<typeof baseSchema>) => {
    if (!contest) return;

    setSubmitting(true);

    const response = await registrationService.createRegistration(contest.id, {
      fullName: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      country: 'India', // Default or could be added to form
      agreeToTerms: true
    });

    if (response.success && response.data) {
      setRegistrationId(response.data.participantId);
      setStep("success");
    } else {
      // Handle error
      alert(response.error || "Registration failed");
    }
    setSubmitting(false);
  };

  const handlePayment = async () => {
    setSubmitting(true);
    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await completeRegistration(form.getValues() as z.infer<typeof baseSchema>);
  };

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
          {["Details", contest.fee > 0 ? "Payment" : null, "Confirmation"]
            .filter(Boolean)
            .map((label, index) => {
              const stepIndex =
                step === "form" ? 0 : step === "payment" ? 1 : contest.fee > 0 ? 2 : 1;
              const isActive = index === stepIndex;
              const isCompleted = index < stepIndex;

              return (
                <div key={label} className="flex items-center gap-2">
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
                    className={`text-sm ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}
                  >
                    {label}
                  </span>
                  {index < (contest.fee > 0 ? 2 : 1) && (
                    <div className="w-12 h-0.5 bg-muted mx-2" />
                  )}
                </div>
              );
            })}
        </div>

        {/* Form Step */}
        {step === "form" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Register for {contest.title}</CardTitle>
                <CardDescription>
                  Fill in your details to participate in this contest
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        {...form.register("fullName")}
                      />
                      {form.formState.errors.fullName && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.fullName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="john@example.com"
                        {...form.register("email")}
                      />
                      {form.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        {...form.register("phone")}
                      />
                      {form.formState.errors.phone && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.phone.message}
                        </p>
                      )}
                    </div>

                    {/* Dynamic Fields from Contest */}
                    {contest.registrationFields?.map((field: RegistrationField) => (
                      <DynamicField key={field.id} field={field} form={form} />
                    ))}
                  </div>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={form.watch("termsAccepted")}
                      onCheckedChange={(checked) =>
                        form.setValue("termsAccepted", checked === true, { shouldValidate: true })
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
                      {form.formState.errors.termsAccepted && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.termsAccepted.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Entry Fee Summary */}
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Entry Fee</span>
                      <span className="font-semibold text-foreground">
                        {contest.fee > 0
                          ? `${contest.currency} ${contest.fee.toFixed(2)}`
                          : "Free"}
                      </span>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : contest.fee > 0 ? (
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

        {/* Payment Step */}
        {step === "payment" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
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
                      {contest.currency} {contest.fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">
                      {contest.currency} {contest.fee.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Simulated Payment Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Card Number</Label>
                    <Input
                      id="cardNumber"
                      placeholder="4242 4242 4242 4242"
                      defaultValue="4242 4242 4242 4242"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date</Label>
                      <Input id="expiry" placeholder="MM/YY" defaultValue="12/28" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cvc">CVC</Label>
                      <Input id="cvc" placeholder="123" defaultValue="123" />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  This is a simulated payment. No real charges will be made.
                </p>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep("form")}
                    disabled={submitting}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button onClick={handlePayment} disabled={submitting} className="flex-1">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      `Pay ${contest.currency} ${contest.fee.toFixed(2)}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Success Step */}
        {step === "success" && registrationId && (
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
                {/* Participant ID Card */}
                <div className="rounded-lg border-2 border-dashed border-primary/30 p-6 bg-primary/5">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Your Participant ID</p>
                    <p className="text-3xl font-mono font-bold text-primary tracking-wider">
                      {registrationId}
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
                      <span className="text-foreground">{form.getValues("fullName")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-foreground">{form.getValues("email")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contest Date</span>
                      <span className="text-foreground">
                        {new Date(contest.contestDate).toLocaleDateString("en-US", {
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
                    <li>4. Join the quiz using your Participant ID</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <Link href="/contests" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Browse More Contests
                    </Button>
                  </Link>
                  <Link href={`/quiz/${contest.id}/entry`} className="flex-1">
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

// Dynamic Field Component
function DynamicField({
  field,
  form,
}: {
  field: RegistrationField;
  form: any;
}) {
  const fieldName = field.id;

  switch (field.type) {
    case "text":
    case "email":
    case "tel":
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={fieldName}
            type={field.type}
            placeholder={field.placeholder}
            {...form.register(fieldName)}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Select onValueChange={(value) => form.setValue(fieldName, value)}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || `Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
