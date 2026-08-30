import "server-only";

import {
  createTRPCProxyClient,
  httpBatchLink,
  loggerLink,
} from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@fairpass/api";

/**
 * Server-side tRPC caller, used from Server Components / route handlers.
 */
export const trpcServer = createTRPCProxyClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/trpc`,
      transformer: superjson,
    }),
  ],
});