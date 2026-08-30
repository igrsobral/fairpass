import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import type { TRPCContext } from "./context.js";
import type { User } from "../db/schema/auth.js";
import {
  AuthError,
  loginUser,
  registerUser,
} from "../services/auth.js";
import { createSessionToken, SESSION_COOKIE } from "../auth/session.js";
import {
  cancelListing,
  createListing,
  listActiveForEventDate,
  listMyListings,
} from "../services/listings.js";
import {
  completeOrder,
  listBuyerOrders,
  placeHold,
  releaseHold,
} from "../services/orders.js";
import { createAlert, listAlerts, setAlertActive } from "../services/alerts.js";
import { getEventById, getEventDates, listUpcomingEvents } from "../services/catalog.js";
import { pingDb } from "../db/client.js";
import { searchQuerySchema } from "../types.js";
import { SearchUnavailableError, searchTickets } from "../services/search.js";

export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export function toPublicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

function toAppError(err: unknown, fallback = "Unexpected error"): TRPCError {
  if (err instanceof TRPCError) return err;
  const message =
    err instanceof Error && err.message ? err.message : fallback;
  const code =
    err instanceof AuthError ? "CONFLICT" : "BAD_REQUEST";
  return new TRPCError({ code, message });
}

export const appRouter = router({
  health: publicProcedure.query(async () => {
    const dbOk = await pingDb();
    return { ok: dbOk, service: "fairpass", phase: 1 };
  }),

  auth: router({
    register: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(8),
          name: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await registerUser(input);
          const token = await createSessionToken(user.id);
          ctx.setCookie(SESSION_COOKIE, token);
          return { user: toPublicUser(user) };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await loginUser(input.email, input.password);
          const token = await createSessionToken(user.id);
          ctx.setCookie(SESSION_COOKIE, token);
          return { user: toPublicUser(user) };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    me: protectedProcedure.query(({ ctx }) => ({
      user: toPublicUser(ctx.user),
    })),

    logout: protectedProcedure.mutation(({ ctx }) => {
      ctx.clearCookie(SESSION_COOKIE);
      return { ok: true };
    }),
  }),

  search: router({
    search: publicProcedure
      .input(
        z.object({
          query: z.string().min(1).max(500),
          filters: searchQuerySchema.partial().optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await searchTickets(input.query, input.filters);
        } catch (err) {
          if (err instanceof SearchUnavailableError) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: err.message,
            });
          }
          throw toAppError(err);
        }
      }),
  }),

  events: router({
    list: publicProcedure.query(async () => listUpcomingEvents()),
    byId: publicProcedure
      .input(z.object({ eventId: z.string().uuid() }))
      .query(async ({ input }) => getEventById(input.eventId)),
    dates: publicProcedure
      .input(z.object({ eventId: z.string().uuid() }))
      .query(async ({ input }) => getEventDates(input.eventId)),
  }),

  listings: router({
    create: protectedProcedure
      .input(
        z.object({
          eventDateId: z.string().uuid(),
          section: z.string().max(40).optional().nullable(),
          row: z.string().max(20).optional().nullable(),
          seat: z.string().max(20).optional().nullable(),
          tier: z.enum(["premium", "standard", "budget"]),
          faceValueCents: z.number().int().positive(),
          priceCents: z.number().int().positive(),
          currency: z.string().length(3).default("USD"),
          barcode: z.string().min(4).max(200).optional().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const listing = await createListing({
            ...input,
            sellerId: ctx.user.id,
          });
          return { listing };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    mine: protectedProcedure.query(async ({ ctx }) => ({
      listings: await listMyListings(ctx.user.id),
    })),

    cancel: protectedProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const listing = await cancelListing(input.listingId, ctx.user.id);
          return { listing };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    forDate: publicProcedure
      .input(z.object({ eventDateId: z.string().uuid() }))
      .query(async ({ input }) => listActiveForEventDate(input.eventDateId)),
  }),

  order: router({
    place: protectedProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const order = await placeHold(input.listingId, ctx.user.id);
          return { order };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    complete: protectedProcedure
      .input(z.object({ orderId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const order = await completeOrder(input.orderId, ctx.user.id);
          return { order };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    release: protectedProcedure
      .input(z.object({ orderId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const order = await releaseHold(input.orderId, ctx.user.id);
          return { order };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    mine: protectedProcedure.query(async ({ ctx }) => ({
      orders: await listBuyerOrders(ctx.user.id),
    })),
  }),

  alerts: router({
    create: protectedProcedure
      .input(
        z.object({
          query: z.string().min(3).max(300),
          filters: searchQuerySchema,
          thresholdCents: z.number().int().positive().optional().nullable(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const alert = await createAlert({
            userId: ctx.user.id,
            query: input.query,
            filters: input.filters,
            thresholdCents: input.thresholdCents,
          });
          return { alert };
        } catch (err) {
          throw toAppError(err);
        }
      }),

    mine: protectedProcedure.query(async ({ ctx }) => ({
      alerts: await listAlerts(ctx.user.id),
    })),

    setActive: protectedProcedure
      .input(
        z.object({ alertId: z.string().uuid(), active: z.boolean() }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const alert = await setAlertActive(input.alertId, ctx.user.id, input.active);
          return { alert };
        } catch (err) {
          throw toAppError(err);
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;