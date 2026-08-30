"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Logo } from "./logo";

const LINKS = [
  { href: "/events", label: "Events" },
  { href: "/search", label: "Search" },
];

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const me = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
  });

  const user = me.data?.user;
  const signedIn = me.isSuccess && !!user;

  const links = signedIn
    ? [
        ...LINKS,
        { href: "/sell", label: "Sell tickets" },
        { href: "/account", label: "Account" },
      ]
    : LINKS;

  const linkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return active
      ? "font-medium text-brand-700"
      : "text-zinc-600 hover:text-zinc-900";
  };

  const pillClass = "rounded-lg px-3 py-2 transition hover:bg-white/60 hover:backdrop-blur-xl";

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-white/55 shadow-glass backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" onClick={() => setOpen(false)} aria-label="FairPass home">
            <Logo />
          </Link>
          <div className="hidden items-center gap-1 text-sm md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`${pillClass} ${linkClass(link.href)}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <span className="chip bg-brand-500/10 text-brand-700">{user.email}</span>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="btn-secondary px-3 py-2 text-xs"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost px-3 py-2 text-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary px-3 py-2 text-sm">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid size-10 place-items-center rounded-xl border border-white/60 bg-white/50 text-zinc-700 shadow-glass backdrop-blur-xl md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-5" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/50 bg-white/55 px-4 pb-4 pt-2 shadow-glass backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-sm hover:bg-white/60 hover:backdrop-blur-xl ${linkClass(link.href)}`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-black/5 pt-3">
              {signedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout.mutate();
                  }}
                  className="btn-secondary w-full"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary w-full">
                    Sign in
                  </Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="btn-primary w-full">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}