import { Home, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EnergyOverview } from "@/components/energy/EnergyOverview";
import { RoomCard } from "@/components/rooms/RoomCard";
import { ROOMS_CONFIG } from "@/config/rooms.config";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30">
            <Home className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Almvägen 1 – Familjehubb
            </h1>
            <p className="mt-0.5 text-sm text-slate-400">
              Översikt för väggskärm och mobil
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge />
        </div>
      </header>

      <section aria-labelledby="energy-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="energy-heading"
            className="text-sm font-semibold uppercase tracking-wider text-slate-400"
          >
            Energi &amp; Klimat
          </h2>
          <span className="text-xs text-slate-500">Realtidsdata via HA</span>
        </div>
        <EnergyOverview />
      </section>

      <section aria-labelledby="rooms-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="rooms-heading"
            className="text-sm font-semibold uppercase tracking-wider text-slate-400"
          >
            Rum &amp; Belysning
          </h2>
          <span className="text-xs text-slate-500">
            {ROOMS_CONFIG.length} konfigurerade rum
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROOMS_CONFIG.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-900 pt-6 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-slate-600" aria-hidden="true" />
          <span>Home Assistant WebSocket &amp; Supabase Ready</span>
        </span>
        <span>Cloudflare Static Export</span>
      </footer>
    </main>
  );
}
