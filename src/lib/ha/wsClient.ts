import type {
  HAConnectionConfig,
  HAConnectionStatus,
  HAIncomingMessage,
  HAResultMessage,
  HassEntities,
  HassEntity,
} from "./types";

const STORAGE_KEY = "almvagen_ha_config";

export const DEFAULT_HA_WS_URL =
  process.env.NEXT_PUBLIC_HA_WS_URL ??
  "wss://almvagen.sidequestlabs.se/api/websocket";

const ENV_HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN ?? "";

export interface HAWebSocketSnapshot {
  status: HAConnectionStatus;
  error: string | null;
  entities: HassEntities;
  wsUrl: string;
  hasToken: boolean;
}

type SnapshotListener = (snapshot: HAWebSocketSnapshot) => void;

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

/**
 * Singleton WebSocket manager for Home Assistant.
 * Handles authentication, initial state fetch, real-time state_changed events,
 * exponential backoff reconnection, and service calls.
 */
class HAWebSocketClient {
  private socket: WebSocket | null = null;
  private status: HAConnectionStatus = "disconnected";
  private error: string | null = null;
  private entities: HassEntities = {};
  private wsUrl: string = DEFAULT_HA_WS_URL;
  private token: string = ENV_HA_TOKEN;

  private messageId = 1;
  private getStatesRequestId: number | null = null;
  private pendingCommands = new Map<number, PendingCommand>();
  private listeners = new Set<SnapshotListener>();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualDisconnect = false;
  private initializedFromStorage = false;

  constructor() {
    this.loadStoredConfig();
  }

