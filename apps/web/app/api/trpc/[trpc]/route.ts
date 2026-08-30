import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext, appRouter } from "@fairpass/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ resHeaders }) =>
      createContext({
        headers: new Headers(req.headers),
        cookiesOut: (header) => resHeaders.append("set-cookie", header),
      }),
  });

export { handler as GET, handler as POST };