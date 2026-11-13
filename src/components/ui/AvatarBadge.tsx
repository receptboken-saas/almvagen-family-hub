import { DynamicIcon } from "@/components/ui/IconResolver";

export interface AvatarPreset {
  id: string;
  label: string;
  bg: string;
  fg: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "preset:sage", label: "Salvia", bg: "#6B8E6B", fg: "#FFFDF9" },
  { id: "preset:terracotta", label: "Terrakotta", bg: "#C86D51", fg: "#FFFDF9" },
  { id: "preset:ochre", label: "Ockra", bg: "#D49A42", fg: "#292421" },
  { id: "preset:walnut", label: "Valnöt", bg: "#4A3F37", fg: "#F4EFEA" },
  { id: "preset:linen", label: "Linne", bg: "#E2D9CC", fg: "#292421" },
  { id: "preset:forest", label: "Skog", bg: "#3F5E4B", fg: "#F4EFEA" },
];

interface AvatarBadgeProps {
  avatarUrl?: string | null;
  avatarIcon?: string | null;
  displayName?: string | null;
  sizeClass?: string;
}

export function AvatarBadge({
  avatarUrl,
  avatarIcon,
  displayName,
  sizeClass = "h-10 w-10",
}: AvatarBadgeProps) {
  if (
    avatarUrl &&
    (avatarUrl.startsWith("data:") ||
      avatarUrl.startsWith("http://") ||
      avatarUrl.startsWith("https://"))
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName ?? "Profilbild"}
        className={`${sizeClass} shrink-0 rounded-2xl object-cover ring-1 ring-[var(--border-subtle)]`}
      />
    );
  }

  const preset = AVATAR_PRESETS.find((p) => p.id === avatarUrl);
  if (preset) {
    const initials = (displayName ?? "A")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return (
      <div
        style={{ backgroundColor: preset.bg, color: preset.fg }}
        className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl font-display text-sm font-semibold shadow-sm`}
      >
        {initials || "A"}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-2xl bg-[#6B8E6B]/15 text-[#6B8E6B] ring-1 ring-[#6B8E6B]/30`}
    >
      <DynamicIcon name={avatarIcon ?? "ui_ha_status"} className="h-5 w-5" />
    </div>
  );
}
