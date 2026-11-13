import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Touch-friendly surface card using Scandinavian earthy theme tokens.
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      style={{ boxShadow: "var(--card-shadow)" }}
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
