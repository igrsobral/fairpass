"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/format";

function priceBadge(deviationPct: number): { label: string; classes: string } {
  if (deviationPct <= 15)
    return { label: "fair price", classes: "bg-emerald-500/10 text-emerald-700" };
  if (deviationPct <= 50)
    return { label: "moderate markup", classes: "bg-amber-500/10 text-amber-700" };
  return { label: "scalped", classes: "bg-red-500/10 text-red-700" };
}

function trustLabel(score: number): { label: string; classes: string } {
  if (!score)
    return { label: "new seller", classes: "bg-black/5 text-zinc-600" };
  if (score >= 0.75)
    return { label: "trusted", classes: "bg-emerald-500/10 text-emerald-700" };
  if (score >= 0.6)
    return { label: "established", classes: "bg-brand-500/10 text-brand-700" };
  return { label: "low history", classes: "bg-amber-500/10 text-amber-700" };
}

export function ListingBoard({ dateId }: { dateId: string }) {
  const me = trpc.auth.me.useQuery();
  const listings = trpc.listings.forDate.useQuery({ eventDateId: dateId });
  const place = trpc.order.place.useMutation({
    onSuccess: () => listings.refetch(),
    onError: (err) => setNotice(err.message),
  });
  const complete = trpc.order.complete.useMutation({
    onSuccess: () => listings.refetch(),
    onError: (err) => setNotice(err.message),
  });
  const release = trpc.order.release.useMutation({
    onSuccess: () => {
      listings.refetch();
      setHeldOrder(null);
    },
    onError: (err) => setNotice(err.message),
  });

  const [heldOrder, setHeldOrder] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signedIn = me.isSuccess && me.data.user;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">
          Listed tickets
          {listings.data ? ` (${listings.data.length})` : ""}
        </h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          Live resale · trust-scored sellers
        </span>
      </div>

      {notice && (
        <p className="rounded-2xl border border-red-200/60 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 backdrop-blur-xl">
          {notice}
        </p>
      )}
      {heldOrder && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-500/10 px-4 py-3 backdrop-blur-xl">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12l2.5 2.5L16 9" />
            </svg>
            Hold active — finish the purchase below.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => complete.mutate({ orderId: heldOrder })}
              disabled={complete.isPending || release.isPending}
              className="btn-success px-3 py-1.5 text-xs"
            >
              Complete purchase
            </button>
            <button
              type="button"
              onClick={() => release.mutate({ orderId: heldOrder })}
              disabled={complete.isPending || release.isPending}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Release hold
            </button>
          </div>
        </div>
      )}

      {listings.isPending && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}
        </div>
      )}
      {listings.isError && (
        <p className="rounded-2xl border border-red-200/60 bg-red-500/10 p-4 text-sm text-red-700 backdrop-blur-xl">
          Failed to load listings.
        </p>
      )}

      {listings.data && listings.data.length === 0 && (
        <p className="card p-10 text-center text-sm text-zinc-500">
          No active listings for this date.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {listings.data?.map((row) => {
          const price = priceBadge(row.deviationPct);
          const trust = trustLabel(row.sellerTrustScore);
          const trustPct = Math.round(row.sellerTrustScore * 100);
          return (
            <li
              key={row.listing.id}
              className="card flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-float sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-black/5 capitalize text-zinc-700">
                    {row.listing.tier}
                  </span>
                  <span className={`chip ${price.classes}`}>
                    {price.label} +{row.deviationPct}%
                  </span>
                  <span className={`chip ${trust.classes}`}>{trust.label}</span>
                </div>
                <span className="text-base font-semibold">
                  {row.listing.section ?? "General admission"}
                  {row.listing.row ? ` · Row ${row.listing.row}` : ""}
                  {row.listing.seat && row.listing.seat !== ".." ? ` · Seat ${row.listing.seat}` : ""}
                </span>
                <span className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{trustPct}% seller trust</span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
                    <span
                      className={`block h-full rounded-full ${trustPct >= 75 ? "bg-emerald-500" : trustPct >= 60 ? "bg-brand-500" : "bg-amber-500"}`}
                      style={{ width: `${trustPct}%` }}
                    />
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-5 sm:flex-col sm:items-end">
                <div className="text-right">
                  <span className="text-xl font-bold tabular-nums">
                    {formatCurrency(row.listing.priceCents, row.listing.currency)}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400 line-through">
                    face {formatCurrency(row.listing.faceValueCents)}
                  </span>
                </div>
                {signedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      place.mutate(
                        { listingId: row.listing.id },
                        { onSuccess: (res) => setHeldOrder(res?.order?.id ?? null) },
                      );
                    }}
                    disabled={place.isPending}
                    className="btn-primary"
                  >
                    Buy
                  </button>
                ) : (
                  <Link href="/login" className="btn-secondary">
                    Sign in to buy
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}