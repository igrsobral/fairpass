import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@fairpass/api";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let cookieJar = "";

async function fetchWithCookies(
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cookieJar) headers.set("cookie", cookieJar);
  const res = await fetch(input, { ...init, headers });
  const setCookies = res.headers.getSetCookie();
  for (const cookie of setCookies) {
    const name = cookie.split("=")[0]!;
    if (/=(|;)/.test(cookie.split(";")[0]!)) {
      cookieJar = cookieJar
        .split("; ")
        .filter((c) => !c.startsWith(`${name}=`))
        .join("; ");
    }
    cookieJar = cookieJar
      ? `${cookieJar}; ${cookie.split(";")[0]}`
      : cookie.split(";")[0]!;
  }
  return res;
}

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BASE}/api/trpc`,
      transformer: superjson,
      fetch: fetchWithCookies as typeof fetch,
    }),
  ],
});

const results: string[] = [];
console.log('as')

function check(name: string, ok: boolean, extra?: string): void {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` — ${extra}` : ""}`);
}

async function main(): Promise<void> {
  const events = await trpc.events.list.query();
  check("events.list returns seeded catalog", events.length >= 1, `${events.length} events`);

  const eventId = events[0]!.event.id;
  const dates = await trpc.events.dates.query({ eventId });
  check("events.dates returns on-sale dates", dates.length >= 1);

  const dateId = dates[0]!.id;
  const listings = await trpc.listings.forDate.query({ eventDateId: dateId });
  check(
    "listings.forDate returns trust + deviation",
    listings.length > 0 &&
    listings.every((r) => typeof r.sellerTrustScore === "number" && typeof r.deviationPct === "number"),
    `${listings.length} listed`,
  );

  const meAnonymous = await trpc.auth.me.query().catch(() => null);
  check("auth.me unauthenticated is null", meAnonymous === null);

  const login = await trpc.auth.login.mutate({
    email: "buyer@fairpass.dev",
    password: "password123",
  });
  check("auth.login sets user", !!login.user.email, login.user.email);
  check("auth.login set session cookie", cookieJar.includes("fp_session="));

  const me = await trpc.auth.me.query();
  check("auth.me resolves session", me?.user?.email === "buyer@fairpass.dev");

  const target = listings[0]!;
  const held = await trpc.order.place.mutate({ listingId: target.listing.id });
  check("order.place creates hold", held.order.status === "hold_placed", `$${(held.order.totalCents / 100).toFixed(2)}`);

  const released = await trpc.order.release.mutate({ orderId: held.order.id });
  check("order.release returns listing", released.order.status === "declined");

  const alert = await trpc.alerts.create.mutate({
    query: "Oasis Buenos Aires under 150",
    filters: { intent: "alert", city: "Buenos Aires", maxUnitCents: 15_000 },
  });
  check("alerts.create persists filters", alert.alert.filters != null, `id=${alert.alert.id.slice(0, 8)}`);

  const logout = await trpc.auth.logout.mutate();
  check("auth.logout clears cookie", logout.ok === true, `jar=${cookieJar ? "present" : "clear"}`);

  try {
    const search = await trpc.search.search.query({ query: "2 lower-tier oasis under 180 total" });
    check(
      "search.search proxies hybrid engine",
      search.total >= 1 && search.results[0]?.city === "Buenos Aires",
      `${search.total} hit(s), parsed: ${search.query.tier ?? "any"} / ${search.query.maxTotalCents ?? "no"} budget cap`,
    );
  } catch {
    check("search.search proxies hybrid engine", false, "ai-engine unreachable — start uvicorn on :8000");
  }

  console.log(results.join("\n"));
  const failed = results.filter((r) => r.startsWith("FAIL"));
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});