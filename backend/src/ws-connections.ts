/**
 * ws-connections.ts
 *
 * Standalone WebSocket connection counter.
 * Kept in its own module so socket.ts can import it without pulling in app.ts,
 * which would create the circular dependency:
 *   worker.ts → container.ts → socket.ts → app.ts → container.ts (crash)
 *
 * socket.ts calls increment/decrement on each connect/disconnect.
 * app.ts /health reads getActiveWsConnections() for drain-mode detection.
 */

let activeWsConnections = 0;

export function incrementWsConnections(): void {
    activeWsConnections++;
}

export function decrementWsConnections(): void {
    if (activeWsConnections > 0) activeWsConnections--;
}

export function getActiveWsConnections(): number {
    return activeWsConnections;
}
