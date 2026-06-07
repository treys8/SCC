import { SiteNav } from "@/components/site-nav";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-full flex-col">
      <SiteNav profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Starkville Country Club · Member Portal
        </div>
      </footer>
    </div>
  );
}
