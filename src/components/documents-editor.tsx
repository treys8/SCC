"use client";

import { type FormEvent, useRef, useState } from "react";
import {
  createDocument,
  deleteDocument,
  updateDocumentMeta,
} from "@/app/(app)/manage/documents/actions";
import { cn } from "@/lib/cn";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import { ACCEPT_ATTR, uploadDocumentFile, validateFile } from "@/lib/upload";
import type { DocumentCategory, DocumentRow } from "@/lib/database.types";

/**
 * Staff editor for the document library. New documents upload browser-direct to
 * the `documents` bucket (reusing the feed upload pipeline) and then persist
 * their metadata via a Server Action. Existing documents edit their title /
 * category / visibility / order in place. State is held client-side so the list
 * updates without a round-trip.
 */
export function DocumentsEditor({
  initial,
  userId,
}: {
  initial: DocumentRow[];
  userId: string;
}) {
  const [docs, setDocs] = useState<DocumentRow[]>(initial);

  return (
    <div className="space-y-8">
      <NewDocumentForm
        userId={userId}
        onCreated={(doc) => setDocs((prev) => [doc, ...prev])}
      />

      <section className="space-y-3">
        <h2 className="text-h2 text-foreground">Documents</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing uploaded yet — add the first document above.
          </p>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onDeleted={() =>
                  setDocs((prev) => prev.filter((d) => d.id !== doc.id))
                }
                onUpdated={(next) =>
                  setDocs((prev) =>
                    prev.map((d) => (d.id === next.id ? next : d)),
                  )
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NewDocumentForm({
  userId,
  onCreated,
}: {
  userId: string;
  onCreated: (doc: DocumentRow) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("menu");
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Give the document a title.");
      return;
    }
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    try {
      const meta = await uploadDocumentFile(file, userId);
      const doc = await createDocument({
        title,
        category,
        is_published: published,
        sort_order: 0,
        file: {
          url: meta.url,
          storage_path: meta.storage_path,
          file_name: meta.file_name,
          mime_type: meta.mime_type,
          size_bytes: meta.size_bytes,
        },
      });
      onCreated(doc);
      setTitle("");
      setCategory("menu");
      setPublished(true);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn("card space-y-4 p-5 sm:p-6", busy && "opacity-70")}
    >
      <h2 className="text-h2 text-foreground">Add a document</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Lunch Menu"
          />
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select
            className="select"
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">File (PDF or image, up to 25 MB)</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-700"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        Visible to members
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}

function DocCard({
  doc,
  onDeleted,
  onUpdated,
}: {
  doc: DocumentRow;
  onDeleted: () => void;
  onUpdated: (doc: DocumentRow) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState<DocumentCategory>(doc.category);
  const [published, setPublished] = useState(doc.is_published);
  const [sortOrder, setSortOrder] = useState(String(doc.sort_order));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edited = () => {
    setSaved(false);
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    const sort = Number(sortOrder) || 0;
    setBusy(true);
    try {
      await updateDocumentMeta({
        id: doc.id,
        title,
        category,
        is_published: published,
        sort_order: sort,
      });
      onUpdated({
        ...doc,
        title: title.trim(),
        category,
        is_published: published,
        sort_order: sort,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${doc.title}"? This removes it for members.`)) return;
    setBusy(true);
    try {
      await deleteDocument(doc.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setBusy(false);
    }
  };

  const size = formatFileSize(doc.size_bytes);

  return (
    <div className={cn("card space-y-3 p-4 sm:p-5", busy && "opacity-70")}>
      <a
        href={doc.file_url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5 transition-colors hover:bg-background"
      >
        <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-foreground/10 text-2xs font-bold text-muted">
          {fileExt(doc.file_name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {doc.file_name ?? "File"}
          </span>
          {size && <span className="block text-caption text-muted">{size}</span>}
        </span>
        <span aria-hidden className="pr-1 text-muted">
          ↓
        </span>
      </a>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              edited();
            }}
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select
            className="select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as DocumentCategory);
              edited();
            }}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Sort order</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value);
              edited();
            }}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => {
            setPublished(e.target.checked);
            edited();
          }}
          className="h-4 w-4 accent-[var(--primary)]"
        />
        Visible to members
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="btn btn-outline btn-sm"
        >
          Delete
        </button>
        {saved && !busy && (
          <span className="text-caption text-success">Saved</span>
        )}
      </div>
    </div>
  );
}

function fileExt(name: string | null): string {
  if (name && name.includes(".")) {
    return name.split(".").pop()!.toUpperCase().slice(0, 4);
  }
  return "FILE";
}
