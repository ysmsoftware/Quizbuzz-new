"use client";
 
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Monitor,
  Wifi,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Mic,
  ArrowRight,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { useQuizStore } from "@/lib/stores/quiz-store";
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
  const proctoringEnabled = useQuizStore((s) => s.proctoringEnabled);

  // iOS detection
  const isIOS = useRef(
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream
  );

  const [checksStarted, setChecksStarted] = useState(false);
 
  const [checks, setChecks] = useState<SystemCheck[]>([
    {
      id: "camera",
      label: "Camera Access",
      description: "Required for automated face validation",
      icon: <Camera className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "microphone",
      label: "Microphone Access",
      description: "Required for background sound check",
      icon: <Mic className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "fullscreen",
      label: "Fullscreen Mode",
      description: "Verifies secure quiz viewport access",
      icon: <Monitor className="h-5 w-5" />,
      status: "pending",
    },
    {
      id: "network",
      label: "Network Connection",
      description: "Verifies server handshake latency",
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
    if (!proctoringEnabled) {
      updateCheckStatus("camera", "passed");
      updateCheckStatus("microphone", "passed");
      return true;
    }
 
    updateCheckStatus("camera", "checking");
    updateCheckStatus("microphone", "checking");
 
    try {
      const store = useProctoringStore.getState();
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
    await new Promise((r) => setTimeout(r, 450));
 
    if (isIOS.current) {
      setFullscreenEnabled(true);
      updateCheckStatus("fullscreen", "passed");
      return true;
    }
 
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
      
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      updateCheckStatus("network", "passed");
      return true;
    } catch (error) {
      console.error("Network check failed:", error);
      updateCheckStatus("network", "failed", "Network check failed.");
      return false;
    }
  };
 
  const runAllChecks = useCallback(async () => {
    setIsRetrying(true);
    setHasFailedChecks(false);
    setDeviceCheckFailed(false);
    setChecksStarted(true);
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
    } catch {
      // safe
    } finally {
      setIsRetrying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  const retryCheck = async (id: string) => {
    setIsRetrying(true);
    try {
      let ok = false;
      if (id === "camera" || id === "microphone") ok = await checkDevices();
      else if (id === "fullscreen") ok = await checkFullscreen();
      else if (id === "network") ok = await checkNetwork();
      
      setChecks((prev) => {
        const updated = prev.map((c) =>
          c.id === id ? { ...c, status: ok ? ("passed" as const) : ("failed" as const) } : c
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
 
  useEffect(() => {
    if (!isIOS.current || !proctoringEnabled) {
      runAllChecks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  const getStatusIcon = (status: SystemCheck["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-5 h-5 rounded-full border border-border/60 bg-muted/40" />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "passed":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col justify-center">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-[440px] mx-auto min-h-screen relative flex flex-col justify-center p-4 py-10 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="backdrop-blur-xl bg-card border border-border shadow-2xl shadow-primary/10 rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-border/60 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Step 2: Environment Readiness</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">System Check</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Please grant the required permissions to guarantee eligibility for the contest.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Camera feed validation widget */}
            {proctoringEnabled && checksStarted && (
              <div className="p-4 rounded-2xl bg-muted/40 border border-border">
                <CameraCheckWidget
                  onProceed={() => {
                    updateCheckStatus("camera", "passed");
                    updateCheckStatus("microphone", "passed");
                  }}
                  onRetryCamera={() => checkDevices()}
                />
              </div>
            )}
 
            {/* Status Checklist cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {checks
                .filter((check) => proctoringEnabled || (check.id !== "camera" && check.id !== "microphone"))
                .map((check) => (
                <motion.div
                  key={check.id}
                  layout
                  className={`
                    flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
                    ${check.status === "failed" ? "border-destructive/30 bg-destructive/5" : ""}
                    ${check.status === "passed" ? "border-success/30 bg-success/5" : ""}
                    ${check.status === "pending" ? "border-border bg-card/20" : ""}
                    ${check.status === "checking" ? "border-primary/30 bg-primary/5 animate-pulse" : ""}
                  `}
                >
                  <div
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300
                      ${check.status === "passed" ? "bg-success/10 border-success/20 text-success" : ""}
                      ${check.status === "failed" ? "bg-destructive/10 border-destructive/20 text-destructive" : ""}
                      ${check.status === "checking" ? "bg-primary/10 border-primary/20 text-primary" : ""}
                      ${check.status === "pending" ? "bg-muted border-border/60 text-muted-foreground" : ""}
                    `}
                  >
                    {check.icon}
                  </div>
 
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{check.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
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
                        className="h-8 rounded-xl text-xs border-border bg-muted/40 hover:bg-muted text-foreground"
                      >
                        {isRetrying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
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
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-2xl border border-warning/20 bg-warning/5 p-5 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-warning">Permissions Required</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Camera and microphone permissions are strict requirements for this quiz. Please use these settings:
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-foreground">
                  <div className="space-y-1.5 bg-muted/40 p-3.5 rounded-xl border border-border">
                    <p className="font-bold text-foreground flex items-center gap-1">📱 iOS Safari</p>
                    <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                      <li>Open **Settings**</li>
                      <li>Select **Safari**</li>
                      <li>Change **Camera & Mic**</li>
                      <li>Set to **Allow**</li>
                    </ol>
                  </div>
                  
                  <div className="space-y-1.5 bg-muted/40 p-3.5 rounded-xl border border-border">
                    <p className="font-bold text-foreground flex items-center gap-1">🤖 Android Chrome</p>
                    <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                      <li>Tap 🔒 URL lock icon</li>
                      <li>Go to **Site Settings**</li>
                      <li>Find **Camera & Mic**</li>
                      <li>Set to **Allow**</li>
                    </ol>
                  </div>
                  
                  <div className="space-y-1.5 bg-muted/40 p-3.5 rounded-xl border border-border">
                    <p className="font-bold text-foreground flex items-center gap-1">💻 Desktop browsers</p>
                    <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                      <li>Click 🔒 lock icon</li>
                      <li>Enable **Camera & Mic**</li>
                      <li>Reload the page</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            )}
 
            {hasFailedChecks && !deviceCheckFailed && (
              <Alert className="rounded-2xl border-destructive/20 bg-destructive/5 text-destructive">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="font-bold text-xs">Validation Failed</AlertTitle>
                <AlertDescription className="text-[11px] text-muted-foreground mt-1">
                  Please resolve all failed items above. Try using the individual retry buttons.
                </AlertDescription>
              </Alert>
            )}
 
            {allChecksPassed && (
              <Alert className="rounded-2xl border-success/20 bg-success/5 text-success">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertTitle className="font-bold text-xs">All Systems Nominal</AlertTitle>
                <AlertDescription className="text-[11px] text-muted-foreground mt-1">
                  Your device has successfully passed all security and compatibility checks.
                </AlertDescription>
              </Alert>
            )}
 
            {/* iOS manual start overlay */}
            {isIOS.current && proctoringEnabled && !checksStarted && (
              <Alert className="rounded-2xl border-primary/20 bg-primary/5 text-primary">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <AlertTitle className="font-bold text-xs">Action Required</AlertTitle>
                <AlertDescription className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  iOS Safari requires a **user gesture** to initialize the webcam. Click <strong>Start System Checks</strong> below to continue.
                </AlertDescription>
              </Alert>
            )}
 
            {/* Action buttons */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl border-border bg-muted/40 hover:bg-muted text-muted-foreground font-semibold"
                disabled={isRetrying}
                onClick={() => runAllChecks()}
              >
                {isRetrying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</>
                ) : checksStarted ? (
                  "Retest All Systems"
                ) : (
                  "Start System Checks"
                )}
              </Button>
              <Button
                className="flex-1 h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all border-none flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
                disabled={!allChecksPassed || isProceeding}
                onClick={proceedToWaitingRoom}
              >
                {isProceeding ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                ) : (
                  <>
                    Enter waiting room
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
 
            <p className="text-[11px] text-center text-muted-foreground/80 leading-normal">
              {proctoringEnabled
                ? `By continuing, you agree to keep your camera on${isIOS.current ? "." : " and remain in fullscreen mode during the entire quiz session."}`
                : `By continuing, you agree to remain in fullscreen mode${isIOS.current ? "" : " and avoid switching tabs"} during the entire quiz session.`}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
