"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/format";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-white/60 bg-white/35 p-6 text-center text-sm text-zinc-500 shadow-glass backdrop-blur-xl">{text}</p>;
}

const statusChip = (status: string) =>
  status === "active" || status === "completed"
    ? "bg-emerald-500/10 text-emerald-700"
    : status === "hold_placed"
      ? "bg-amber-500/10 text-amber-700"
      : "bg-black/5 text-zinc-500";

export function AccountHub() {
  const me = trpc.auth.me.useQuery();
  const listings = trpc.listings.mine.useQuery(undefined, {
    enabled: me.isSuccess && !!me.data?.user,
  });
  const orders = trpc.order.mine.useQuery(undefined, {
    enabled: me.isSuccess && !!me.data?.user,
  });
  const alerts = trpc.alerts.mine.useQuery(undefined, {
    enabled: me.isSuccess && !!me.data?.user,
  });

  const cancel = trpc.listings.cancel.useMutation({ onSuccess: () => listings.refetch() });
  const complete = trpc.order.complete.useMutation({ onSuccess: () => orders.refetch() });
  const release = trpc.order.release.useMutation({ onSuccess: () => orders.refetch() });

  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [maxUnit, setMaxUnit] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [tier, setTier] = useState<"premium" | "standard" | "budget" | "">("");
  const [alertError, setAlertError] = useState<string | null>(null);
  const createAlert = trpc.alerts.create.useMutation({
    onSuccess: () => {
      setQuery("");
      setCity("");
      setMaxUnit("");
      setMaxTotal("");
      setTier("");
      alerts.refetch();
    },
    onError: (err) => setAlertError(err.message),
  });
  const setActive = trpc.alerts.setActive.useMutation({ onSuccess: () => alerts.refetch() });

  if (!me.isSuccess)
    return <p className="card animate-pulse p-10 text-center text-sm text-zinc-500">Checking session…</p>;
  if (!me.data?.user)
    return (
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-zinc-600">Sign in to manage your listings, orders, and alerts.</p>
        <Link href="/login" className="btn-primary">
          Sign in
        </Link>
      </div>
    );

  const stat = (label: string, value: number) => (
    <div className="card p-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-3 gap-3">
        {stat("Listings", listings.data?.listings.length ?? 0)}
        {stat("Orders", orders.data?.orders.length ?? 0)}
        {stat("Alerts", alerts.data?.alerts.length ?? 0)}
      </div>

      <Section title={`My listings (${listings.data?.listings.length ?? 0})`}>
        {listings.isPending && <p className="text-sm text-zinc-500">Loading…</p>}
        {listings.data?.listings.length === 0 && (
          <Empty text="You haven't listed any tickets yet." />
        )}
        <ul className="flex flex-col gap-2">
          {listings.data?.listings.map((l) => (
            <li key={l.id} className="card flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">
                {l.section ?? "GA"} {l.row ? `· ${l.row}` : ""} —{" "}
                <span className="font-semibold">
                  {formatCurrency(l.priceCents, l.currency)}
                </span>
                <span className={`chip ml-2 capitalize ${statusChip(l.status)}`}>{l.status}</span>
              </span>
              {l.status === "active" && (
                <button
                  type="button"
                  onClick={() => cancel.mutate({ listingId: l.id })}
                  disabled={cancel.isPending}
                  className="btn-ghost px-2.5 py-1.5 text-xs"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`My orders (${orders.data?.orders.length ?? 0})`}>
        {orders.isPending && <p className="text-sm text-zinc-500">Loading…</p>}
        {orders.data?.orders.length === 0 && (
          <Empty text="No orders yet — go browse a listing." />
        )}
        <ul className="flex flex-col gap-2">
          {orders.data?.orders.map((o) => (
            <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">
                <span className="font-semibold">{formatCurrency(o.totalCents, o.currency)}</span>
                <span className={`chip ml-2 capitalize ${statusChip(o.status)}`}>{o.status}</span>
              </span>
              {o.status === "hold_placed" && (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => complete.mutate({ orderId: o.id })}
                    disabled={complete.isPending || release.isPending}
                    className="btn-success px-2.5 py-1.5 text-xs"
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() => release.mutate({ orderId: o.id })}
                    disabled={complete.isPending || release.isPending}
                    className="btn-secondary px-2.5 py-1.5 text-xs"
                  >
                    Release
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Smart alerts (${alerts.data?.alerts.length ?? 0})`}>
        <form
          className="card grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setAlertError(null);
            createAlert.mutate({
              query,
              filters: {
                intent: "alert",
                ...(city ? { city } : {}),
                ...(tier ? { tier } : {}),
                ...(maxUnit ? { maxUnitCents: Math.round(parseFloat(maxUnit) * 100) } : {}),
                ...(maxTotal ? { maxTotalCents: Math.round(parseFloat(maxTotal) * 100) } : {}),
              },
            });
          }}
        >
          <div className="sm:col-span-2">
            <label htmlFor="q" className="label">
              Alert
            </label>
            <input
              id="q"
              className="input"
              placeholder="e.g. Oasis in Buenos Aires"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div>
            <label htmlFor="city" className="label">
              City
            </label>
            <input id="city" className="input" placeholder="Buenos Aires" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label htmlFor="tier" className="label">
              Tier
            </label>
            <select id="tier" className="input" value={tier} onChange={(e) => setTier(e.target.value as typeof tier)}>
              <option value="">Any</option>
              <option value="premium">Premium</option>
              <option value="standard">Standard</option>
              <option value="budget">Budget</option>
            </select>
          </div>
          <div>
            <label htmlFor="max-unit" className="label">
              Max / ticket (USD)
            </label>
            <input
              id="max-unit"
              type="number"
              min="0.01"
              step="0.01"
              className="input"
              placeholder="150"
              value={maxUnit}
              onChange={(e) => setMaxUnit(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="max-total" className="label">
              Max total (USD)
            </label>
            <input
              id="max-total"
              type="number"
              min="0.01"
              step="0.01"
              className="input"
              placeholder="300"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
            />
          </div>
          {alertError && <p className="text-sm font-medium text-red-600 sm:col-span-2">{alertError}</p>}
          <button
            type="submit"
            disabled={createAlert.isPending}
            className="btn-primary sm:col-span-2"
          >
            {createAlert.isPending ? "Creating…" : "Create alert"}
          </button>
        </form>

        {alerts.data?.alerts.length === 0 && <Empty text="No alerts yet." />}
        <ul className="flex flex-col gap-2">
          {alerts.data?.alerts.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{a.query}</span>
                {a.thresholdCents != null && (
                  <span className="text-xs text-zinc-500">
                    ≤ {formatCurrency(a.thresholdCents)}
                  </span>
                )}
                <span className={`chip ${a.active ? "bg-emerald-500/10 text-emerald-700" : "bg-black/5 text-zinc-500"}`}>
                  {a.active ? "active" : "paused"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setActive.mutate({ alertId: a.id, active: !a.active })}
                disabled={setActive.isPending}
                className="btn-ghost px-2.5 py-1.5 text-xs"
              >
                {a.active ? "Pause" : "Resume"}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}