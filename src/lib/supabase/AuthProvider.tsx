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
const ACTIVE_PROFILE_KEY = "almvagen_active_profile_id";

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

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setBaseProfile(data as Profile);
    } else {
      setBaseProfile(null);
    }

    try {
      const savedProfileId = window.localStorage.getItem(ACTIVE_PROFILE_KEY);
      if (savedProfileId && savedProfileId !== userId) {
        const { data: savedData, error: savedErr } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT_COLUMNS)
          .eq("id", savedProfileId)
          .maybeSingle();
        if (!savedErr && savedData) {
          setOverrideProfile(savedData as Profile);
        }
      }
    } catch {
      // Ignore storage errors
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
        await fetchProfile(nextSession.user.id);
      }
      if (mounted) {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
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
        await fetchProfile(nextSession.user.id);
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
    } catch {
      // Ignore
    }
    setBaseProfile(null);
    setOverrideProfile(null);
    setIsPinLocked(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
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
  }, [user?.id, overrideProfile?.id, fetchProfile]);

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
      setOverrideProfile(targetProfile.id === user?.id ? null : targetProfile);
      try {
        if (targetProfile.id === user?.id) {
          window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
        } else {
          window.localStorage.setItem(ACTIVE_PROFILE_KEY, targetProfile.id);
        }
      } catch {
        // Ignore
      }
      setIsPinLocked(false);
      return { error: null };
    },
    [user?.id],
  );

  const resetActiveProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
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
