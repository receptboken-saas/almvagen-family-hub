"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./client";
import { PROFILE_SELECT_COLUMNS, type Profile } from "./types";

const TRUSTED_DEVICE_KEY = "almvagen_trusted_device";
export const ACTIVE_PROFILE_KEY = "almvagen_active_profile_id";
const LEGACY_ACTIVE_PROFILE_KEY = "active_profile_id";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  isPinLocked: boolean;
  isTrustedDevice: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  lockWithPin: () => void;
  unlockWithPin: (pin: string) => Promise<{ error: string | null }>;
  switchProfile: (
    targetProfile: Profile,
    pin?: string,
  ) => Promise<{ error: string | null }>;
  resetActiveProfile: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [baseProfile, setBaseProfile] = useState<Profile | null>(null);
  const [overrideProfile, setOverrideProfile] = useState<Profile | null>(null);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [isTrustedDevice, setIsTrustedDevice] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(configured);

  const fetchProfile = useCallback(async (authUser: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const isPinSession = Boolean(
      authUser.email?.toLowerCase().endsWith("@family.almvagen.local"),
    );
    const metaProfileId =
      typeof authUser.user_metadata?.profile_id === "string"
        ? authUser.user_metadata.profile_id
        : null;

    let savedProfileId: string | null = null;
    try {
      savedProfileId =
        window.localStorage.getItem(ACTIVE_PROFILE_KEY) ??
        window.localStorage.getItem(LEGACY_ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore storage errors
    }

    const targetBaseId =
      (isPinSession && metaProfileId) || savedProfileId || authUser.id;

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .eq("id", targetBaseId)
      .maybeSingle();

    if (!error && data) {
      setBaseProfile(data as Profile);
    } else if (targetBaseId !== authUser.id) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", authUser.id)
        .maybeSingle();
      setBaseProfile(
        !fallbackErr && fallbackData ? (fallbackData as Profile) : null,
      );
    } else {
      setBaseProfile(null);
    }

    if (savedProfileId && savedProfileId !== targetBaseId) {
      const { data: savedData, error: savedErr } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("id", savedProfileId)
        .maybeSingle();
      if (!savedErr && savedData) {
        setOverrideProfile(savedData as Profile);
      } else {
        setOverrideProfile(null);
      }
    } else {
      setOverrideProfile(null);
    }
  }, []);

  useEffect(() => {
    try {
      setIsTrustedDevice(
        window.localStorage.getItem(TRUSTED_DEVICE_KEY) === "true",
      );
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const nextSession = data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        try {
          window.localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
          setIsTrustedDevice(true);
        } catch {
          // Ignore
        }
        await fetchProfile(nextSession.user);
      }
      if (mounted) {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        try {
          window.localStorage.setItem(TRUSTED_DEVICE_KEY, "true");
          setIsTrustedDevice(true);
        } catch {
          // Ignore
        }
        if (event === "SIGNED_IN") {
          setIsPinLocked(false);
        }
        await fetchProfile(nextSession.user);
      } else {
        setBaseProfile(null);
        setOverrideProfile(null);
        setIsPinLocked(false);
      }
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { error: "Supabase är inte konfigurerat i miljövariablerna." };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }
      setIsPinLocked(false);
      setOverrideProfile(null);
      try {
        window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
        window.localStorage.removeItem(LEGACY_ACTIVE_PROFILE_KEY);
      } catch {
        // Ignore
      }
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    try {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
      window.localStorage.removeItem(LEGACY_ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore
    }
    setBaseProfile(null);
    setOverrideProfile(null);
    setIsPinLocked(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
    if (overrideProfile?.id) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT_COLUMNS)
          .eq("id", overrideProfile.id)
          .maybeSingle();
        if (data) {
          setOverrideProfile(data as Profile);
        }
      }
    }
  }, [user, overrideProfile?.id, fetchProfile]);

  const lockWithPin = useCallback(() => {
    if (user) {
      setIsPinLocked(true);
    }
  }, [user]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<{ error: string | null }> => {
      const cleanPin = pin.trim();
      if (cleanPin.length !== 4) {
        return { error: "Ange en 4-siffrig PIN-kod." };
      }

      const supabase = getSupabaseClient();
      if (!supabase || !user) {
        return {
          error:
            "Ingen aktiv familjesession. Logga in med e-post och lösenord första gången.",
        };
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_COLUMNS)
        .eq("quick_pin", cleanPin)
        .limit(1)
        .maybeSingle();

      if (error) {
        return { error: error.message };
      }
      if (!data) {
        return { error: "Felaktig PIN-kod. Försök igen." };
      }

      const nextProfile = data as Profile;
      setOverrideProfile(nextProfile);
      try {
        window.localStorage.setItem(ACTIVE_PROFILE_KEY, nextProfile.id);
      } catch {
        // Ignore
      }
      setIsPinLocked(false);
      return { error: null };
    },
    [user],
  );

  const switchProfile = useCallback(
    async (
      targetProfile: Profile,
      pin?: string,
    ): Promise<{ error: string | null }> => {
      if (targetProfile.quick_pin) {
        const cleanPin = (pin ?? "").trim();
        if (cleanPin !== targetProfile.quick_pin) {
          return { error: "Felaktig PIN-kod för denna profil." };
        }
      }
      const baseId = baseProfile?.id ?? user?.id;
      const isBase = targetProfile.id === baseId;
      setOverrideProfile(isBase ? null : targetProfile);
      try {
        if (isBase) {
          window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
          window.localStorage.removeItem(LEGACY_ACTIVE_PROFILE_KEY);
        } else {
          window.localStorage.setItem(ACTIVE_PROFILE_KEY, targetProfile.id);
          window.localStorage.setItem(LEGACY_ACTIVE_PROFILE_KEY, targetProfile.id);
        }
      } catch {
        // Ignore
      }
      setIsPinLocked(false);
      return { error: null };
    },
    [baseProfile?.id, user?.id],
  );

  const resetActiveProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
      window.localStorage.removeItem(LEGACY_ACTIVE_PROFILE_KEY);
    } catch {
      // Ignore
    }
    setOverrideProfile(null);
    setIsPinLocked(false);
  }, []);

  const activeProfile = overrideProfile ?? baseProfile;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile: activeProfile,
      isAdmin: activeProfile?.role === "admin",
      isLoading,
      isConfigured: configured,
      isPinLocked,
      isTrustedDevice,
      signIn,
      signOut,
      refreshProfile,
      lockWithPin,
      unlockWithPin,
      switchProfile,
      resetActiveProfile,
    }),
    [
      session,
      user,
      activeProfile,
      isLoading,
      configured,
      isPinLocked,
      isTrustedDevice,
      signIn,
      signOut,
      refreshProfile,
      lockWithPin,
      unlockWithPin,
      switchProfile,
      resetActiveProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
