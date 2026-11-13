import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Touch-friendly surface card designed for the #131A26 dark kiosk and mobile theme.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-[#131A26] p-5 shadow-lg shadow-black/30 transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
