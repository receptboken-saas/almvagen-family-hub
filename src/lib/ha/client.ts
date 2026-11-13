import type { HAConnectionStatus, HAServiceCallPayload } from "./types";

/**
 * Home Assistant connection configuration.
 * Full WebSocket & REST implementation will be added in Sprint 1.2.
 */
export const HA_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_HA_URL ?? "https://almvagen.sidequestlabs.se",
  wsUrl:
    process.env.NEXT_PUBLIC_HA_WS_URL ??
    "wss://almvagen.sidequestlabs.se/api/websocket",
} as const;

export interface HAClientPlaceholder {
  status: HAConnectionStatus;
  callService: (payload: HAServiceCallPayload) => Promise<void>;
}

export function createPlaceholderHAClient(): HAClientPlaceholder {
  return {
    status: "disconnected",
    async callService() {
      throw new Error("Home Assistant client is not yet connected.");
    },
  };
}
