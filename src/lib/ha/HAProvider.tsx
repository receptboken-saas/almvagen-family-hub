"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AuthContext } from "@/lib/supabase/AuthProvider";
import type { HAConnectionStatus, HassEntities, HassEntity } from "./types";
import {
  clearLegacyLocalHaConfig,
  haWsClient,
  readLegacyLocalHaConfig,
  type HAWebSocketSnapshot,
} from "./wsClient";
import {
  clearCloudHaConfig,
  fetchCloudHaConfig,
  saveCloudHaConfig,
} from "./haCloudConfig";

export interface HAContextValue {
  status: HAConnectionStatus;
  isConnected: boolean;
  error: string | null;
  entities: HassEntities;
  wsUrl: string;
  hasToken: boolean;
  isLoadingConfig: boolean;
  getEntity: (entityId: string) => HassEntity | undefined;
  callService: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<unknown>;
  sendCommand: <T = unknown>(
    type: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>;
  connectWithConfig: (
    wsUrl: string,
    token: string,
  ) => Promise<{ error: string | null }>;
  disconnect: () => void;
  clearConfig: () => Promise<{ error: string | null }>;
}

export const HAContext = createContext<HAContextValue | null>(null);

export function HAProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext);
  const session = auth?.session ?? null;
  const authLoading = auth?.isLoading ?? false;

  const [snapshot, setSnapshot] = useState<HAWebSocketSnapshot>(() =>
    haWsClient.getSnapshot(),
  );
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  useEffect(() => {
    return haWsClient.subscribe(setSnapshot);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      haWsClient.clearConfig();
      return;
    }

    let cancelled = false;
    setIsLoadingConfig(true);

    void (async () => {
      try {
        const cloudConfig = await fetchCloudHaConfig();
        if (cancelled) return;

        if (cloudConfig) {
          clearLegacyLocalHaConfig();
          haWsClient.setConfig(cloudConfig.wsUrl, cloudConfig.token);
          haWsClient.connect();
          return;
        }

        // One-time migration from legacy localStorage if present
        const legacy = readLegacyLocalHaConfig();
        if (legacy) {
          haWsClient.setConfig(legacy.wsUrl, legacy.token);
          haWsClient.connect();
          const { error: saveErr } = await saveCloudHaConfig(
            legacy.wsUrl,
            legacy.token,
          );
          if (!saveErr) {
            clearLegacyLocalHaConfig();
          }
          return;
        }

        if (haWsClient.getSnapshot().hasToken) {
          haWsClient.connect();
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, authLoading]);

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

  const sendCommand = useCallback(
    <T = unknown,>(type: string, payload?: Record<string, unknown>) =>
      haWsClient.sendCommand<T>(type, payload),
    [],
  );

  const connectWithConfig = useCallback(
    async (wsUrl: string, token: string): Promise<{ error: string | null }> => {
      haWsClient.disconnect();
      haWsClient.setConfig(wsUrl, token);
      haWsClient.connect();
      return await saveCloudHaConfig(wsUrl, token);
    },
    [],
  );

  const disconnect = useCallback(() => {
    haWsClient.disconnect();
  }, []);

  const clearConfig = useCallback(async (): Promise<{ error: string | null }> => {
    haWsClient.clearConfig();
    return await clearCloudHaConfig();
  }, []);

  const value = useMemo<HAContextValue>(
    () => ({
      status: snapshot.status,
      isConnected: snapshot.status === "connected",
      error: snapshot.error,
      entities: snapshot.entities,
      wsUrl: snapshot.wsUrl,
      hasToken: snapshot.hasToken,
      isLoadingConfig,
      getEntity,
      callService,
      sendCommand,
      connectWithConfig,
      disconnect,
      clearConfig,
    }),
    [
      snapshot,
      isLoadingConfig,
      getEntity,
      callService,
      sendCommand,
      connectWithConfig,
      disconnect,
      clearConfig,
    ],
  );

  return <HAContext.Provider value={value}>{children}</HAContext.Provider>;
}
