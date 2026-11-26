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
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.id} className="space-y-3">
          <h2 className="text-section text-foreground">{s.heading}</h2>
          {s.body.trim() && (
            <p className="text-body max-w-[62ch] break-words whitespace-pre-wrap text-foreground/85">
              {s.body}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
