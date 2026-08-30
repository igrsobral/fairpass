import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-white/50 bg-white/40 shadow-glass backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
        <Logo />
        <p className="text-xs text-zinc-500">
          Buy verified tickets at honest prices — powered by AI matchmaking.
        </p>
      </div>
    </footer>
  );
}