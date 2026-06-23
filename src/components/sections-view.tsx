import type { PageSection } from "@/lib/database.types";

/**
 * Member-facing render of a page's published sections — a heading + free-text
 * body each. Body uses the house convention (`whitespace-pre-wrap`, no markdown)
 * so staff line breaks display as written. Empty-bodied sections show the heading
 * alone (useful as a simple labelled divider). Renders nothing when there are no
 * sections so the caller can decide the surrounding layout.
 */
export function SectionsView({ sections }: { sections: PageSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-6">
      {sections.map((s) => (
        <section key={s.id} className="space-y-2">
          <h2 className="text-h2 text-foreground">{s.heading}</h2>
          {s.body.trim() && (
            <p className="whitespace-pre-wrap break-words text-body text-foreground/90">
              {s.body}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
