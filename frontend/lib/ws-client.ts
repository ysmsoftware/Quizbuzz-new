import { io, type Socket } from 'socket.io-client';

// ============================================
// Socket.io Client Singleton
// ============================================

let socket: Socket | null = null;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

/**
 * Get or create the singleton Socket.io client.
 * autoConnect is false — call connectSocket() to actually connect.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.3,
      timeout: 10000,
      transports: ['websocket'], // skip long-polling for performance
    });
  }
  return socket;
}

/**
 * Set auth token and connect (if not already connected).
 */
export function connectSocket(token: string): void {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
}

/**
 * Disconnect the socket.
 */
export function disconnectSocket(): void {
  socket?.disconnect();
}

/**
 * Get a stable device ID (persisted in localStorage).
 * Used to identify this browser instance for session conflict detection.
 */
export function getDeviceId(): string {
  const key = 'qc-device-id';
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
