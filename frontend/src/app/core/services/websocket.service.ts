// ============================================================
// MPloyChek v4.0 — WebSocket Service
// Author: Mohit Sharma
// ============================================================
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '@environments/environment';

export interface WsMessage { type: string; payload?: any; message?: string; }

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = new BehaviorSubject<boolean>(false);
  private message   = new Subject<WsMessage>();

  connected$ = this.connected.asObservable();
  message$   = this.message.asObservable();

  constructor(private zone: NgZone) {}

  /**
   * Connect using the current JWT access token.
   * The server validates the token and rejects spoofed connections.
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    // FIX HIGH-3: wsUrl from environment (works in prod without code changes)
    // FIX CRITICAL-2: token in query param, not userId
    const wsUrl = `${environment.wsUrl}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => this.zone.run(() => {
        this.connected.next(true);
        // Connected — no console.log in production (avoid leaking WS internals)
      });

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          // Respond to server heartbeat ping with a pong so the connection stays alive.
          // The browser WebSocket API does NOT respond to binary-level ping frames, so
          // we use application-level JSON messages instead.
          if (msg.type === 'ping') {
            this.ws?.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          this.zone.run(() => this.message.next(msg));
        } catch { /* malformed frame — ignore */ }
      };

      this.ws.onclose = (ev) => this.zone.run(() => {
        this.connected.next(false);
        // 4401 = auth failure — do not reconnect, token may be expired
        if (ev.code === 4401) {
          console.warn('WS closed: authentication failure. Will not reconnect.');
          return;
        }
        this.scheduleReconnect(token);
      });

      this.ws.onerror = () => this.zone.run(() => { this.connected.next(false); });

    } catch {
      this.connected.next(false);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.connected.next(false);
  }

  private scheduleReconnect(token: string): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(token), 5000);
  }
}
