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
  Mic,
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
      id: "microphone",
      label: "Microphone Access",
      description: "Required for environmental audio checks",
      icon: <Mic className="h-5 w-5" />,
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
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const [hasFailedChecks, setHasFailedChecks] = useState(false);
  const [deviceCheckFailed, setDeviceCheckFailed] = useState(false);
 
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
 
  const checkDevices = async () => {
    updateCheckStatus("camera", "checking");
    updateCheckStatus("microphone", "checking");
    
    try {
      const store = useProctoringStore.getState();
      // Single unified permission request to support iOS Safari constraints
      const success = await store.requestCameraPermission();
      
      if (success && store.videoStream) {
        const hasVideo = store.videoStream.getVideoTracks().some(t => t.readyState === 'live');
        const hasAudio = store.videoStream.getAudioTracks().some(t => t.readyState === 'live');
        
        if (!hasVideo) {
          throw new Error("No active video track found.");
        }
        if (!hasAudio) {
          throw new Error("No active audio track found.");
        }
        
        setCameraEnabled(true);
        if (videoRef.current) {
          videoRef.current.srcObject = store.videoStream;
        }
        
        updateCheckStatus("camera", "passed");
        updateCheckStatus("microphone", "passed");
        return true;
      } else {
        throw new Error("Camera or microphone permission was denied.");
      }
    } catch (error: any) {
      console.error("Camera/Microphone access denied:", error);
      updateCheckStatus(
        "camera",
        "failed",
        "Camera permission is required. Please check your browser/OS settings."
      );
      updateCheckStatus(
        "microphone",
        "failed",
        "Microphone permission is required. Please check your browser/OS settings."
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
    setIsRetrying(true);
    setHasFailedChecks(false);
    setDeviceCheckFailed(false);
    try {
      const [devOk, fsOk, netOk] = await Promise.all([
        checkDevices(),
        checkFullscreen(),
        checkNetwork(),
      ]);
      const failed = !devOk || !fsOk || !netOk;
      setHasFailedChecks(failed);
      setDeviceCheckFailed(!devOk);
      setAllChecksPassed(!failed);
    } finally {
      setIsRetrying(false);
    }
  };

  const retryCheck = async (id: string) => {
    setIsRetrying(true);
    try {
      let ok = false;
      if (id === "camera" || id === "microphone") ok = await checkDevices();
      else if (id === "fullscreen") ok = await checkFullscreen();
      else if (id === "network") ok = await checkNetwork();
      // Recompute global pass state
      setChecks((prev) => {
        const updated = prev.map((c) =>
          c.id === id ? { ...c, status: ok ? "passed" as const : "failed" as const } : c
        );
        const allPassed = updated.every((c) => c.status === "passed");
        setAllChecksPassed(allPassed);
        setHasFailedChecks(!allPassed);
        return updated;
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const proceedToWaitingRoom = () => {
    if (!slug || !allChecksPassed) return;
    setIsProceeding(true);
    try {
      sessionStorage.setItem(`system_check_${slug}`, "passed");
      router.push(`/quiz/${slug}/waiting`);
    } catch {
      setIsProceeding(false);
    }
  };

  // Run checks automatically on first mount
  useEffect(() => {
    runAllChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                onProceed={() => {
                  updateCheckStatus("camera", "passed");
                  updateCheckStatus("microphone", "passed");
                }}
                onRetryCamera={() => checkDevices()}
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
                          disabled={isRetrying}
                          onClick={() => retryCheck(check.id)}
                          className="min-w-[72px]"
                        >
                          {isRetrying ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Retry"
                          )}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
 
              {deviceCheckFailed && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900 dark:text-amber-300">How to Enable Camera & Microphone Permissions</h4>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Both permissions are strictly mandatory to start this quiz. Please follow these steps:</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-amber-100 dark:border-zinc-800">
                      <p className="font-semibold text-zinc-950 dark:text-zinc-50">📱 iOS (Safari)</p>
                      <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                        <li>Open device **Settings**</li>
                        <li>Go to **Safari**</li>
                        <li>Scroll to **Camera** & **Microphone**</li>
                        <li>Set access to **Allow**</li>
                      </ol>
                    </div>
                    
                    <div className="space-y-1 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-amber-100 dark:border-zinc-800">
                      <p className="font-semibold text-zinc-950 dark:text-zinc-50">🤖 Android (Chrome)</p>
                      <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                        <li>Tap 🔒 lock icon left of URL bar</li>
                        <li>Go to **Site Settings**</li>
                        <li>Find **Camera** and **Microphone**</li>
                        <li>Change options to **Allow**</li>
                      </ol>
                    </div>
                    
                    <div className="space-y-1 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-amber-100 dark:border-zinc-800">
                      <p className="font-semibold text-zinc-950 dark:text-zinc-50">💻 Desktop browsers</p>
                      <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400">
                        <li>Click 🔒 lock icon left of URL bar</li>
                        <li>Enable **Camera** & **Microphone**</li>
                        <li>Click **Refresh** / **Reload** page</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
 
              {hasFailedChecks && !deviceCheckFailed && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Some checks failed</AlertTitle>
                  <AlertDescription>
                    Please resolve all failed checks to continue. You can retry individual checks using the retry buttons.
                  </AlertDescription>
                </Alert>
              )}
 
              {allChecksPassed && (
                <Alert className="border-success/50 bg-success/5">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <AlertTitle className="text-success">All checks passed!</AlertTitle>
                  <AlertDescription>
                    Your system meets all requirements. You can proceed to the waiting room.
                  </AlertDescription>
                </Alert>
              )}
 
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isRetrying}
                  onClick={() => runAllChecks()}
                >
                  {isRetrying ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</>
                  ) : (
                    "Run All Checks Again"
                  )}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!allChecksPassed || isProceeding}
                  onClick={proceedToWaitingRoom}
                >
                  {isProceeding ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Entering...</>
                  ) : (
                    "Continue to Waiting Room"
                  )}
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
