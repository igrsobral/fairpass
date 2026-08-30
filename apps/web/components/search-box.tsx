"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { SearchResults } from "./search-results";

const EXAMPLES = [
  "2 lower-tier Oasis tickets in Buenos Aires under $180 total",
  "Inter Miami match in Miami, any tier",
  "Coldplay tickets in Leipzig under $120 each",
];

export function SearchSection() {
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<{ query: string; key: number } | null>(null);

  const search = trpc.search.search.useQuery(
    { query: submitted?.query ?? "" },
    { enabled: submitted !== null, placeholderData: (prev) => prev },
  );

  const searching = submitted !== null && search.isFetching;

  return (
    <section className="flex flex-col gap-5">
      <form
        className="card flex flex-col gap-4 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = draft.trim();
          if (!trimmed) return;
          setSubmitted((prev) => ({ query: trimmed, key: (prev?.key ?? 0) + 1 }));
        }}
      >
        <div className="flex items-start gap-3">
          <span className="tile mt-1 hidden size-9 shrink-0 sm:grid">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4.5" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder='Try natural language — e.g. "2 lower-tier Oasis tickets in Buenos Aires under $180 total"'
            className="input min-h-20 resize-none"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setDraft(ex)}
                className="hidden max-w-64 truncate rounded-full border border-white/60 bg-white/55 px-3 py-1.5 text-xs text-zinc-600 shadow-glass ring-1 ring-black/5 backdrop-blur-xl transition hover:border-brand-300/60 hover:text-brand-700 lg:inline-flex"
                title={ex}
              >
                {ex.length > 44 ? `${ex.slice(0, 44)}…` : ex}
              </button>
            ))}
          </div>
          <button type="submit" disabled={!draft.trim() || searching} className="btn-primary">
            {searching ? "Searching…" : "Search"}
            {!searching && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {submitted ? (
        <SearchResults
          key={submitted.key}
          data={search.data}
          isPending={search.isPending}
          isError={search.isError}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-white/60 bg-white/35 p-8 text-center text-sm leading-relaxed text-zinc-500 shadow-glass backdrop-blur-xl">
          Ask for what you want: event, artist, city, tier, seat, budget — search
          understands quantity, total-price budgets and under/over phrasing.
        </p>
      )}
    </section>
  );
}