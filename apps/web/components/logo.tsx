export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-8 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4.5"
          aria-hidden
        >
          <path d="M15 5v2M15 11v2M15 17v2" />
          <path d="M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4z" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        FairPass
      </span>
    </span>
  );
}