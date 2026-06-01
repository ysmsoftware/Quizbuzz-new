'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface UseQuizSocketProps {
    contestId: string;
    participantId: string;
    socketToken: string;
    onJoinAck?: (data: any) => void;
    onQuizStarted?: (data: any) => void;
    onAnswerAck?: (data: any) => void;
    onSubmitAck?: (data: any) => void;
    onAutoSubmit?: (data: any) => void;
    onTimeWarning?: (data: any) => void;
    onReadyAck?: (data: any) => void;
    onProctoringAlert?: (data: any) => void;
    onDisqualified?: (data: any) => void;
    onError?: (data: any) => void;
    onCaptureRequest?: (data: any) => void;
}

const mapViolationType = (type: string): string => {
    const t = type.toUpperCase();
    if (t.includes('NO_FACE') || t.includes('FACE_NOT_DETECTED') || t.includes('FACE_NOT_FOUND')) return 'FACE_NOT_DETECTED';
    if (t.includes('MULTIPLE') || t.includes('MULTI_FACE')) return 'MULTIPLE_FACES';
    if (t.includes('AUDIO')) return 'AUDIO_ANOMALY';
    if (t.includes('LIGHT') || t.includes('POOR_LIGHTING')) return 'POOR_LIGHTING';
    if (t.includes('GAZE') || t.includes('LOOKING_AWAY') || t.includes('LOOK_AWAY')) return 'GAZE_AWAY';
    if (t.includes('TAB_SWITCH') || t.includes('TAB_CHANGE')) return 'TAB_SWITCH';
    if (t.includes('BLUR') || t.includes('WINDOW_BLUR')) return 'WINDOW_BLUR';
    if (t.includes('FULLSCREEN') || t.includes('EXIT_FULLSCREEN')) return 'FULLSCREEN_EXIT';
    if (t.includes('RESIZE') || t.includes('SCREEN_RESIZE')) return 'SCREEN_RESIZE';
    return 'TAB_SWITCH';
};

const mapViolationSeverity = (severity: number | string): 'LOW' | 'MEDIUM' | 'HIGH' => {
    if (typeof severity === 'number') {
        if (severity <= 1) return 'LOW';
        if (severity === 2) return 'MEDIUM';
        return 'HIGH';
    }
    const s = severity.toUpperCase();
    if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH') return s as 'LOW' | 'MEDIUM' | 'HIGH';
    return 'LOW';
};

