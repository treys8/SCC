import type { Metadata } from "next";
import Link from "next/link";
import { MenuView } from "@/components/menu-view";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Menus" };

/**
 * Member-facing menu page: shows the club's lunch and dinner menus as the actual
 * menu pages (images), with the full PDF available to download or print. The
 * broader document library (pool info, newsletters, forms) lives at /documents.
 */
export default async function MenuPage() {
  await requireProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description="Our lunch and dinner menus. Tap any page to enlarge."
        action={
          <a
            href="/menu/menu.pdf"
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline"
          >
            Download PDF
          </a>
        }
      />

      <MenuView />

      <p className="text-sm text-muted">
        Looking for pool info, newsletters, or forms?{" "}
        <Link
          href="/documents"
          className="font-medium text-primary hover:underline"
        >
          Browse all documents →
        </Link>
      </p>
    </div>
  );
}
