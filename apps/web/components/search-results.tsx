"use client";

import type { ListingResult, SearchResponse, SearchQuery } from "@fairpass/api";
import { formatCurrency } from "@/lib/format";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function ParsedChips({ query }: { query: SearchQuery }) {
  const chips: Array<[label: string, value?: string | number]> = [
    ["Event", query.eventName],
    ["Artist", query.artist],
    ["City", query.city],
    ["Tier", query.tier],
    ["Category", query.category],
    ["Qty", query.quantity > 1 ? query.quantity : undefined],
    [
      "Budget",
      query.maxTotalCents
        ? `${formatCurrency(query.maxTotalCents)} total`
        : query.maxUnitCents
          ? `${formatCurrency(query.maxUnitCents)} ea`
          : undefined,
    ],
  ];
  const active = chips.filter(([, v]) => v !== undefined);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(([label, value]) => (
        <span
          key={label}
          className="chip bg-brand-500/10 text-brand-700"
        >
          <span className="text-brand-400">{label}</span>
          <span>{value}</span>
        </span>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card animate-pulse p-5">
          <div className="mb-3 h-4 w-2/3 rounded bg-black/10" />
          <div className="h-3 w-1/3 rounded bg-black/5" />
        </div>
      ))}
    </div>
  );
}

function ResultCard({ result }: { result: ListingResult }) {
  const honest = Math.abs(result.deviationPct) < 5;
  const deviation =
    result.deviationPct > 40
      ? "bg-red-500/10 text-red-700"
      : "bg-amber-500/10 text-amber-700";
  const trust =
    result.sellerTrustScore >= 0.7
      ? "bg-emerald-500/10 text-emerald-700"
      : result.sellerTrustScore >= 0.4
        ? "bg-amber-500/10 text-amber-700"
        : "bg-black/5 text-zinc-600";

  return (
    <li className="card flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-float sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold">{result.eventTitle}</p>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">
          {fmtDate(result.eventDate)} · {result.city}
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          {tierLabel(result.tier)}
          {" · "}
          {result.section}
          {result.row ? ` · Row ${result.row}` : ""}
          {result.seat && result.seat !== ".." ? ` · Seat ${result.seat}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className={`chip ${honest ? "bg-emerald-500/10 text-emerald-700" : deviation}`}>
            {honest
              ? "at face value"
              : `${result.deviationPct > 0 ? "+" : ""}${result.deviationPct.toFixed(0)}% vs face`}
          </span>
          <span className={`chip ${trust}`}>seller trust {result.sellerTrustScore.toFixed(2)}</span>
          <span className="chip bg-black/5 text-zinc-500">
            relevance {result.relevanceScore.toFixed(2)}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <p className="text-lg font-bold tabular-nums">
          {formatCurrency(result.priceCents, result.currency)}
        </p>
        <p className="text-xs text-zinc-400 line-through">
          face {formatCurrency(result.faceValueCents)}
        </p>
      </div>
    </li>
  );
}

export function SearchResults({
  data,
  isPending,
  isError,
}: {
  data: SearchResponse | undefined;
  isPending: boolean;
  isError: boolean;
}) {
  if (isPending) return <Skeleton />;
  if (isError)
    return (
      <p className="rounded-2xl border border-red-200/60 bg-red-500/10 p-4 text-sm text-red-700 backdrop-blur-xl">
        Search is temporarily unavailable — make sure the search index is running.
      </p>
    );
  if (!data) return null;

  const results = data.results ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ParsedChips query={data.query} />
        <p className="text-xs text-zinc-500">
          {results.length === 0
            ? "No matching listings right now."
            : `${results.length}${data.total > results.length ? ` of ${data.total}` : ""} honest match${results.length === 1 ? "" : "es"}`}
        </p>
      </div>
      {results.length > 0 && (
        <ol className="flex flex-col gap-3">
          {results.map((r) => (
            <ResultCard key={r.listingId} result={r} />
          ))}
        </ol>
      )}
    </div>
  );
}