"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { X, Upload, Check, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/useAuth";
import { AVATAR_PRESETS, AvatarBadge } from "@/components/ui/AvatarBadge";
import { IconPicker } from "@/components/admin/IconPicker";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Kunde inte skapa bildkontext."));
        return;
      }

      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      URL.revokeObjectURL(objectUrl);

      const webp = canvas.toDataURL("image/webp", 0.82);
      if (webp.startsWith("data:image/webp")) {
        resolve(webp);
      } else {
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Kunde inte läsa vald bild."));
    };
    img.src = objectUrl;
  });
}

export function ProfileSetupModal({ isOpen, onClose }: ProfileSetupModalProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [quickPin, setQuickPin] = useState(profile?.quick_pin ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [avatarIcon, setAvatarIcon] = useState<string>(
    profile?.avatar_icon ?? "avatar_parent",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !profile || !user) return null;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      setAvatarUrl(compressed);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunde inte bearbeta bilden.",
      );
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !profile) return;

    const cleanPin = quickPin.replace(/\D/g, "").slice(0, 4);
    if (cleanPin && cleanPin.length !== 4) {
      setError("Snabb-PIN måste vara exakt 4 siffror (eller lämnas tom).");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || profile.display_name,
        quick_pin: cleanPin || null,
        avatar_url: avatarUrl,
        avatar_icon: avatarIcon || null,
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }

    await refreshProfile();
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h2
              id="profile-modal-title"
              className="font-display text-xl font-semibold text-[var(--text-primary)]"
            >
              Min profil
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Anpassa din bild, visningsnamn och Snabb-PIN.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-[#C86D51]/40 bg-[#C86D51]/10 px-3.5 py-2.5 text-xs text-[#C86D51]">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          <div className="flex items-center gap-4">
            <AvatarBadge
              avatarUrl={avatarUrl}
              avatarIcon={avatarIcon}
              displayName={displayName || profile.display_name}
              sizeClass="h-16 w-16"
            />
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#6B8E6B]">
              <Upload className="h-4 w-4 text-[#6B8E6B]" />
              <span>Ladda upp bild</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Eller välj en färgbricka
            </p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const selected = avatarUrl === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatarUrl(preset.id)}
                    title={preset.label}
                    style={{ backgroundColor: preset.bg, color: preset.fg }}
                    className={`flex h-10 items-center justify-center rounded-xl text-xs font-bold transition-transform ${
                      selected
                        ? "scale-105 ring-2 ring-[#6B8E6B] ring-offset-2 ring-offset-[var(--bg-card)]"
                        : "opacity-85 hover:opacity-100"
                    }`}
                  >
                    {(displayName || "A")[0]?.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <IconPicker
            context="avatar"
            value={avatarIcon}
            onChange={(icon) => {
              setAvatarIcon(icon);
              setAvatarUrl(null);
            }}
            label="Eller välj en personlig ikon"
          />

          <div>
            <label
              htmlFor="profile-name"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              Visningsnamn
            </label>
            <input
              id="profile-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="profile-pin"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
            >
              4-siffrig Snabb-PIN
            </label>
            <input
              id="profile-pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={quickPin}
              onChange={(e) =>
                setQuickPin(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              placeholder="t.ex. 1234"
              className="tabular-nums mt-1.5 min-h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 text-sm text-[var(--text-primary)] focus:border-[#6B8E6B] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-xs font-semibold text-[var(--text-secondary)]"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6B8E6B] px-5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Spara profil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
