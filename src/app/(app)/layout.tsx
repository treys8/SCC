import { BottomNav } from "@/components/bottom-nav";
import { SiteNav } from "@/components/site-nav";
import { isStaff, requireProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    // Reserve space at the bottom on phones so the fixed tab bar never covers
    // content or the footer — including the home-indicator safe area on notched
    // devices (the tab bar grows by the same inset).
    <div className="flex min-h-full flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <SiteNav profile={profile} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        {children}
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Starkville Country Club · Member Portal
        </div>
      </footer>
      <BottomNav showHome={isStaff(profile.role)} />
    </div>
  );
}
