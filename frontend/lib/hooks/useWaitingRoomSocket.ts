'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Specialized hook for the waiting room state.
 * Connects to the waiting room namespace/room to receive start updates.
 */
export function useWaitingRoomSocket(contestId: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'starting' | 'error'>('connecting');
  const [timeToStart, setTimeToStart] = useState<number | null>(null);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!contestId) return;

    // Use the WS URL from env or fallback
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.quizbuzz.com';
    
    const socket = io(`${wsUrl}/waiting-room`, {
      path: '/socket.io',
      query: { contestId },
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
      setStatus('connected');
      console.log('Connected to waiting room:', contestId);
    });

    socket.on('room:update', (data: { participantCount: number; timeToStart?: number }) => {
      setParticipantCount(data.participantCount);
      if (data.timeToStart !== undefined) {
        setTimeToStart(data.timeToStart);
      }
    });

    socket.on('room:quiz_starting', () => {
      setStatus('starting');
    });

    socket.on('connect_error', (err) => {
      console.error('Waiting room connection error:', err);
      setStatus('error');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [contestId]);

  return {
    status,
    timeToStart,
    participantCount,
    socket: socketRef.current
  };
}
