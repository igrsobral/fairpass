import { PageShell } from "@/components/page-shell";
import { SellForm } from "@/components/sell-form";

export default function SellPage() {
  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">List your tickets</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Set a fair price — buyers can compare against face value.
        </p>
      </div>
      <div className="mx-auto max-w-2xl">
        <SellForm />
      </div>
    </PageShell>
  );
}