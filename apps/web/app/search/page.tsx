import { PageShell } from "@/components/page-shell";
import { SearchSection } from "@/components/search-box";

export default function SearchPage() {
  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Find tickets</h1>
        <p className="text-sm text-zinc-600">
          Hybrid semantic search over every verified listing — natural language,
          price-budget aware, ranked by honesty and seller trust.
        </p>
      </div>
      <SearchSection />
    </PageShell>
  );
}