"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Camera,
  Monitor,
  Wifi,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { CameraCheckWidget } from "@/components/features/proctoring/CameraCheckWidget";

interface SystemCheck {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "checking" | "passed" | "failed";
  errorMessage?: string;
}

export default function SystemCheckPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { setCameraStream, setFullscreenEnabled, setCameraEnabled } = useProctoringStore();

  const [checks, setChecks] = useState<SystemCheck[]>([
    {
      id: "camera",
      label: "Camera Access",
      description: "Required for proctoring",
      icon: <Camera className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "fullscreen",
      label: "Fullscreen Mode",
      description: "Quiz must be taken in fullscreen",
      icon: <Monitor className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "network",
      label: "Network Connection",
      description: "Stable internet required",
      icon: <Wifi className="h-5 w-5" />,
      status: "pending",
    },
  ]);

  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [cameraStream, setCameraStreamLocal] = useState<MediaStream | null>(null);

  const updateCheckStatus = (
    id: string,
    status: SystemCheck["status"],
    errorMessage?: string
  ) => {
    setChecks((prev) =>
      prev.map((check) =>
        check.id === id ? { ...check, status, errorMessage } : check
      )
    );
  };

  const checkCamera = async () => {
    updateCheckStatus("camera", "checking");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      
      setCameraStreamLocal(stream);
      setCameraStream(stream);
      setCameraEnabled(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      updateCheckStatus("camera", "passed");
      return true;
    } catch (error) {
      console.error("Camera access denied:", error);
      updateCheckStatus(
        "camera",
        "failed",
        "Camera access denied. Please allow camera permissions and try again."
      );
      return false;
    }
  };

  const checkFullscreen = async () => {
    updateCheckStatus("fullscreen", "checking");
    
    try {
      if (!document.fullscreenEnabled) {
        updateCheckStatus(
          "fullscreen",
          "failed",
          "Fullscreen mode is not supported in this browser."
        );
        return false;
      }
      
      setFullscreenEnabled(true);
      updateCheckStatus("fullscreen", "passed");
      return true;
    } catch (error) {
      console.error("Fullscreen check failed:", error);
      updateCheckStatus(
        "fullscreen",
        "failed",
        "Unable to verify fullscreen capability."
      );
      return false;
    }
  };

  const checkNetwork = async () => {
    updateCheckStatus("network", "checking");
    
    try {
      if (!navigator.onLine) {
        updateCheckStatus(
          "network",
          "failed",
          "No internet connection detected."
        );
        return false;
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      updateCheckStatus("network", "passed");
      return true;
    } catch (error) {
      console.error("Network check failed:", error);
      updateCheckStatus("network", "failed", "Network check failed.");
      return false;
    }
  };

  const runAllChecks = async () => {
    const cameraOk = await checkCamera();
    const fullscreenOk = await checkFullscreen();
    const networkOk = await checkNetwork();

    setAllChecksPassed(cameraOk && fullscreenOk && networkOk);
  };

  const retryCheck = async (checkId: string) => {
    switch (checkId) {
      case "camera":
        await checkCamera();
        break;
      case "fullscreen":
        await checkFullscreen();
        break;
      case "network":
        await checkNetwork();
        break;
    }

    const allPassed = checks.every(
      (check) => check.status === "passed" || check.id === checkId
    );
    setAllChecksPassed(allPassed);
  };

  const proceedToWaitingRoom = () => {
    router.push(`/quiz/${slug}/waiting`);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runAllChecks();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getStatusIcon = (status: SystemCheck["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "passed":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle>System Check</CardTitle>
              <CardDescription>
                We need to verify your system meets the requirements for the quiz
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <CameraCheckWidget
                onProceed={() => updateCheckStatus("camera", "passed")}
                onRetryCamera={() => {}}
              />

              <div className="space-y-3">
                {checks.map((check) => (
                  <motion.div
                    key={check.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`
                      flex items-center gap-4 p-4 rounded-lg border
                      ${check.status === "failed" ? "border-destructive/50 bg-destructive/5" : ""}
                      ${check.status === "passed" ? "border-success/50 bg-success/5" : ""}
                      ${check.status === "pending" || check.status === "checking" ? "border-border" : ""}
                    `}
                  >
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${check.status === "passed" ? "bg-success/10 text-success" : ""}
                        ${check.status === "failed" ? "bg-destructive/10 text-destructive" : ""}
                        ${check.status === "pending" || check.status === "checking" ? "bg-muted text-muted-foreground" : ""}
                      `}
                    >
                      {check.icon}
                    </div>

                    <div className="flex-1">
                      <p className="font-medium text-foreground">{check.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {check.errorMessage || check.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusIcon(check.status)}
                      {check.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryCheck(check.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {checks.some((check) => check.status === "failed") && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Some checks failed</AlertTitle>
                  <AlertDescription>
                    Please resolve the failed checks to continue. You can retry
                    individual checks using the retry buttons.
                  </AlertDescription>
                </Alert>
              )}

              {allChecksPassed && (
                <Alert className="border-success/50 bg-success/5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertTitle className="text-success">All checks passed!</AlertTitle>
                  <AlertDescription>
                    Your system meets all requirements. You can proceed to the
                    waiting room.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => runAllChecks()}
                >
                  Run All Checks Again
                </Button>
                <Button
                  className="flex-1"
                  disabled={!allChecksPassed}
                  onClick={proceedToWaitingRoom}
                >
                  Continue to Waiting Room
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to keep your camera on and remain in
                fullscreen mode during the entire quiz session.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
