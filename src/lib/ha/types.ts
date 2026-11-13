/**
 * TypeScript types for Home Assistant WebSocket and REST API.
 */

export type HAConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

export interface HAEntityState<TAttributes = Record<string, unknown>> {
  entity_id: string;
  state: string;
  attributes: TAttributes & {
    friendly_name?: string;
    unit_of_measurement?: string;
    icon?: string;
    device_class?: string;
  };
  last_changed: string;
  last_updated: string;
}

export interface HAWebSocketMessage {
  id?: number;
  type: string;
  [key: string]: unknown;
}

export interface HAServiceCallPayload {
  domain: string;
  service: string;
  service_data?: Record<string, unknown>;
  target?: {
    entity_id?: string | string[];
    area_id?: string | string[];
  };
}
