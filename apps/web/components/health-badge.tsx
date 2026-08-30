"use client";

import { trpc } from "@/lib/trpc/client";

export function HealthBadge() {
  const { data, isError, isPending } = trpc.health.useQuery();

  const state = isPending
    ? { label: "checking…", classes: "bg-black/5 text-zinc-600", dot: "bg-zinc-400" }
    : isError
      ? { label: "api / db down", classes: "bg-red-500/10 text-red-700", dot: "bg-red-500" }
      : data?.ok
        ? { label: "api + db live", classes: "bg-emerald-500/10 text-emerald-700", dot: "bg-emerald-500" }
        : { label: "api up, db down", classes: "bg-amber-500/10 text-amber-700", dot: "bg-amber-500" };

  return (
    <span
      className={`chip ${state.classes}`}
      title="FairPass service health"
    >
      <span className={`size-1.5 rounded-full ${state.dot}`} aria-hidden />
      {state.label}
    </span>
  );
}