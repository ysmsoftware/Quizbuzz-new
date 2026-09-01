'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useProctoringStore } from '@/lib/stores/proctoring-store';
import { useFaceDetection } from '@/lib/proctoring/useFaceDetection';

// ═══════════════════════════════════════════════════════
// ProctoringManager — Side-effect component
// ═══════════════════════════════════════════════════════

interface ProctoringManagerProps {
    emitProctoringWarning: (type: string) => void;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    overlayCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
    socket?: any;
    contestId?: string;
    participantId?: string;
    sessionToken?: string;
    proctoringEnabled?: boolean;
}

// proctoringEnabled === false means "this contest has no camera module" —
// it does NOT mean "stop monitoring the participant". Tab-switch detection,
// fullscreen enforcement, copy/paste blocking, and keyboard-shortcut blocking
// must keep running either way; only the camera-dependent pieces (face
// detection, audio analysis from the mic, and snapshot capture/upload) are
// skipped when there is no camera module for this contest.
export function ProctoringManager({
    emitProctoringWarning,
    videoRef,
    overlayCanvasRef,
    socket,
    contestId,
    participantId,
    sessionToken,
    proctoringEnabled = true,
}: ProctoringManagerProps) {
    const [showFullscreenRequest, setShowFullscreenRequest] = useState(false);
    const store = useProctoringStore();
    const entryCaptureRun = useRef(false);

    // Refs to track cumulative counts for silent threshold triggers
    const tabSwitchesCountRef = useRef(0);
    const fullscreenExitsCountRef = useRef(0);
    const multipleFacesCountRef = useRef(0);
    const windowBlursCountRef = useRef(0);
    const faceNotDetectedCountRef = useRef(0);

    // Hard per-participant ceiling on snapshot uploads for the whole contest,
    // across every trigger type combined (scheduled + evidence captures).
    // Client-side only by design — see the capture-count-cap decision in
    // claude/proctoring-snapshot-capture-size-storage-audit.md.
    // TODO: pull into config/ (e.g. config.proctoring.maxSnapshotsPerParticipant)
    // instead of this literal, per this project's own config-agnostic rule.
    const MAX_SNAPSHOTS_PER_PARTICIPANT = 6;
    const snapshotCountRef = useRef(0);

    // ─────────────────────────────────────────────────────────────────────
    // 8. DIRECT S3/LOCAL UPLOAD & CONFIRMATION FLOW
    // NOTE: Defined first so it can be referenced by all event handlers below.
    // The backend ignores the client-sent 'folder' field and constructs the
    // path securely as proctoring/{contestSlug}/{participantSlug}/ from the JWT.
    // ─────────────────────────────────────────────────────────────────────
    const handleCaptureAndUpload = useCallback(async (captureType: string): Promise<void> => {
        // No camera module for this contest — nothing to capture.
        if (!proctoringEnabled) return;
        if (!videoRef.current || !sessionToken) return;
        // Hard cap: once this participant has hit MAX_SNAPSHOTS_PER_PARTICIPANT
        // for the contest, stop uploading more — checked and incremented
        // synchronously (no await between the two) so concurrent triggers
        // (e.g. a socket capture request landing alongside a violation-driven
        // one) can't both slip past the check before either increments it.
        if (snapshotCountRef.current >= MAX_SNAPSHOTS_PER_PARTICIPANT) {
            console.log(`[QuizPro] Snapshot cap (${MAX_SNAPSHOTS_PER_PARTICIPANT}) reached — skipping ${captureType} capture`);
            return;
        }
        snapshotCountRef.current += 1;
        const video = videoRef.current;

        // Ensure video is playing and ready to capture
        if (video.readyState < 2) {
            console.warn('[QuizPro] Video stream not ready for capture');
            return;
        }

        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve();
                return;
            }
            ctx.drawImage(video, 0, 0, 320, 240);

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    resolve();
                    return;
                }

                try {
                    // A. Fetch Presigned URL
                    // The 'folder' field is kept for schema compatibility but overridden server-side.
                    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/+$/, '');
                    const response = await fetch(`${baseUrl}/quiz-proctoring/presigned-url`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${sessionToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            filename: `snapshot_${Date.now()}.webp`,
                            folder: 'proctoring', // Overridden server-side; kept for schema
                            mimeType: 'image/webp'
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`Failed to fetch presigned URL: ${response.statusText}`);
                    }

                    const resData = await response.json();
                    if (!resData.success || !resData.data) {
                        throw new Error('Invalid presigned URL response structure');
                    }

                    const { url, storageKey } = resData.data;

                    // B. Direct PUT (bypassing node backend server entirely)
                    const uploadRes = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'image/webp'
                        },
                        body: blob
                    });

                    if (!uploadRes.ok) {
                        throw new Error(`Direct image upload failed: ${uploadRes.statusText}`);
                    }

                    // C. Post Confirmed Metadata asynchronously to BullMQ queue
                    const confirmRes = await fetch(`${baseUrl}/quiz-proctoring/confirm`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${sessionToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: captureType,
                            storageKey,
                            severity: 1, // Snapshot captures are Low (1) severity
                            metadata: {
                                source: 'client-capture',
                                quality: 0.7,
                                dimensions: '320x240'
                            },
                            occurredAt: new Date().toISOString()
                        })
                    });

                    if (!confirmRes.ok) {
                        throw new Error(`Failed to confirm upload: ${confirmRes.statusText}`);
                    }

                    console.log(`[QuizPro] Successful snapshot upload & confirmation for ${captureType}`);
                } catch (err) {
                    console.error('[QuizPro] Snapshot capture/upload process failed:', err);
                } finally {
                    resolve();
                }
            }, 'image/webp', 0.7);
        });
    }, [sessionToken, videoRef, proctoringEnabled]);

    // ─────────────────────────────────────────────────────────────────────
    // notifyViolation: tells the admin dashboard about a violation, every
    // single time it happens — not just once some repeat-count threshold is
    // crossed. Handled server-side by quiz.gateway.ts's handleViolation(),
    // which persists it and pushes admin:v1:violation_alert to the live
    // Violation Feed. Used for every violation type, including the ones
    // below that no longer capture evidence.
    //
    // captureEvidence: uploads a snapshot as supporting evidence. Deliberately
    // NOT wired up for TAB_SWITCH, FULLSCREEN_EXIT or WINDOW_BLUR — a face
    // photo doesn't show what the participant actually did (which tab, what
    // was outside fullscreen), so it isn't useful evidence for those triggers,
    // just S3 cost. Reserved for MULTIPLE_FACES and FACE_NOT_DETECTED, past
    // each one's own repeat-count threshold, since those are the triggers a
    // face snapshot can actually substantiate. Every capture call also goes
    // through handleCaptureAndUpload's own MAX_SNAPSHOTS_PER_PARTICIPANT cap
    // (currently 6), shared across every trigger type including the
    // always-on SNAPSHOT_START/MID_POINT/RANDOM captures.
    // See claude/proctoring-snapshot-capture-size-storage-audit.md.
    // ─────────────────────────────────────────────────────────────────────
    const notifyViolation = useCallback((type: string, metadata: Record<string, unknown> = {}) => {
        socket?.emit('quiz:v1:violation', {
            type,
            severity: 'LOW',
            metadata,
            timestamp: new Date().toISOString()
        });
    }, [socket]);

    const captureEvidence = useCallback((type: string) => {
        handleCaptureAndUpload(type);
    }, [handleCaptureAndUpload]);

    // 1. REQUEST + ENFORCE FULLSCREEN
    //
    // As of Safari 17.4 (iPhone), the real Fullscreen API works for ordinary
    // page content, not just <video> — so we no longer special-case iPhone
    // into a permanently-simulated "isFullscreen: true". Instead we always
    // attempt the real thing via store.enterFullscreen(), which itself
    // handles the iPhone case: try the real API first, and only fall back to
    // simulating success if the device genuinely has no Fullscreen API at
    // all (very old iOS). This mount-time attempt has no user gesture behind
    // it, so on iPhone it will typically fail here (Safari requires the tap
    // to happen directly inside a click handler) — that's expected and
    // handled: if an earlier gesture (the system-check page's "Start System
    // Checks" tap) already achieved real fullscreen and it survived the
    // client-side navigation into this page, document.fullscreenElement is
    // already truthy and we just reflect that. If not,
    // FullscreenReturnOverlay renders (isFullscreen is false) and its
    // "Enter Fullscreen" button click IS a valid gesture, so tapping it will
    // actually succeed via store.enterFullscreen() -> handleReturnFullscreen.
    useEffect(() => {
        const attemptFullscreen = async () => {
            if (document.fullscreenElement) {
                store.setFullscreen(true);
                return;
            }
            const ok = await store.enterFullscreen();
            if (!ok) {
                setShowFullscreenRequest(true);
            }
        };

        // Attempt fullscreen on mount
        attemptFullscreen();

        const handleFullscreenChange = () => {
            const isCurrentlyFullscreen = !!document.fullscreenElement;
            if (!isCurrentlyFullscreen && store.isFullscreen) {
                fullscreenExitsCountRef.current += 1;
                const count = fullscreenExitsCountRef.current;
                store.addWarning({ type: 'FULLSCREEN_EXIT', timestamp: Date.now() });
                emitProctoringWarning('FULLSCREEN_EXIT');
                // Admin sees every exit from the first one. No evidence snapshot:
                // a face photo doesn't show what the participant did outside
                // fullscreen, so it isn't useful evidence for this trigger.
                notifyViolation('FULLSCREEN_EXIT', { count });
            }
            store.setFullscreen(isCurrentlyFullscreen);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [emitProctoringWarning, store, notifyViolation, captureEvidence]);

    // 2. TAB SWITCH DETECTION
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                tabSwitchesCountRef.current += 1;
                const count = tabSwitchesCountRef.current;
                store.addWarning({ type: 'TAB_SWITCH', timestamp: Date.now() });
                emitProctoringWarning('TAB_SWITCH');
                // Admin sees every switch from the first one. No evidence snapshot:
                // a face photo doesn't show what tab/app the participant switched
                // to, so it isn't useful evidence for this trigger.
                notifyViolation('TAB_SWITCH', { count });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [emitProctoringWarning, store, notifyViolation, captureEvidence]);

    // 2b. WINDOW FOCUS/BLUR MONITORING (WINDOW_BLUR)
    useEffect(() => {
        const handleBlur = () => {
            store.setFocused(false);
            windowBlursCountRef.current += 1;
            const count = windowBlursCountRef.current;
            store.addWarning({ type: 'WINDOW_BLUR', timestamp: Date.now() });
            emitProctoringWarning('WINDOW_BLUR');
            // No evidence snapshot: same reasoning as TAB_SWITCH/FULLSCREEN_EXIT —
            // a face photo isn't useful evidence for a window-blur event.
            notifyViolation('WINDOW_BLUR', { count });
        };

        const handleFocus = () => {
            store.setFocused(true);
        };

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
        };
    }, [emitProctoringWarning, store, notifyViolation, captureEvidence]);

    // 3. COPY / PASTE PREVENTION
    useEffect(() => {
        const prevent = (e: ClipboardEvent) => {
            e.preventDefault();
            toast.warning('Copy-paste is disabled during this quiz');
        };
        document.addEventListener('copy', prevent);
        document.addEventListener('cut', prevent);
        document.addEventListener('paste', prevent);
        return () => {
            document.removeEventListener('copy', prevent);
            document.removeEventListener('cut', prevent);
            document.removeEventListener('paste', prevent);
        };
    }, []);

    // 4. RIGHT-CLICK PREVENTION
    useEffect(() => {
        const prevent = (e: MouseEvent) => e.preventDefault();
        document.addEventListener('contextmenu', prevent);
        return () => document.removeEventListener('contextmenu', prevent);
    }, []);

    // 5. KEYBOARD SHORTCUTS PREVENTION
    useEffect(() => {
        const prevent = (e: KeyboardEvent) => {
            // Block: Ctrl+C, Ctrl+V, Ctrl+U (view source), F12 (devtools), Ctrl+Shift+I, Ctrl+A
            const key = e.key.toLowerCase();
            if (
                (e.ctrlKey && ['c', 'v', 'u', 'a'].includes(key)) ||
                e.key === 'F12' ||
                (e.ctrlKey && e.shiftKey && key === 'i')
            ) {
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', prevent);
        return () => document.removeEventListener('keydown', prevent);
    }, []);

    // 6. CAMERA STREAM
    // On mount: check if stream already exists in store (from entry page)
    // Only request if not already granted (handles direct navigation to /live)
    // Skipped entirely when this contest has no camera module.
    useEffect(() => {
        if (!proctoringEnabled) return;
        const storeState = useProctoringStore.getState();
        if (!storeState.videoStream || storeState.cameraStatus !== 'active') {
            storeState.requestCameraPermission();
        }
    }, [proctoringEnabled]);

    // Attach stream to videoRef whenever the stream or ref changes.
    // Using a subscription so this fires even if the stream was set before this component mounted.
    useEffect(() => {
        const attach = () => {
            const { videoStream } = useProctoringStore.getState();
            const video = videoRef.current;
            if (video && videoStream && video.srcObject !== videoStream) {
                video.srcObject = videoStream;
                video.play().catch(() => { });
            }
        };

        // Attach immediately if stream already exists
        attach();

        // Also subscribe to store changes so we attach as soon as stream is granted
        let prevStream = useProctoringStore.getState().videoStream;
        const unsub = useProctoringStore.subscribe(
            (state) => {
                if (state.videoStream !== prevStream) {
                    prevStream = state.videoStream;
                    attach();
                }
            }
        );
        return () => unsub();
    }, [videoRef]);

    // 7. FACE DETECTION
    // Every face-detection warning (FACE_NOT_DETECTED, GAZE_AWAY,
    // MULTIPLE_FACES) is already gated by useFaceDetection's own
    // continuous-duration threshold (5s/6s/3s), so each one reaching here is
    // meaningful enough to notify admin immediately. MULTIPLE_FACES keeps its
    // extra >3-occurrences tier on top of that: past it, evidence is captured
    // and the participant-facing warning is deliberately suppressed (stays
    // silent to them once it's clearly not accidental) — admin still gets it.
    const wrappedEmit = useCallback((event: string, data: Record<string, unknown>) => {
        if (event === 'PROCTOR_WARNING' && typeof data.warningType === 'string') {
            const type = data.warningType;
            if (type === 'MULTIPLE_FACES') {
                multipleFacesCountRef.current += 1;
                const count = multipleFacesCountRef.current;
                notifyViolation('MULTIPLE_FACES', { count });
                if (count > 3) {
                    captureEvidence('MULTIPLE_FACES');
                    return; // Skip standard user warning
                }
            } else if (type === 'FACE_NOT_DETECTED') {
                // Each occurrence here already passed useFaceDetection's own
                // 5s continuous-absence threshold, so repeated occurrences are
                // meaningfully serious — capture evidence past a small repeat
                // count, same pattern as MULTIPLE_FACES.
                // TODO: pull the >3 threshold into config/, same as MULTIPLE_FACES.
                faceNotDetectedCountRef.current += 1;
                const count = faceNotDetectedCountRef.current;
                notifyViolation('FACE_NOT_DETECTED', { count });
                if (count > 3) {
                    captureEvidence('FACE_NOT_DETECTED');
                    return; // Skip standard user warning
                }
            } else {
                notifyViolation(type);
            }
            emitProctoringWarning(type);
        }
    }, [emitProctoringWarning, notifyViolation, captureEvidence]);

    useFaceDetection({
        videoRef,
        active: proctoringEnabled,
        wsEmit: wrappedEmit,
        overlayCanvasRef,
    });

    // 9. WEB AUDIO API - ENVIRONMENTAL VOLUME CHECKS (FFT size 256, 500ms loop, threshold 80, 2s anomalous state)
    // Audio comes from the camera/mic stream — skip entirely with no camera module.
    useEffect(() => {
        if (!proctoringEnabled) return;
        let audioContext: AudioContext | null = null;
        let source: MediaStreamAudioSourceNode | null = null;
        let analyser: AnalyserNode | null = null;
        let volumeInterval: number | null = null;
        let continuousSpikeCount = 0;

        const startAudioMonitoring = async () => {
            const { videoStream } = useProctoringStore.getState();
            if (!videoStream) return;

            const audioTracks = videoStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[QuizPro] No audio tracks found in stream');
                return;
            }

            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) return;

                audioContext = new AudioContextClass();
                source = audioContext.createMediaStreamSource(videoStream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;

                source.connect(analyser);
                // Note: Do NOT connect analyser to audioContext.destination to prevent feedback loop!

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);

                // Periodical sample loop (every 500ms)
                volumeInterval = window.setInterval(() => {
                    if (!analyser) return;

                    analyser.getByteFrequencyData(dataArray);

                    // Compute average volume across frequency bins
                    let sum = 0;
                    for (let i = 0; i < bufferLength; i++) {
                        sum += dataArray[i];
                    }
                    const averageVolume = sum / bufferLength;

                    // Threshold check (averageVolume > 80)
                    if (averageVolume > 80) {
                        continuousSpikeCount++;
                        // 2 seconds of continuous anomaly: 4 samples of 500ms = 2000ms
                        if (continuousSpikeCount >= 4) {
                            store.addWarning({ type: 'HIGH_VOLUME', timestamp: Date.now() });
                            emitProctoringWarning('AUDIO_ANOMALY');
                            // Previously never reached the server at all — admin had zero
                            // visibility into audio anomalies regardless of how often they fired.
                            notifyViolation('AUDIO_ANOMALY');
                            continuousSpikeCount = 0; // Reset after warning to prevent spamming warnings
                        }
                    } else {
                        // Decay continuous counts if noise quieted down
                        continuousSpikeCount = Math.max(0, continuousSpikeCount - 1);
                    }
                }, 500);
            } catch (err) {
                console.error('[QuizPro] Failed to setup environmental volume checking:', err);
            }
        };

        // Wait a brief moment to ensure stream state settles
        const timer = setTimeout(startAudioMonitoring, 1500);

        return () => {
            clearTimeout(timer);
            if (volumeInterval) {
                clearInterval(volumeInterval);
            }
            if (source) {
                source.disconnect();
            }
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close();
            }
        };
    }, [emitProctoringWarning, store, proctoringEnabled, notifyViolation]);

    // 10. ENTRY AUTO CAPTURE TRIGGER (Runs exactly once when the camera is active)
    useEffect(() => {
        if (proctoringEnabled && store.cameraStatus === 'active' && !entryCaptureRun.current) {
            entryCaptureRun.current = true;
            // Wait 2 seconds after camera starts to capture a stable entry frame
            setTimeout(() => {
                handleCaptureAndUpload('SNAPSHOT_START');
            }, 2000);
        }
    }, [store.cameraStatus, handleCaptureAndUpload, proctoringEnabled]);

    // 11. WINDOW-LEVEL EXIT CAPTURE TRIGGER (Registered for synchronous capture during submit)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__triggerProctoringCapture = (type: string) => {
                return handleCaptureAndUpload(type);
            };
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).__triggerProctoringCapture;
            }
        };
    }, [handleCaptureAndUpload]);

    // 12. SOCKET.IO RANDOM/MID POINT CAPTURE TRIGGER
    useEffect(() => {
        if (!socket) return;

        const handleCaptureRequest = (data: { captureType?: string; type?: string }) => {
            const type = data.captureType || data.type || 'SNAPSHOT_RANDOM';
            console.log(`[QuizPro] Socket capture request received:`, type);
            handleCaptureAndUpload(type);
        };

        socket.on('quiz:v1:capture_request', handleCaptureRequest);
        return () => {
            socket.off('quiz:v1:capture_request', handleCaptureRequest);
        };
    }, [socket, handleCaptureAndUpload]);

    return null;
}
