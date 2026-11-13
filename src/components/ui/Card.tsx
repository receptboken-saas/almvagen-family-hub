import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Touch-friendly surface card designed for dark kiosk and mobile screens.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