  private loadStoredConfig(): void {
    if (this.initializedFromStorage || typeof window === "undefined") {
      return;
    }
    this.initializedFromStorage = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<HAConnectionConfig>;
        if (parsed.wsUrl) this.wsUrl = parsed.wsUrl;
        if (parsed.token) this.token = parsed.token;
      }
    } catch {
      // Ignore malformed storage entries
    }
  }

  public getSnapshot(): HAWebSocketSnapshot {
    this.loadStoredConfig();
    return {
      status: this.status,
      error: this.error,
      entities: this.entities,
      wsUrl: this.wsUrl,
      hasToken: Boolean(this.token.trim()),
    };
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  public setConfig(wsUrl: string, token: string, persist = true): void {
    const cleanUrl = wsUrl.trim() || DEFAULT_HA_WS_URL;
    const cleanToken = token.trim();
    this.wsUrl = cleanUrl;
    this.token = cleanToken;

    if (persist && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ wsUrl: cleanUrl, token: cleanToken }),
        );
      } catch {
        // Ignore storage quota errors
      }
    }
    this.notify();
  }

  public clearStoredConfig(): void {
    this.token = ENV_HA_TOKEN;
    this.wsUrl = DEFAULT_HA_WS_URL;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
    this.disconnect();
  }

  public connect(): void {
    this.loadStoredConfig();

    if (typeof window === "undefined") return;
    if (!this.token.trim()) {
      this.status = "disconnected";
      this.error = null;
      this.notify();
      return;
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.clearReconnectTimer();
    this.manualDisconnect = false;
    this.error = null;
    this.status = "connecting";
    this.notify();

    try {
      const ws = new WebSocket(this.wsUrl);
      this.socket = ws;

      ws.onopen = () => {
        // Wait for HA auth_required frame
      };

      ws.onmessage = (event) => {
        this.handleRawMessage(String(event.data));
      };

      ws.onerror = () => {
        this.error = "Kunde inte ansluta till Home Assistant WebSocket.";
        this.status = "error";
        this.notify();
      };

      ws.onclose = () => {
        this.socket = null;
        this.rejectAllPending(new Error("WebSocket-anslutningen stängdes."));

        if (!this.manualDisconnect && this.token.trim()) {
          this.status = this.error ? "error" : "disconnected";
          this.notify();
          this.scheduleReconnect();
        } else {
          this.status = "disconnected";
          this.notify();
        }
      };
    } catch (err) {
      this.socket = null;
      this.status = "error";
      this.error =
        err instanceof Error ? err.message : "Ogiltig WebSocket-URL.";
      this.notify();
    }
  }

  public disconnect(): void {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.rejectAllPending(new Error("Frånkopplad från Home Assistant."));
    this.status = "disconnected";
    this.error = null;
    this.notify();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delayMs = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts += 1;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  private nextId(): number {
    this.messageId += 1;
    return this.messageId;
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket är inte öppen.");
    }
    this.socket.send(JSON.stringify(payload));
  }

  private handleRawMessage(raw: string): void {
    let msg: HAIncomingMessage;
    try {
      msg = JSON.parse(raw) as HAIncomingMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "auth_required": {
        this.status = "authenticating";
        this.notify();
        this.sendJson({
          type: "auth",
          access_token: this.token,
        });
        break;
      }

      case "auth_ok": {
        this.reconnectAttempts = 0;
        this.status = "connected";
        this.error = null;
        this.notify();
        this.fetchInitialStatesAndSubscribe();
        break;
      }

      case "auth_invalid": {
        this.manualDisconnect = true;
        this.status = "error";
        this.error =
          typeof msg.message === "string"
            ? `Autentisering misslyckades: ${msg.message}`
            : "Ogiltig Home Assistant-token.";
        this.notify();
        this.socket?.close();
        break;
      }

      case "result": {
        this.handleResultMessage(msg as HAResultMessage);
        break;
      }

      case "event": {
        const eventMsg = msg as {
          event?: {
            event_type?: string;
            data?: { entity_id?: string; new_state?: HassEntity | null };
          };
        };
        if (
          eventMsg.event?.event_type === "state_changed" &&
          eventMsg.event.data?.entity_id
        ) {
          const { entity_id, new_state } = eventMsg.event.data;
          if (new_state) {
            this.entities = {
              ...this.entities,
              [entity_id]: new_state,
            };
          } else {
            const next = { ...this.entities };
            delete next[entity_id];
            this.entities = next;
          }
          this.notify();
        }
        break;
      }
    }
  }

  private fetchInitialStatesAndSubscribe(): void {
    const statesId = this.nextId();
    this.getStatesRequestId = statesId;
    this.sendJson({
      id: statesId,
      type: "get_states",
    });

    const subId = this.nextId();
    this.sendJson({
      id: subId,
      type: "subscribe_events",
      event_type: "state_changed",
    });
  }

  private handleResultMessage(msg: HAResultMessage): void {
    if (msg.id === this.getStatesRequestId) {
      this.getStatesRequestId = null;
      if (msg.success && Array.isArray(msg.result)) {
        const nextEntities: HassEntities = {};
        for (const entity of msg.result as HassEntity[]) {
          if (entity?.entity_id) {
            nextEntities[entity.entity_id] = entity;
          }
        }
        this.entities = nextEntities;
        this.notify();
      }
      return;
    }

    const pending = this.pendingCommands.get(msg.id);
    if (!pending) return;
    this.pendingCommands.delete(msg.id);

    if (msg.success) {
      pending.resolve(msg.result);
    } else {
      pending.reject(
        new Error(msg.error?.message ?? "Home Assistant service call failed."),
      );
    }
  }

  private rejectAllPending(err: Error): void {
    for (const pending of this.pendingCommands.values()) {
      pending.reject(err);
    }
    this.pendingCommands.clear();
  }

  public callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.status !== "connected" || !this.socket) {
      return Promise.reject(
        new Error("Inte ansluten till Home Assistant."),
      );
    }

    const id = this.nextId();
    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      try {
        this.sendJson({
          id,
          type: "call_service",
          domain,
          service,
          ...(serviceData ? { service_data: serviceData } : {}),
        });
      } catch (err) {
        this.pendingCommands.delete(id);
        reject(err);
      }
    });
  }
}

export const haWsClient = new HAWebSocketClient();
