// ============================================================
// MPloyChek v4.0 — WebSocket Notification Bus Unit Tests
// Pure in-memory client registry — no real sockets needed.
// ============================================================
import { registerClient, removeClient, notifyUser, connectedCount } from './ws-notify';

// Minimal fake WebSocket: readyState 1 === OPEN
const fakeWs = () => ({ readyState: 1, send: jest.fn(), close: jest.fn() });

describe('ws-notify registry', () => {
  afterEach(() => {
    // Drain the module-level registry between tests
    for (let i = 0; i < 50; i++) removeClient(`u${i}`, undefined);
  });

  it('registers a client and reports the connected count', () => {
    const before = connectedCount();
    registerClient('u1', fakeWs());
    expect(connectedCount()).toBe(before + 1);
  });

  it('closes (dedups) an existing open socket when the same user reconnects', () => {
    const first = fakeWs();
    registerClient('u2', first);
    const second = fakeWs();
    registerClient('u2', second);
    expect(first.close).toHaveBeenCalledWith(4409, 'Replaced by new connection');
  });

  it('notifyUser sends a JSON frame to an open socket', () => {
    const ws = fakeWs();
    registerClient('u3', ws);
    notifyUser('u3', { type: 'notification', message: 'hi' });
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'notification', message: 'hi' }));
  });

  it('notifyUser is a no-op for an unknown user', () => {
    expect(() => notifyUser('nobody', { type: 'x' })).not.toThrow();
  });

  it('notifyUser does not send to a non-open socket', () => {
    const ws = { readyState: 3, send: jest.fn(), close: jest.fn() }; // CLOSED
    registerClient('u4', ws);
    notifyUser('u4', { type: 'x' });
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('removeClient only deletes when the socket matches (dedup guard)', () => {
    const ws = fakeWs();
    registerClient('u5', ws);
    const count = connectedCount();
    removeClient('u5', fakeWs());  // different socket — must NOT remove
    expect(connectedCount()).toBe(count);
    removeClient('u5', ws);        // same socket — removes
    expect(connectedCount()).toBe(count - 1);
  });
});
