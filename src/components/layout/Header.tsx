"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Profile, Property } from "@/lib/supabase/types";
import { useHomeAssistant } from "@/lib/ha/useHomeAssistant";
import { ThemeToggle } from "@/components/ui/ThemeProvider";
import { AvatarBadge } from "@/components/ui/AvatarBadge";
import { HAConfigModal } from "@/components/ui/HAConfigModal";
import { ProfileQuickMenu } from "@/components/layout/ProfileQuickMenu";

interface HeaderProps {
  propertyName: string;
  profile: Profile | null;
  userEmail?: string | null;
  isAdmin: boolean;
  properties: Property[];
  selectedPropertyId: string | null;
  onSelectProperty: (propertyId: string) => void;
  onOpenSwitcher: () => void;
  onOpenProfileSetup: () => void;
  onOpenAdmin: () => void;
  onSignOut: () => Promise<void> | void;
}

/**
 * Minimalist single-row top header (~56-64px) with property title + discreet HA dot on the left
 * and two right-hand anchors: compact theme toggle + profile pill opening ProfileQuickMenu.
 */
export function Header({
  propertyName,
  profile,
  userEmail,
  isAdmin,
  properties,
  selectedPropertyId,
  onSelectProperty,
  onOpenSwitcher,
  onOpenProfileSetup,
  onOpenAdmin,
  onSignOut,
}: HeaderProps) {
  const { status } = useHomeAssistant();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHAOpen, setIsHAOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const displayName = profile?.display_name || userEmail || "Profil";

  const dotClass =
    status === "connected"
      ? "bg-[#6B8E6B]"
      : status === "connecting" || status === "authenticating"
        ? "bg-[#D49A42] animate-pulse"
        : "bg-[#C86D51]";

  const statusTitle =
    status === "connected"
      ? "Home Assistant ansluten"
      : status === "connecting" || status === "authenticating"
        ? "Ansluter till Home Assistant…"
        : "Home Assistant ej ansluten";

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3 sm:h-16">
        {/* Left: Property name + discreet HA status dot */}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="font-display truncate text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl lg:text-3xl">
            {propertyName}
          </h1>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => setIsHAOpen(true)}
              title={`${statusTitle} – klicka för att konfigurera`}
              aria-label={`${statusTitle} – öppna HA-inställningar`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E6B]"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
            </button>
          ) : (
            <span
              role="status"
              title={statusTitle}
              aria-label={statusTitle}
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
            />
          )}
        </div>

        {/* Right: 2 clean anchors (ThemeToggle + Profile Pill) */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />

          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label={`Öppna profilmeny för ${displayName}`}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 pl-1.5 pr-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition-colors hover:border-[#6B8E6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E6B]"
            >
              <AvatarBadge
                avatarUrl={profile?.avatar_url}
                avatarIcon={profile?.avatar_icon}
                displayName={displayName}
                sizeClass="h-8 w-8 rounded-full"
              />
              <span className="max-w-[100px] truncate sm:max-w-[160px]">
                {displayName}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform ${
                  isMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            <ProfileQuickMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              triggerRef={triggerRef}
              profile={profile}
              userEmail={userEmail}
              isAdmin={isAdmin}
              properties={properties}
              selectedPropertyId={selectedPropertyId}
              onSelectProperty={onSelectProperty}
              onOpenSwitcher={onOpenSwitcher}
              onOpenProfileSetup={onOpenProfileSetup}
              onOpenAdmin={onOpenAdmin}
              onOpenHAConfig={() => setIsHAOpen(true)}
              onSignOut={onSignOut}
            />
          </div>
        </div>
      </header>

      <HAConfigModal isOpen={isHAOpen} onClose={() => setIsHAOpen(false)} />
    </>
  );
}
