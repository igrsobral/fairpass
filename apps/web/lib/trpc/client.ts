"use client";

import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@fairpass/api";

export const trpc = createTRPCReact<AppRouter>();