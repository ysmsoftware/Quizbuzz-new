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
}

/**
 * Hook for managing the real-time WebSocket connection during a quiz
 */
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
}: UseQuizSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL || 'wss://your-domain.com'}/quiz`, {
      path: '/socket.io',
      auth: { token: socketToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Quiz connected:', socket.id);
      
      // Step 1: Join the quiz room
      socket.emit('quiz:v1:join', { participantId, contestId });
      
      // Step 2: Start heartbeats
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

    // Event Listeners
    socket.on('quiz:v1:join_ack', (data) => onJoinAck?.(data));
    socket.on('quiz:v1:quiz_started', (data) => onQuizStarted?.(data));
    socket.on('quiz:v1:answer_ack', (data) => onAnswerAck?.(data));
    socket.on('quiz:v1:submit_ack', (data) => onSubmitAck?.(data));
    socket.on('quiz:v1:auto_submit', (data) => onAutoSubmit?.(data));
    socket.on('quiz:v1:time_warning', (data) => onTimeWarning?.(data));
    socket.on('quiz:v1:ready_ack', (data) => onReadyAck?.(data));
    socket.on('quiz:v1:proctoring_alert', (data) => onProctoringAlert?.(data));
    socket.on('quiz:v1:disqualified', (data) => onDisqualified?.(data));
    socket.on('quiz:v1:error', (data) => onError?.(data));

    socketRef.current = socket;
  }, [socketToken, participantId, contestId, onJoinAck, onQuizStarted, onAnswerAck, onSubmitAck, onAutoSubmit, onTimeWarning, onProctoringAlert, onDisqualified, onError]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatIntervalRef.current = setInterval(() => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('quiz:v1:heartbeat', { participantId, contestId });
      }
    }, 15000);
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  /**
   * Submit an answer for a question
   */
  const submitAnswer = useCallback((questionId: string, selectedOptionId: string | null, questionIndex: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('quiz:v1:answer', {
        participantId,
        contestId,
        questionId,
        selectedOptionId,
        questionIndex,
      });
    }
  }, [participantId, contestId]);

  /**
   * Final quiz submission
   */
  const submitQuiz = useCallback((reason?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('quiz:v1:submit', { participantId, contestId, reason });
    }
  }, [participantId, contestId]);

  /**
   * Send proctoring violation event
   */
  const sendProctoringEvent = useCallback((type: string, severity: number, metadata?: object) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('quiz:v1:proctoring_event', {
        participantId,
        contestId,
        type,
        severity,
        metadata: { ...metadata, timestamp: Date.now() },
      });
    }
  }, [participantId, contestId]);

  /**
   * Mark as ready in waiting room
   */
  const markAsReady = useCallback((cameraGranted: boolean = false) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('quiz:v1:ready', {
        participantId,
        contestId,
        cameraGranted,
      });
    }
  }, [participantId, contestId]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    submitAnswer,
    submitQuiz,
    sendProctoringEvent,
    markAsReady,
    socket: socketRef.current,
  };
}
