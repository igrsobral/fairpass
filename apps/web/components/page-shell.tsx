import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export function PageShell({
  children,
  className = "py-10 sm:py-12",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Nav />
      <main className={`mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6 ${className}`}>
        {children}
      </main>
      <Footer />
    </div>
  );
}