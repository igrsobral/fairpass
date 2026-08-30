import { PageShell } from "@/components/page-shell";
import { AccountHub } from "@/components/account";

export default function AccountPage() {
  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage your listings, orders, and smart alerts.
        </p>
      </div>
      <AccountHub />
    </PageShell>
  );
}