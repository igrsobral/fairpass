const CATEGORY_ART: Record<string, string> = {
  concert: "from-violet-500 via-indigo-500 to-brand-600",
  sport: "from-emerald-500 via-teal-500 to-cyan-600",
  theater: "from-rose-500 via-pink-500 to-fuchsia-600",
  festival: "from-amber-400 via-orange-500 to-rose-500",
};

export function artFor(category: string): string {
  return CATEGORY_ART[category] ?? "from-zinc-500 via-zinc-600 to-zinc-800";
}

export function EventArt({
  category,
  className = "",
}: {
  category: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-linear-to-br ${artFor(category)} ${className}`}
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