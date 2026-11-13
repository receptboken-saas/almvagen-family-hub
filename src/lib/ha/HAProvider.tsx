"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HAConnectionStatus, HassEntities, HassEntity } from "./types";
import { haWsClient, type HAWebSocketSnapshot } from "./wsClient";

export interface HAContextValue {
  status: HAConnectionStatus;
  isConnected: boolean;
  error: string | null;
  entities: HassEntities;
  wsUrl: string;
  hasToken: boolean;
  getEntity: (entityId: string) => HassEntity | undefined;
  callService: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<unknown>;
  connectWithConfig: (wsUrl: string, token: string) => void;
  disconnect: () => void;
  clearConfig: () => void;
}

export const HAContext = createContext<HAContextValue | null>(null);

export function HAProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<HAWebSocketSnapshot>(() =>
    haWsClient.getSnapshot(),
  );

  useEffect(() => {
    const unsubscribe = haWsClient.subscribe(setSnapshot);
    if (haWsClient.getSnapshot().hasToken) {
      haWsClient.connect();
    }
    return unsubscribe;
  }, []);

  const getEntity = useCallback(
    (entityId: string) => snapshot.entities[entityId],
    [snapshot.entities],
  );

  const callService = useCallback(
    (
      domain: string,
      service: string,
      serviceData?: Record<string, unknown>,
    ) => haWsClient.callService(domain, service, serviceData),
    [],
  );

  const connectWithConfig = useCallback((wsUrl: string, token: string) => {
    haWsClient.disconnect();
    haWsClient.setConfig(wsUrl, token, true);
    haWsClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    haWsClient.disconnect();
  }, []);

  const clearConfig = useCallback(() => {
    haWsClient.clearStoredConfig();
  }, []);

  const value = useMemo<HAContextValue>(
    () => ({
      status: snapshot.status,
      isConnected: snapshot.status === "connected",
      error: snapshot.error,
      entities: snapshot.entities,
      wsUrl: snapshot.wsUrl,
      hasToken: snapshot.hasToken,
      getEntity,
      callService,
      connectWithConfig,
      disconnect,
      clearConfig,
    }),
    [
      snapshot,
      getEntity,
      callService,
      connectWithConfig,
      disconnect,
      clearConfig,
    ],
  );

  return <HAContext.Provider value={value}>{children}</HAContext.Provider>;
}
