"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const CATEGORY_ART: Record<string, string> = {
  concert: "from-violet-500 via-indigo-500 to-brand-600",
  sport: "from-emerald-500 via-teal-500 to-cyan-600",
  theater: "from-rose-500 via-pink-500 to-fuchsia-600",
  festival: "from-amber-400 via-orange-500 to-rose-500",
};

function artFor(category: string): string {
  return CATEGORY_ART[category] ?? "from-zinc-500 via-zinc-600 to-zinc-800";
}

function EventArt({ category }: { category: string }) {
  return (
    <div
      className={`relative h-28 overflow-hidden bg-linear-to-br ${artFor(category)}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="absolute -bottom-5 -right-4 size-28 rotate-12 text-white/25"
      >
        <path d="M15 5v2M15 11v2M15 17v2" />
        <path d="M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4z" />
      </svg>
    </div>
  );
}

export function EventList() {
  const events = trpc.events.list.useQuery();

  if (events.isPending) {
    return (
      <ul className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="card animate-pulse overflow-hidden">
            <div className="h-28 bg-black/10" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-2/3 rounded bg-black/10" />
              <div className="h-3 w-1/2 rounded bg-black/5" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (events.isError)
    return (
      <p className="rounded-2xl border border-red-200/60 bg-red-500/10 p-4 text-sm text-red-700 backdrop-blur-xl">
        Failed to load events.
      </p>
    );

  const list = events.data ?? [];
  if (list.length === 0)
    return <p className="card p-8 text-center text-sm text-zinc-500">No upcoming events yet.</p>;

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {list.map((row) => (
        <li key={row.event.id}>
          <Link
            href={`/events/${row.event.id}`}
            className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:border-white/80 hover:shadow-float"
          >
            <EventArt category={row.event.category} />
            <div className="flex flex-col gap-1.5 p-4">
              <span className="chip w-fit bg-black/5 capitalize text-zinc-600">
                {row.event.category}
              </span>
              <span className="pt-1 text-sm font-semibold group-hover:text-brand-700">
                {row.event.title}
              </span>
              <span className="text-xs text-zinc-500">
                {row.event.artist ?? "Various artists"} · {row.city ?? "City TBA"}
              </span>
              {row.nextDate && (
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-3.5 text-zinc-400" aria-hidden>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M8 3v4M16 3v4M3 10h18" />
                  </svg>
                  {fmtDate(row.nextDate)}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}