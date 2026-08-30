import { PageShell } from "@/components/page-shell";
import { EventList } from "@/components/events";
import { SearchSection } from "@/components/search-box";
import { HealthBadge } from "@/components/health-badge";
import Link from "next/link";

const FEATURES = [
  {
    title: "AI matchmaking",
    body: "Tell the agent what you want in plain language — it negotiates, holds, and alerts you.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        <circle cx="12" cy="12" r="3.5" />
      </svg>
    ),
  },
  {
    title: "Honest pricing",
    body: "Every listing is scored against face value, so scalping is easy to spot — not just cheap.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    ),
  },
  {
    title: "Fraud-safe verification",
    body: "Barcodes are hashed and verified end-to-end by a dedicated verification service.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
        <path d="M12 3l7 3v5c0 4.5-3 8.6-7 10-4-1.4-7-5.5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <PageShell className="py-0">
      <section className="relative overflow-hidden border-b border-white/50">
        <div className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-brand-300/40 blur-3xl will-change-transform animate-drift" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-24 size-80 rounded-full bg-amber-200/50 blur-3xl will-change-transform animate-drift" aria-hidden />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <HealthBadge />
          <h1 className="font-display text-4xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
            Tickets, without the{" "}
            <span className="bg-linear-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
              gamble
            </span>
            .
          </h1>
          <p className="max-w-2xl text-base text-zinc-600 sm:text-lg">
            FairPass is an AI-powered peer-to-peer marketplace. Search in plain English,
            compare every price against face value, and buy verified barcodes from
            trust-scored sellers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/search" className="btn-primary">
              Find tickets
            </Link>
            <Link href="/sell" className="btn-secondary">
              Sell tickets
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-float">
            <div className="tile mb-3 size-10 group-hover:bg-brand-600 group-hover:text-white">
              {feature.icon}
            </div>
            <h3 className="text-sm font-semibold">{feature.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold tracking-tight">Ask for exactly what you want</h2>
          <p className="mt-1 text-sm text-zinc-600">
            No filters, no jargon — describe it like you&apos;d tell a friend.
          </p>
        </div>
        <SearchSection />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Upcoming events</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Live resale listings, trust-scored and priced honestly.
            </p>
          </div>
          <Link href="/events" className="btn-ghost hidden shrink-0 text-sm sm:inline-flex">
            View all
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
        <EventList />
      </section>
    </PageShell>
  );
}