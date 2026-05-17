'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';

/**
 * Types for Live Monitoring
 */
export interface LiveParticipant {
  participantId: string;
  name: string;
  status: 'active' | 'submitted' | 'disconnected' | 'flagged';
  currentQuestion: number;
  totalQuestions: number;
  answeredCount: number;
  timeRemainingSeconds: number;
  timeOnQuestion: number;
  estimatedScorePercent: number;
  estimatedCorrect: number;
  proctoringAlerts: number;
  avatarInitials: string;
  isFlagged: boolean;
}

export interface BroadcastMessage {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'urgent';
  target: 'all' | 'active' | 'waiting';
  timestamp: string;
}

export interface ProctorAlert {
  id: string;
  participantId: string;
  name: string;
  type: string;
  severity: number;
  timestamp: string;
}

/**
 * Admin Contest Socket Hook
 * Handles real-time monitoring and management of a live contest.
 */
export function useAdminContestSocket(
  contestId: string,
  adminId: string,
  organizationId?: string,
  onStatusChange?: (status: any) => void,
  onViolation?: (violation: any) => void
) {
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [stats, setStats] = useState({
    totalJoined: 0,
    activeNow: 0,
    inWaitingRoom: 0,
    submitted: 0,
    flagged: 0
  });

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!contestId) return;

    // Connect to /admin namespace
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    const socket = io(`${WS_URL}/admin`, {
      path: '/socket.io',
      auth: {
        token: localStorage.getItem('accessToken'), // Get admin token from storage
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Subscribe to contest updates
      socket.emit('admin:v1:subscribe_contest', { 
        contestId,
        organizationId 
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Handle initial state snapshot
    socket.on('admin:v1:subscribed', (data: any) => {
      if (data.participants) {
        const mapped = data.participants.map(mapBackendParticipant);
        setParticipants(mapped);
      }
      updateStats(data);
    });

    // Handle participant joined
    socket.on('admin:v1:participant_joined', (data: any) => {
      setParticipants(prev => {
        const exists = prev.find(p => p.participantId === data.participantId);
        if (exists) return prev;
        return [...prev, mapBackendParticipant(data)];
      });
    });

    // Handle participant progress
    socket.on('admin:v1:participant_progress', (data: any) => {
      setParticipants(prev => prev.map(p => {
        if (p.participantId === data.participantId) {
          return {
            ...p,
            currentQuestion: data.currentQuestionIndex + 1,
            answeredCount: data.answeredCount,
            // Add other progress fields if available
          };
        }
        return p;
      }));
    });

    // Handle participant submitted
    socket.on('admin:v1:participant_submitted', (data: any) => {
      setParticipants(prev => prev.map(p => {
        if (p.participantId === data.participantId) {
          return { ...p, status: 'submitted' as const };
        }
        return p;
      }));
      toast.info(`${data.name || 'A participant'} submitted their quiz`);
    });

    // Handle participant disconnected
    socket.on('admin:v1:participant_disconnected', (data: any) => {
      setParticipants(prev => prev.map(p => {
        if (p.participantId === data.participantId) {
          return { ...p, status: 'disconnected' as const };
        }
        return p;
      }));
    });

    // Handle proctoring violations
    socket.on('admin:v1:proctoring_violation', (data: any) => {
      setParticipants(prev => prev.map(p => {
        if (p.participantId === data.participantId) {
          return {
            ...p,
            proctoringAlerts: (p.proctoringAlerts || 0) + 1,
            isFlagged: data.isFlagged
          };
        }
        return p;
      }));
      if (onViolation) onViolation(data);
    });

    // Handle aggregate live stats
    socket.on('admin:v1:live_stats', (data: any) => {
      updateStats(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [contestId, organizationId, onViolation]);

  const updateStats = (data: any) => {
    setStats({
      totalJoined: data.totalCheckedIn || data.totalInQuiz || 0,
      activeNow: data.totalInQuiz || 0,
      inWaitingRoom: (data.totalCheckedIn || 0) - (data.totalInQuiz || 0),
      submitted: data.totalSubmitted || 0,
      flagged: data.totalDisqualified || 0, // Mapping disqualified to flagged for UI
    });
  };

  const mapBackendParticipant = (p: any): LiveParticipant => ({
    participantId: p.participantId,
    name: p.name || 'Anonymous',
    status: mapStatus(p.status),
    currentQuestion: (p.currentQuestionIndex || 0) + 1,
    totalQuestions: p.totalQuestions || 0,
    answeredCount: p.answeredCount || 0,
    timeRemainingSeconds: p.timeRemainingSeconds || 0,
    timeOnQuestion: p.timeOnQuestionSeconds || 0,
    estimatedScorePercent: Math.round((p.answeredCount / (p.totalQuestions || 1)) * 100), // Mock calc
    estimatedCorrect: p.answeredCount, // Mock
    proctoringAlerts: p.violationCount || 0,
    avatarInitials: (p.name || 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
    isFlagged: !!p.isFlagged,
  });

  const mapStatus = (status: string): LiveParticipant['status'] => {
    switch (status) {
      case 'IN_QUIZ': return 'active';
      case 'SUBMITTED': return 'submitted';
      case 'DISCONNECTED': return 'disconnected';
      case 'FLAGGED': return 'flagged';
      default: return 'active';
    }
  };

  const sendBroadcast = useCallback((message: string, type: string, target: string) => {
    if (socketRef.current) {
      socketRef.current.emit('admin:v1:broadcast', {
        contestId,
        message,
        type: type.toUpperCase(),
        target: target.toUpperCase()
      });
      
      const newMessage: BroadcastMessage = {
        id: Math.random().toString(36).slice(2),
        message,
        type: type as any,
        target: target as any,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [newMessage, ...prev]);
    }
  }, [contestId]);

  const forceSubmitParticipant = useCallback((participantId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('admin:v1:kick_participant', {
        contestId,
        participantId
      });
      toast.success('Participant kicked and forced to submit');
    }
  }, [contestId]);

  const getParticipantStats = useCallback(() => stats, [stats]);

  return {
    connected,
    participants,
    messages,
    sendBroadcast,
    getParticipantStats,
    forceSubmitParticipant
  };
}
