"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Logo } from "./logo";

function Field({
  id,
  label,
  hint,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} className="input" {...props} />
      {hint && <p className="mt-1.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function FormCard({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">{heading}</h1>
      <p className="mt-1.5 text-sm text-zinc-600">{sub}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function AuthPageShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute -top-24 right-0 size-96 rounded-full bg-brand-300/40 blur-3xl will-change-transform animate-drift" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-0 size-80 rounded-full bg-amber-200/50 blur-3xl will-change-transform animate-drift" aria-hidden />
      <div className="relative flex w-full max-w-md flex-col items-center gap-5">
        <Link href="/" className="transition hover:opacity-80" aria-label="FairPass home">
          <Logo />
        </Link>
        {children}
        <p className="text-xs text-zinc-500">{footer}</p>
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        login.mutate({ email, password });
      }}
    >
      <Field
        id="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={login.isPending} className="btn-primary mt-1 w-full">
        {login.isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function LoginView() {
  return (
    <AuthPageShell footer="New to FairPass? Create a free account below.">
      <FormCard heading="Welcome back" sub="Sign in to buy, sell, and manage tickets.">
        <LoginForm />
      </FormCard>
    </AuthPageShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      router.push("/");
      router.refresh();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        register.mutate({ email, name, password });
      }}
    >
      <Field
        id="name"
        label="Name"
        required
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <button type="submit" disabled={register.isPending} className="btn-primary mt-1 w-full">
        {register.isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export function RegisterView() {
  return (
    <AuthPageShell footer="Already have an account? Sign in.">
      <FormCard heading="Create your account" sub="Join FairPass to list tickets and set smart alerts.">
        <RegisterForm />
      </FormCard>
    </AuthPageShell>
  );
}