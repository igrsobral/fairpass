"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { EventArt } from "./event-art";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDates({ eventId }: { eventId: string }) {
  const event = trpc.events.byId.useQuery({ eventId });
  const dates = trpc.events.dates.useQuery({ eventId });

  return (
    <div className="flex flex-col gap-6">
      <div className="card overflow-hidden">
        <EventArt category={event.data?.category ?? ""} className="h-40" />
        <div className="relative p-6 pt-5">
          <span className="chip w-fit bg-black/5 capitalize text-zinc-600">
            {event.data?.category ?? "…"}
          </span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {event.data?.title ?? "Loading…"}
          </h1>
          {event.data?.description && (
            <p className="mt-2 max-w-xl text-sm text-zinc-600">
              {event.data?.description}
            </p>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-zinc-400" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {event.data?.city ?? "City TBA"}
          </p>
        </div>
      </div>

      {dates.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card h-16 animate-pulse" />
          ))}
        </div>
      )}
      {dates.isError && (
        <p className="rounded-2xl border border-red-200/60 bg-red-500/10 p-4 text-sm text-red-700 backdrop-blur-xl">
          Failed to load dates.
        </p>
      )}

      {dates.data && dates.data.length === 0 && (
        <p className="card p-8 text-center text-sm text-zinc-500">No on-sale dates.</p>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Choose a date
        </h2>
        <ul className="flex flex-col gap-3">
          {dates.data?.map((date) => (
            <li key={date.id}>
              <Link
                href={`/events/${eventId}/dates/${date.id}`}
                className="card group flex items-center justify-between gap-4 px-5 py-4 transition hover:-translate-y-0.5 hover:border-white/80 hover:shadow-float"
              >
                <div className="flex items-center gap-4">
                  <div className="tile size-11 shrink-0 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5" aria-hidden>
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M8 3v4M16 3v4M3 10h18" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium">{fmtDate(date.startsAt)}</span>
                </div>
                <span className="flex items-center gap-2 text-sm">
                  <span className="chip bg-emerald-500/10 text-emerald-700">
                    {date.status === "on_sale" ? "On sale" : date.status}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-zinc-400 transition group-hover:text-brand-600" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}