'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { getAdminSocketToken } from '@/lib/api/auth.api';

/**
 * Types for Live Monitoring
 */
export interface LiveParticipant {
  participantId: string;
  name: string;
  status: 'waiting' | 'active' | 'submitted' | 'disconnected' | 'flagged';
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
  lastActivityAt: string;
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
 *
 * Connects to the /quiz-admin namespace using a short-lived socket token
 * fetched from GET /auth/admin/socket-token (cookie-authenticated).
 * Namespace is /quiz-admin as defined in AdminGateway and server.ts.
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
    flagged: 0,
    totalViolations: 0,
  });
  const [violations, setViolations] = useState<ProctorAlert[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const onViolationRef = useRef(onViolation);
  useEffect(() => { onViolationRef.current = onViolation; }, [onViolation]);

  // Performance Optimization Refs for batching real-time updates
  const participantsRef = useRef<Map<string, LiveParticipant>>(new Map());
  const statsRef = useRef({
    totalJoined: 0,
    activeNow: 0,
    inWaitingRoom: 0,
    submitted: 0,
    flagged: 0,
    totalViolations: 0,
  });
  const violationsRef = useRef<ProctorAlert[]>([]);
  const hasChangesRef = useRef(false);

  // Interval to flush batched updates to state every 500ms
  useEffect(() => {
    const flushInterval = setInterval(() => {
      if (hasChangesRef.current) {
        setParticipants(Array.from(participantsRef.current.values()));
        setStats({ ...statsRef.current });
        setViolations([...violationsRef.current]);
        hasChangesRef.current = false;
      }
    }, 500);

    return () => clearInterval(flushInterval);
  }, []);

  useEffect(() => {
    if (!contestId) return;

    let cancelled = false;

    const connectWithToken = async () => {
      let socketToken: string;

      try {
        const res = await getAdminSocketToken();
        socketToken = res.data.socketToken;
      } catch (err) {
        toast.error('Failed to authenticate admin WebSocket. Please refresh.');
        return;
      }

      if (cancelled) return;

      const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';

      const socket = io(`${WS_URL}/quiz-admin`, {
        path: '/socket.io',
        auth: { token: socketToken },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,      // back-off before retry
        reconnectionDelayMax: 10000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        // Subscribe to the contest room — backend event: admin:v1:subscribe
        socket.emit('admin:v1:subscribe', { contestId });
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('connect_error', (err) => {
        if (err.message?.includes('UNAUTHORIZED') || err.message?.includes('Authentication')) {
          toast.error('Admin session expired. Please refresh the page.');
        }
      });

      // Initial live stats snapshot
      socket.on('admin:v1:live-stats', (data: any) => {
        const nextStats = {
          totalJoined:
            (data.totalWaiting ?? 0) + (data.totalInQuiz ?? 0) + (data.totalSubmitted ?? 0),
          activeNow: data.totalInQuiz ?? data.active ?? 0,
          inWaitingRoom: data.totalWaiting ?? data.waiting ?? 0,
          submitted: data.totalSubmitted ?? data.submitted ?? 0,
          flagged: data.totalFlagged ?? data.flagged ?? 0,
          totalViolations: data.totalViolations ?? 0,
        };
        statsRef.current = nextStats;

        if (data.participants) {
          const map = new Map<string, LiveParticipant>();
          data.participants.forEach((p: any) => {
            const mapped = mapBackendParticipant(p);
            map.set(mapped.participantId, mapped);
          });
          participantsRef.current = map;
        }

        // Set state immediately on first snapshot load
        setParticipants(Array.from(participantsRef.current.values()));
        setStats(nextStats);
        hasChangesRef.current = false;
      });

      // Participant joined the waiting room
      socket.on('admin:v1:participant_joined', (data: any) => {
        const mapped = mapBackendParticipant(data);
        if (!participantsRef.current.has(mapped.participantId)) {
          participantsRef.current.set(mapped.participantId, mapped);
          
          statsRef.current = {
            ...statsRef.current,
            inWaitingRoom: statsRef.current.inWaitingRoom + 1,
            totalJoined: statsRef.current.totalJoined + 1,
          };
          hasChangesRef.current = true;
        }
      });

      // Participant progress update
      socket.on('admin:v1:participant_progress', (data: any) => {
        const p = participantsRef.current.get(data.participantId);
        if (p) {
          participantsRef.current.set(data.participantId, {
            ...p,
            currentQuestion: (data.currentQuestionIndex ?? 0) + 1,
            answeredCount: data.answeredCount ?? p.answeredCount,
            estimatedScorePercent: Math.round(((data.answeredCount ?? p.answeredCount) / (p.totalQuestions || 1)) * 100),
            estimatedCorrect: data.answeredCount ?? p.answeredCount,
            lastActivityAt: data.timestamp || new Date().toISOString(),
          });
          hasChangesRef.current = true;
        }
      });

      // Participant submitted
      socket.on('admin:v1:participant_submitted', (data: any) => {
        const p = participantsRef.current.get(data.participantId);
        if (p) {
          const oldStatus = p.status;
          participantsRef.current.set(data.participantId, {
            ...p,
            status: 'submitted' as const,
            lastActivityAt: new Date().toISOString(),
          });

          let activeNow = statsRef.current.activeNow;
          let inWaitingRoom = statsRef.current.inWaitingRoom;
          if (oldStatus === 'active') activeNow = Math.max(0, activeNow - 1);
          if (oldStatus === 'waiting') inWaitingRoom = Math.max(0, inWaitingRoom - 1);

          statsRef.current = {
            ...statsRef.current,
            activeNow,
            inWaitingRoom,
            submitted: statsRef.current.submitted + 1,
          };
          hasChangesRef.current = true;
        }
        toast.info(`${data.name || 'A participant'} submitted their quiz`);
      });

      // Participant disconnected
      socket.on('admin:v1:participant_disconnected', (data: any) => {
        const p = participantsRef.current.get(data.participantId);
        if (p) {
          const oldStatus = p.status;
          participantsRef.current.set(data.participantId, {
            ...p,
            status: 'disconnected' as const,
            lastActivityAt: new Date().toISOString(),
          });

          let activeNow = statsRef.current.activeNow;
          let inWaitingRoom = statsRef.current.inWaitingRoom;
          if (oldStatus === 'active') activeNow = Math.max(0, activeNow - 1);
          if (oldStatus === 'waiting') inWaitingRoom = Math.max(0, inWaitingRoom - 1);

          statsRef.current = {
            ...statsRef.current,
            activeNow,
            inWaitingRoom,
          };
          hasChangesRef.current = true;
        }
      });

      // Violation alert
      socket.on('admin:v1:violation_alert', (data: any) => {
        const alert: ProctorAlert = {
          id: `${data.participantId}-${data.occurredAt || Date.now()}`,
          participantId: data.participantId,
          name: data.name || 'Participant',
          type: data.type || data.violation || 'UNKNOWN',
          severity: typeof data.severity === 'number' ? data.severity : 2,
          timestamp: data.occurredAt || data.timestamp || new Date().toISOString(),
        };
        violationsRef.current = [alert, ...violationsRef.current].slice(0, 50);

        const p = participantsRef.current.get(data.participantId);
        let statusChangedToFlagged = false;
        if (p) {
          const oldStatus = p.status;
          const isNowFlagged = !!data.isFlagged;
          statusChangedToFlagged = isNowFlagged && oldStatus !== 'flagged';

          participantsRef.current.set(data.participantId, {
            ...p,
            proctoringAlerts: data.violationCount ?? (p.proctoringAlerts || 0) + 1,
            isFlagged: isNowFlagged,
            status: isNowFlagged ? 'flagged' : p.status,
            lastActivityAt: data.timestamp || new Date().toISOString(),
          });

          if (statusChangedToFlagged) {
            let activeNow = statsRef.current.activeNow;
            let inWaitingRoom = statsRef.current.inWaitingRoom;
            let submitted = statsRef.current.submitted;
            if (oldStatus === 'active') activeNow = Math.max(0, activeNow - 1);
            if (oldStatus === 'waiting') inWaitingRoom = Math.max(0, inWaitingRoom - 1);
            if (oldStatus === 'submitted') submitted = Math.max(0, submitted - 1);

            statsRef.current = {
              ...statsRef.current,
              activeNow,
              inWaitingRoom,
              submitted,
              flagged: statsRef.current.flagged + 1,
              totalViolations: statsRef.current.totalViolations + 1,
            };
          } else {
            statsRef.current = {
              ...statsRef.current,
              totalViolations: statsRef.current.totalViolations + 1,
            };
          }
        } else {
          statsRef.current = {
            ...statsRef.current,
            totalViolations: statsRef.current.totalViolations + 1,
          };
        }

        hasChangesRef.current = true;
        if (onViolationRef.current) onViolationRef.current(data);
      });
    };

    connectWithToken();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [contestId, organizationId]);

  const updateStats = (data: any) => {
    const nextStats = {
      totalJoined:
        (data.totalWaiting ?? 0) + (data.totalInQuiz ?? 0) + (data.totalSubmitted ?? 0),
      activeNow: data.totalInQuiz ?? data.active ?? 0,
      inWaitingRoom: data.totalWaiting ?? data.waiting ?? 0,
      submitted: data.totalSubmitted ?? data.submitted ?? 0,
      flagged: data.totalFlagged ?? data.flagged ?? 0,
      totalViolations: data.totalViolations ?? 0,
    };
    statsRef.current = nextStats;
    hasChangesRef.current = true;
  };


  const mapBackendParticipant = (p: any): LiveParticipant => ({
    participantId: p.participantId,
    name: p.name || 'Anonymous',
    status: mapStatus(p.status),
    currentQuestion: (p.currentQuestionIndex ?? 0) + 1,
    totalQuestions: p.totalQuestions || 0,
    answeredCount: p.answeredCount || 0,
    timeRemainingSeconds: p.timeRemainingSeconds || 0,
    timeOnQuestion: p.timeOnQuestionSeconds || 0,
    estimatedScorePercent: Math.round(((p.answeredCount || 0) / (p.totalQuestions || 1)) * 100),
    estimatedCorrect: p.answeredCount || 0,
    proctoringAlerts: p.violationCount || 0,
    avatarInitials: (p.name || 'A').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    isFlagged: !!p.isFlagged,
    lastActivityAt: p.lastActivityAt || new Date().toISOString(),
  });

  const mapStatus = (status: string): LiveParticipant['status'] => {
    switch (status) {
      case 'IN_QUIZ': return 'active';
      case 'SUBMITTED': return 'submitted';
      case 'DISCONNECTED': return 'disconnected';
      case 'DISQUALIFIED': return 'flagged';
      case 'IN_WAITING':
      case 'CHECKED_IN':
      case 'WAITING': return 'waiting';
      default: return 'waiting';
    }
  };

  const sendBroadcast = useCallback((message: string, type: string, target: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('admin:v1:broadcast', {
        contestId,
        message,
        type: type.toUpperCase(),
        target: target.toUpperCase(),
      });
      const newMessage: BroadcastMessage = {
        id: Math.random().toString(36).slice(2),
        message,
        type: type as any,
        target: target as any,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [newMessage, ...prev]);
    }
  }, [contestId]);

  const forceSubmitParticipant = useCallback((participantId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('admin:v1:kick_participant', { contestId, participantId });
      toast.success('Participant kicked and forced to submit');
    }
  }, [contestId]);

  const getParticipantStats = useCallback(() => stats, [stats]);

  return {
    connected,
    participants,
    violations,
    messages,
    stats,
    sendBroadcast,
    getParticipantStats,
    forceSubmitParticipant,
  };
}
