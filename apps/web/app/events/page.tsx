import { PageShell } from "@/components/page-shell";
import { EventList } from "@/components/events";

export default function EventsPage() {
  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Upcoming events</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Browse every event with active resale listings.
        </p>
      </div>
      <EventList />
    </PageShell>
  );
}