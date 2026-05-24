'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

interface UseAdminSocketProps {
  contestId: string;
  organizationId: string;
  accessToken: string;
  onSubscribed?: (data: any) => void;
  onParticipantJoined?: (data: any) => void;
  onParticipantProgress?: (data: any) => void;
  onParticipantSubmitted?: (data: any) => void;
  onParticipantDisconnected?: (data: any) => void;
  onProctoringViolation?: (data: any) => void;
  onParticipantFlagged?: (data: any) => void;
  onLiveStats?: (data: any) => void;
  onQuizEnded?: (data: any) => void;
  onError?: (data: any) => void;
}

/**
 * @deprecated Use useAdminContestSocket instead — connects to /quiz-admin with
 * cookie-based socket-token auth. This hook targets a non-existent /admin namespace.
 */
/**
 * Hook for managing the Admin real-time monitoring WebSocket connection
 */
export function useAdminSocket({
  contestId,
  organizationId,
  accessToken,
  onSubscribed,
  onParticipantJoined,
  onParticipantProgress,
  onParticipantSubmitted,
  onParticipantDisconnected,
  onProctoringViolation,
  onParticipantFlagged,
  onLiveStats,
  onQuizEnded,
  onError,
}: UseAdminSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL || 'wss://your-domain.com'}/admin`, {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Admin Socket connected:', socket.id);
      
      // Subscribe to the specific contest monitoring
      socket.emit('admin:v1:subscribe_contest', { contestId, organizationId });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        toast.error('Admin session disconnected by server.');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Admin Socket Error:', err);
      if (err.message === 'UNAUTHORIZED') {
        toast.error('Admin session unauthorized. Please re-login.');
      }
    });

    // Event Listeners
    socket.on('admin:v1:subscribed', (data) => onSubscribed?.(data));
    socket.on('admin:v1:participant_joined', (data) => onParticipantJoined?.(data));
    socket.on('admin:v1:participant_progress', (data) => onParticipantProgress?.(data));
    socket.on('admin:v1:participant_submitted', (data) => onParticipantSubmitted?.(data));
    socket.on('admin:v1:participant_disconnected', (data) => onParticipantDisconnected?.(data));
    socket.on('admin:v1:proctoring_violation', (data) => onProctoringViolation?.(data));
    socket.on('admin:v1:participant_flagged', (data) => onParticipantFlagged?.(data));
    socket.on('admin:v1:live_stats', (data) => onLiveStats?.(data));
    socket.on('admin:v1:quiz_ended', (data) => onQuizEnded?.(data));
    socket.on('error', (data) => onError?.(data));

    socketRef.current = socket;
  }, [accessToken, contestId, organizationId, onSubscribed, onParticipantJoined, onParticipantProgress, onParticipantSubmitted, onParticipantDisconnected, onProctoringViolation, onParticipantFlagged, onLiveStats, onQuizEnded, onError]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setIsConnected(false);
  }, []);

  /**
   * Manually start the quiz
   */
  const startQuiz = useCallback(() => {
    socketRef.current?.emit('admin:v1:start_quiz', { contestId });
  }, [contestId]);

  /**
   * Broadcast message to all participants
   */
  const broadcast = useCallback((message: string, type: 'ANNOUNCEMENT' | 'WARNING' | 'INFO' = 'ANNOUNCEMENT') => {
    socketRef.current?.emit('admin:v1:broadcast', { contestId, message, type });
  }, [contestId]);

  /**
   * Kick participant from session
   */
  const kickParticipant = useCallback((participantId: string) => {
    socketRef.current?.emit('admin:v1:kick_participant', { contestId, participantId });
  }, [contestId]);

  /**
   * Ban and disqualify participant
   */
  const banParticipant = useCallback((participantId: string, reason: string) => {
    socketRef.current?.emit('admin:v1:ban_participant', { contestId, participantId, reason });
  }, [contestId]);

  /**
   * Request manual camera snapshot
   */
  const requestSnapshot = useCallback((participantId: string) => {
    socketRef.current?.emit('admin:v1:request_snapshot', { contestId, participantId });
  }, [contestId]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    startQuiz,
    broadcast,
    kickParticipant,
    banParticipant,
    requestSnapshot,
    socket: socketRef.current,
  };
}
