import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EventDates } from "@/components/event-dates";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <PageShell className="py-8 sm:py-10">
      <Link
        href="/events"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-brand-700"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        All events
      </Link>
      <EventDates eventId={eventId} />
    </PageShell>
  );
}