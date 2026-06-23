"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addSection,
  deleteSection,
  moveSection,
  saveSection,
} from "@/app/(app)/manage/section-actions";
import type { PageSection, SectionPage } from "@/lib/database.types";

/**
 * Staff editor for one page's sections (Dining or Pool). Each section is a card
 * with an inline heading, a free-text body, a publish toggle, reorder arrows, and
 * delete. Mutations run as Server Actions through a transition, then `refresh()`
 * pulls the new server-rendered order/content back. Reused verbatim by both
 * /manage/dining and /manage/pool.
 */
export function SectionsEditor({
  page,
  sections,
}: {
  page: SectionPage;
  sections: PageSection[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className="text-sm text-muted">
          No sections yet. Add one to start building this page.
        </p>
      )}
      {sections.map((section, i) => (
        <SectionRow
          key={section.id}
          section={section}
          page={page}
          isFirst={i === 0}
          isLast={i === sections.length - 1}
          disabled={isPending}
          run={run}
        />
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={isPending}
        onClick={() => run(() => addSection(page))}
      >
        + Add section
      </button>
    </div>
  );
}

function SectionRow({
  section,
  page,
  isFirst,
  isLast,
  disabled,
  run,
}: {
  section: PageSection;
  page: SectionPage;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [published, setPublished] = useState(section.is_published);

  const dirty =
    heading !== section.heading ||
    body !== section.body ||
    published !== section.is_published;

  return (
    <div className="card space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1"
          value={heading}
          onChange={(e) => setHeading(e.target.value)}
          placeholder="Section heading"
          maxLength={80}
          disabled={disabled}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Move up"
          disabled={disabled || isFirst}
          onClick={() => run(() => moveSection(section.id, page, "up"))}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="Move down"
          disabled={disabled || isLast}
          onClick={() => run(() => moveSection(section.id, page, "down"))}
        >
          ↓
        </button>
      </div>

      <textarea
        className="textarea"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Hours, rules, details… line breaks are kept."
        maxLength={4000}
        disabled={disabled}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            disabled={disabled}
          />
          Published
        </label>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled || !dirty}
          onClick={() =>
            run(() =>
              saveSection({
                id: section.id,
                page,
                heading,
                body,
                is_published: published,
              }),
            )
          }
        >
          {dirty ? "Save" : "Saved"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm ml-auto text-danger"
          disabled={disabled}
          onClick={() => {
            if (confirm("Delete this section?")) {
              run(() => deleteSection(section.id, page));
            }
          }}
        >
          Delete
        </button>
      </div>

      {!published && (
        <p className="text-caption text-muted">
          Draft — members don’t see this section yet.
        </p>
      )}
    </div>
  );
}
