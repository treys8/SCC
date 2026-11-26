import { BottomNav } from "@/components/bottom-nav";
import { Crest } from "@/components/crest";
import { IosInstallPrompt } from "@/components/ios-install-prompt";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { SiteNav } from "@/components/site-nav";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  const supabase = await createClient();
  // Unread notification count powers the nav bell badge; the heartbeat records
  // this visit for the adoption dashboard (self-throttled to ~15 min in the DB,
  // so calling it on every page load is cheap). Run both together — the
  // heartbeat is best-effort and swallows failures so it can never break a page.
  const [{ count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("is_read", false),
    supabase.rpc("touch_last_seen").then(
      () => undefined,
      () => undefined,
    ),
  ]);

  return (
    // Reserve space at the bottom on phones so the fixed tab bar never covers
    // content or the footer — including the home-indicator safe area on notched
    // devices (the tab bar grows by the same inset).
    // `overflow-x-clip` contains the full-bleed title bands (PageHeader /
    // TodayHero break out with 100vw, which includes the desktop scrollbar).
    <div className="flex min-h-full flex-col overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <ServiceWorkerRegister />
      <SiteNav profile={profile} unreadCount={count ?? 0} />
      {/* No top padding: every page opens with a full-bleed green band
          (PageHeader, or TodayHero on /) that sits flush under the header. */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 md:pb-16">
        {children}
        {/* After the content, so it never wedges between header and band. */}
        <IosInstallPrompt />
      </main>
      <footer className="on-dark bg-green-darker text-cream/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center">
          <Crest tone="dark" className="h-8 w-8 opacity-80" />
          <p className="font-serif text-sm tracking-[0.04em] text-cream/80">
            Starkville Country Club
          </p>
          <p className="text-caption tracking-[0.06em]">
            © {new Date().getFullYear()} · Member Portal
          </p>
        </div>
      </footer>
      <BottomNav />
    </div>
  );
}
