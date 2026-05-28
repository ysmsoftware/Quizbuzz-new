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

  useEffect(() => {
    if (!participantId) {
      setStatus("failed");
      setErrorReason("Invalid payment callback parameters.");
      return;
    }

    let attempts = 0;
    const maxAttempts = 36; // 90 seconds
    const interval = 2500;

    const poll = async () => {
      attempts++;
      try {
        const result = await registrationService.checkPaymentStatus(participantId);
        if (result.status === "SUCCESS") {
          setStatus("success");
          return;
        }
        if (result.status === "FAILED" || result.status === "CANCELLED") {
          setStatus("failed");
          setErrorReason(result.failureReason || "Payment failed or was cancelled.");
          return;
        }

        if (attempts >= maxAttempts) {
          setStatus("failed");
          setErrorReason("Payment verification timed out. If money was debited, it will be refunded or confirmed later.");
          return;
        }

        setTimeout(poll, interval);
      } catch (err) {
        if (attempts >= maxAttempts) {
          setStatus("failed");
          setErrorReason("Failed to verify payment status.");
          return;
        }
        setTimeout(poll, interval);
      }
    };

    poll();
  }, [participantId]);

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
            <XCircle className="h-16 w-16 text-destructive" />
            <div>
              <h2 className="text-2xl font-bold text-destructive mb-2">
                Payment Failed
              </h2>
              <p className="text-muted-foreground">
                {errorReason}
              </p>
            </div>
            
            <div className="w-full flex flex-col gap-3">
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