export function useQuizSocket({
    contestId,
    participantId,
    socketToken,
    onJoinAck,
    onQuizStarted,
    onAnswerAck,
    onSubmitAck,
    onAutoSubmit,
    onTimeWarning,
    onReadyAck,
    onProctoringAlert,
    onDisqualified,
    onError,
    onCaptureRequest,
}: UseQuizSocketProps) {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Store all callbacks in refs so they never appear in useEffect deps ──────
    // This is the critical fix: inline arrow-function props recreate every render,
    // so putting them in useCallback/useEffect deps causes an infinite reconnect loop.
    const cbRef = useRef({
        onJoinAck, onQuizStarted, onAnswerAck, onSubmitAck,
        onAutoSubmit, onTimeWarning, onReadyAck, onProctoringAlert,
        onDisqualified, onError, onCaptureRequest,
    });
    useEffect(() => {
        cbRef.current = {
            onJoinAck, onQuizStarted, onAnswerAck, onSubmitAck,
            onAutoSubmit, onTimeWarning, onReadyAck, onProctoringAlert,
            onDisqualified, onError, onCaptureRequest,
        };
    });

    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    const startHeartbeat = useCallback(() => {
        stopHeartbeat();
        heartbeatIntervalRef.current = setInterval(() => {
            if (socketRef.current?.connected) {
                socketRef.current.emit('quiz:v1:heartbeat');
            }
        }, 30_000);
    }, [stopHeartbeat]);

    // ── Single stable effect — only re-runs if connection params change ──────────
    useEffect(() => {
        // All three must be non-empty. contestId guards against the race where the
        // auth store hydrates after first render and the effect runs with "".
        if (!contestId || !participantId || !socketToken) return;

        const socket = io(
            `${process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000'}/participant`,
            {
                path: '/socket.io',
                auth: { token: socketToken },
                transports: ['polling', 'websocket'],
                reconnectionAttempts: 5,
                reconnectionDelay: 2000,
                reconnectionDelayMax: 10_000,
            },
        );

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            console.log('Quiz connected:', socket.id);
            // Re-join on every (re)connect so the room membership survives reconnects
            socket.emit('quiz:v1:join', { participantId });
            startHeartbeat();
        });

        socket.on('disconnect', (reason) => {
            setIsConnected(false);
            stopHeartbeat();
            if (reason === 'io server disconnect') {
                toast.error('You have been disconnected by the server.');
            }
        });

        socket.on('connect_error', (err) => {
            if (err.message === 'UNAUTHORIZED') {
                toast.error('Session expired. Please log in again.');
            }
        });

        // ── Route all events through the ref — never stale ──────────────────────
        socket.on('quiz:v1:waiting_room_status', (d) => cbRef.current.onJoinAck?.(d));
        socket.on('quiz:v1:start', (d) => cbRef.current.onQuizStarted?.(d));
        socket.on('quiz:v1:answer_saved', (d) => cbRef.current.onAnswerAck?.(d));
        socket.on('quiz:v1:submit_success', (d) => cbRef.current.onSubmitAck?.(d));
        socket.on('quiz:v1:auto_submit', (d) => cbRef.current.onAutoSubmit?.(d));
        socket.on('quiz:v1:time_warning', (d) => cbRef.current.onTimeWarning?.(d));
        socket.on('quiz:v1:violation_update', (d) => cbRef.current.onProctoringAlert?.(d));
        socket.on('quiz:v1:capture_request', (d) => cbRef.current.onCaptureRequest?.(d));
        // Backward-compat aliases
        socket.on('quiz:v1:join_ack', (d) => cbRef.current.onJoinAck?.(d));
        socket.on('quiz:v1:quiz_started', (d) => cbRef.current.onQuizStarted?.(d));
        socket.on('quiz:v1:answer_ack', (d) => cbRef.current.onAnswerAck?.(d));
        socket.on('quiz:v1:submit_ack', (d) => cbRef.current.onSubmitAck?.(d));
        socket.on('quiz:v1:ready_ack', (d) => cbRef.current.onReadyAck?.(d));
        socket.on('quiz:v1:proctoring_alert', (d) => cbRef.current.onProctoringAlert?.(d));
        socket.on('quiz:v1:disqualified', (d) => cbRef.current.onDisqualified?.(d));
        socket.on('quiz:v1:error', (d) => cbRef.current.onError?.(d));

        return () => {
            stopHeartbeat();
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        };
        // ⚠️  contestId / participantId / socketToken only — callbacks are in refs
    }, [contestId, participantId, socketToken, startHeartbeat, stopHeartbeat]);

    // ── Public API ───────────────────────────────────────────────────────────────
    const submitAnswer = useCallback(
        (questionId: string, selectedOptionId: string | null, selectedOptionText: string | null, answeredAt: string) => {
            socketRef.current?.emit('quiz:v1:answer', { questionId, selectedOptionId, selectedOptionText, answeredAt });
        },
        [],
    );

    const submitQuiz = useCallback(
        (answers: Record<string, string>, timeTakenSecs: number) => {
            socketRef.current?.emit('quiz:v1:submit', { answers, timeTakenSecs });
        },
        [],
    );

    const sendProctoringEvent = useCallback(
        (type: string, severity: number | string, metadata?: Record<string, unknown>) => {
            socketRef.current?.emit('quiz:v1:violation', {
                type: mapViolationType(type),
                severity: mapViolationSeverity(severity),
                metadata,
                timestamp: new Date().toISOString(),
            });
        },
        [],
    );

    return {
        isConnected,
        socket: socketRef.current,
        submitAnswer,
        submitQuiz,
        sendProctoringEvent,
    };
}

