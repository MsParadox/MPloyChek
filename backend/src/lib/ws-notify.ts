// ============================================================
// MPloyChek v4.0 — WebSocket Notification Bus
// Extracted from index.ts to break the circular dependency:
//   index.ts → records.routes.ts → index.ts  (was circular)
//   index.ts → ws-notify.ts ← records.routes.ts  (fixed)
//
// index.ts calls registerClient() when a WS connection opens.
// Any route module calls notifyUser() to push an event.
// Tests mock only this tiny module — no server bootstrap needed.
// Author: Mohit Sharma
// ============================================================

// Map<userDbId (JWT sub), WebSocket>
const clients = new Map<string, any>();

/** Called by index.ts when a verified WS connection is established.
 *  Closes any existing connection for the same user (dedup). */
export function registerClient(userDbId: string, ws: any): void {
  const existing = clients.get(userDbId);
  if (existing && existing.readyState === 1) {
    existing.close(4409, 'Replaced by new connection');
  }
  clients.set(userDbId, ws);
}

/** Called by index.ts when a WS connection closes. */
export function removeClient(userDbId: string, ws: any): void {
  // Only remove if it's still the same socket (dedup guard)
  if (clients.get(userDbId) === ws) clients.delete(userDbId);
}

/** Called by route handlers to push a real-time event to a user. */
export function notifyUser(userDbId: string, payload: object): void {
  const ws = clients.get(userDbId);
  // WS_OPEN = 1
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

/** Returns connected client count — used by health endpoint. */
export function connectedCount(): number {
  return clients.size;
}
