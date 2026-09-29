"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { registrationService } from "@/lib/services/registration-service";

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const participantId = searchParams.get("participantId");
  const returnUrl = searchParams.get("returnUrl");
  const registrationRef = searchParams.get("ref");

  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [errorReason, setErrorReason] = useState("");
  // Bumped by "Check again" to restart polling.
  const [pollRun, setPollRun] = useState(0);

  useEffect(() => {
    if (!participantId) {
      setStatus("failed");
      setErrorReason("Invalid payment callback parameters.");
      return;
    }

    // UPI can report "failed" and then "captured" seconds later, so a FAILED
    // status is only shown after it has held for FAILED_GRACE_MS (the backend
    // re-checks with Razorpay while we poll).
    const interval = 2500;
    const maxMs = 3 * 60 * 1000;
    const FAILED_GRACE_MS = 45 * 1000;
    const startedAt = Date.now();
    let failedSince: number | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    setStatus("loading");

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await registrationService.checkPaymentStatus(participantId);
        if (cancelled) return;
        if (result.status === "SUCCESS") {
          setStatus("success");
          return;
        }
        if (result.status === "FAILED" || result.status === "CANCELLED") {
          failedSince ??= Date.now();
          if (Date.now() - failedSince >= FAILED_GRACE_MS) {
            setStatus("failed");
            setErrorReason(result.failureReason || "The payment was not completed.");
            return;
          }
        } else {
          failedSince = null;
        }
      } catch {
        // transient — keep polling
      }
      if (Date.now() - startedAt >= maxMs) {
        setStatus("failed");
        setErrorReason("We couldn't confirm the payment yet.");
        return;
      }
      timer = setTimeout(poll, interval);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [participantId, pollRun]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        {status === "loading" && (
          <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Confirming Payment...</h2>
            <p className="text-muted-foreground text-sm">
              Please don't close this window. We are verifying your payment with the bank.
            </p>
          </CardContent>
        )}

        {status === "success" && (
          <div className="flex flex-col">
            <div className="bg-primary p-6 text-center">
              <CheckCircle className="h-16 w-16 text-primary-foreground mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-primary-foreground">
                Registration Successful!
              </h2>
              <p className="text-primary-foreground/80 mt-2">
                Your payment was received.
              </p>
            </div>
            <CardContent className="p-6 space-y-6">
              {registrationRef && (
                <div className="rounded-lg border-2 border-dashed border-primary/30 p-6 bg-primary/5 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Your Registration ID</p>
                  <p className="text-3xl font-mono font-bold text-primary tracking-wider">
                    {registrationRef}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Save this ID - you will need it to access the quiz
                  </p>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => router.push('/contests')} 
                  className="w-full"
                >
                  Browse Contests
                </Button>
                {returnUrl && (
                  <Button 
                    variant="outline" 
                    onClick={() => router.push(returnUrl)} 
                    className="w-full"
                  >
                    Back to Registration Page
                  </Button>
                )}
              </div>
            </CardContent>
          </div>
        )}

        {status === "failed" && (
          <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
            <XCircle className="h-16 w-16 text-muted-foreground" />
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Payment not completed
              </h2>
              <p className="text-muted-foreground">
                {errorReason}
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                If money was debited from your account, please don’t pay again — tap “Check again” and we’ll confirm it
                with Razorpay. Any amount debited for an unsuccessful payment is refunded to you automatically.
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              {participantId && (
                <Button variant="outline" onClick={() => setPollRun((n) => n + 1)} className="w-full">
                  Check again
                </Button>
              )}
              {returnUrl && (
                <Button 
                  onClick={() => router.push(returnUrl)} 
                  className="w-full"
                >
                  Try Again
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => router.push('/contests')} 
                className="w-full"
              >
                Go to Home
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <PaymentCallbackContent />
    </Suspense>
  );
}
