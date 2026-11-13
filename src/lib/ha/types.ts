/**
 * TypeScript types for Home Assistant WebSocket and REST API.
 */

export type HAConnectionStatus =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

export interface HassEntityAttributes {
  friendly_name?: string;
  unit_of_measurement?: string;
  icon?: string;
  device_class?: string;
  brightness?: number;
  color_temp?: number;
  [key: string]: unknown;
}

export interface HassEntity<TAttributes = HassEntityAttributes> {
  entity_id: string;
  state: string;
  attributes: TAttributes & HassEntityAttributes;
  last_changed: string;
  last_updated: string;
  context?: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

/** Backwards-compatible alias */
export type HAEntityState<TAttributes = HassEntityAttributes> =
  HassEntity<TAttributes>;

export type HassEntities = Record<string, HassEntity>;

export interface HAStateChangedEventData {
  entity_id: string;
  new_state: HassEntity | null;
  old_state: HassEntity | null;
}

export interface HAEventMessage {
  id: number;
  type: "event";
  event: {
    event_type: string;
    data: HAStateChangedEventData;
    origin: string;
    time_fired: string;
  };
}

export interface HAResultMessage<TResult = unknown> {
  id: number;
  type: "result";
  success: boolean;
  result?: TResult;
  error?: {
    code: string;
    message: string;
  };
}

export interface HAAuthRequiredMessage {
  type: "auth_required";
  ha_version: string;
}

export interface HAAuthOkMessage {
  type: "auth_ok";
  ha_version: string;
}

export interface HAAuthInvalidMessage {
  type: "auth_invalid";
  message: string;
}

export interface HAAuthRequestMessage {
  type: "auth";
  access_token: string;
}

export interface HASubscribeEventsMessage {
  id: number;
  type: "subscribe_events";
  event_type?: string;
}

export interface HAGetStatesMessage {
  id: number;
  type: "get_states";
}

export interface HACallServiceMessage {
  id: number;
  type: "call_service";
  domain: string;
  service: string;
  service_data?: Record<string, unknown>;
  target?: {
    entity_id?: string | string[];
    area_id?: string | string[];
  };
}

export type HAIncomingMessage =
  | HAAuthRequiredMessage
  | HAAuthOkMessage
  | HAAuthInvalidMessage
  | HAEventMessage
  | HAResultMessage
  | { id?: number; type: string; [key: string]: unknown };

export type HAOutgoingMessage =
  | HAAuthRequestMessage
  | HASubscribeEventsMessage
  | HAGetStatesMessage
  | HACallServiceMessage;

export interface HAServiceCallPayload {
  domain: string;
  service: string;
  service_data?: Record<string, unknown>;
  target?: {
    entity_id?: string | string[];
    area_id?: string | string[];
  };
}

export interface HAConnectionConfig {
  wsUrl: string;
  token: string;
}
