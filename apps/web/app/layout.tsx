import type { Metadata } from "next";
import "./globals.css";
import { TRPCProvider } from "@/lib/trpc/react";

export const metadata: Metadata = {
  title: "FairPass — AI-powered P2P ticket exchange",
  description:
    "Buy and sell live event tickets safely with AI matchmaking, hybrid search, and fraud-safe verification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}