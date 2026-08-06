'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface BroadcastMessage {
  type: 'info' | 'warning' | 'urgent';
  text: string;
}

type WaitingStatus =
  | 'connecting'
  | 'connected'
  | 'starting'
  | 'submitted'
  | 'disqualified'
  | 'error';

/**
 * Waiting room WebSocket — namespace `/participant`, auth via participant session JWT.
 *
 * KEY INVARIANT: the socket is destroyed immediately when we transition to
 * 'starting' / 'submitted' / 'disqualified'. This prevents the waiting-room
 * socket from reconnecting after the user navigates to /play, which would create
 * a second concurrent /participant connection and cause the play-page socket to
 * bounce in an infinite connect → server-kick → reconnect loop.
 */
export function useWaitingRoomSocket(
  contestId: string,
  participantId?: string,
  sessionToken?: string,
  options?: {
    onQuizStart?: () => void;
    onUnauthorized?: () => void;
  },
) {
  const [status, setStatus] = useState<WaitingStatus>('connecting');
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [broadcastMessage, setBroadcastMessage] = useState<BroadcastMessage | null>(null);
  // Set only when an admin reschedules while this participant is already waiting.
  // The page's countdown prefers this over the startTime it fetched on mount.
  const [contestStartTime, setContestStartTime] = useState<Date | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [cancellation, setCancellation] = useState<{ reason: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Stable kill — disconnect and prevent any reconnect
  const killSocket = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    s.io.opts.reconnection = false; // disable before disconnect to stop retries
    s.disconnect();
    socketRef.current = null;
  }, []);

  useEffect(() => {
    if (!contestId || !sessionToken) {
      setStatus('error');
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5000';

    const socket = io(`${wsUrl}/participant`, {
      path: '/socket.io',
      auth: { token: sessionToken },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10_000,
    });

    socketRef.current = socket;

    // ── Terminal state helper ─────────────────────────────────────────────────────
    // Calling this kills the socket immediately so it CANNOT reconnect and
    // interfere with the play-page socket that is about to mount.
    const enterTerminal = (next: WaitingStatus) => {
      killSocket();
      setStatus(next);
      if (next === 'starting') optionsRef.current?.onQuizStart?.();
    };

    socket.on('quiz:v1:waiting_room_status', (data: { participantCount: number; status: string }) => {
      if (data && typeof data.participantCount === 'number') {
        setParticipantCount(data.participantCount);
      }
      if (data?.status === 'IN_QUIZ') {
        // Already in quiz (e.g. page refreshed on /waiting after quiz started)
        enterTerminal('starting');
      } else if (data?.status === 'SUBMITTED') {
        enterTerminal('submitted');
      } else if (data?.status === 'DISQUALIFIED') {
        enterTerminal('disqualified');
      }
    });

    socket.on('quiz:v1:start', (payload: unknown) => {
      if (payload && typeof payload === 'object') {
        try { sessionStorage.setItem('quizStartPayload', JSON.stringify(payload)); } catch { /* quota */ }
      }
      enterTerminal('starting');
    });

    socket.on('quiz:v1:broadcast', (msg: BroadcastMessage) => {
      setBroadcastMessage(msg);
    });

    // ── Schedule moved while we're sitting here ───────────────────────────────
    // Without this the countdown keeps running to the startTime fetched on mount,
    // hits zero, polls for a LIVE status that never comes, and strands the
    // participant on 00:00:00 with no explanation.
    socket.on(
      'quiz:v1:rescheduled',
      (data: { startTime: string; endTime: string; reason?: string; serverTime?: string }) => {
        const next = new Date(data.startTime);
        if (Number.isNaN(next.getTime())) return;

        setContestStartTime(next);
        if (data.serverTime) setServerTime(data.serverTime);

        const when = next.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        setBroadcastMessage({
          type: 'warning',
          text: data.reason
            ? `Contest rescheduled to ${when} — ${data.reason}`
            : `Contest rescheduled to ${when}`,
        });
      },
    );

    socket.on('quiz:v1:cancelled', (data: { reason: string }) => {
      setCancellation({ reason: data.reason });
      setBroadcastMessage({
        type: 'urgent',
        text: `This contest has been cancelled — ${data.reason}`,
      });
    });

    socket.on('connect', () => {
      setStatus('connected');
      if (participantId) {
        socket.emit('quiz:v1:join', { participantId });
      }
    });

    socket.io.on('reconnect_attempt', () => {
      setStatus('connecting');
    });

    socket.on('disconnect', (reason) => {
      // Don't reset if we intentionally killed it (socket is already null)
      if (!socketRef.current) return;
      if (reason === 'io server disconnect') {
        setStatus('error');
      } else {
        setStatus('connecting');
      }
    });

    socket.on('connect_error', (err) => {
      const msg = err.message?.toLowerCase() ?? '';
      if (msg.includes('unauthorized') || msg.includes('authentication')) {
        setStatus('error');
        optionsRef.current?.onUnauthorized?.();
        killSocket();
        return;
      }
      if (!socket.active) setStatus('error');
      else setStatus('connecting');
    });

    return () => {
      // Cleanup on unmount — killSocket is idempotent (no-ops if already called)
      killSocket();
    };
  }, [contestId, participantId, sessionToken, killSocket]);

  const clearBroadcast = useCallback(() => setBroadcastMessage(null), []);

  return {
    wsStatus: status,
    participantCount,
    broadcastMessage,
    clearBroadcast,
    showStartingOverlay: status === 'starting',
    /** Revised start time pushed by an admin reschedule; null until that happens. */
    contestStartTime,
    /** Server clock from the reschedule event, so the page can re-anchor its offset. */
    rescheduledServerTime: serverTime,
    /** Set when the contest is cancelled out from under the waiting participant. */
    cancellation,
    socket: socketRef.current,
  };
}
