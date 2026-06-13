"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLogEntry } from "@/app/(app)/manage/golf-log/actions";
import { cn } from "@/lib/cn";
import { uploadEventCover } from "@/lib/upload";
import type { GolfLogKind } from "@/lib/database.types";

// Common areas of the course/grounds — a quick optional tag, free-form "Other".
const AREAS = [
  "Greens",
  "Tees",
  "Fairways",
  "Bunkers",
  "Rough",
  "Irrigation",
  "Equipment",
  "Cart paths",
  "Grounds",
  "Other",
];

/**
 * The superintendent's entry form: log a "done" item or an "issue", an optional
 * area tag, a note, and an optional photo (phone camera or file). Photos upload
 * straight to Storage from the browser; only the URL reaches the Server Action.
 */
export function GolfLogComposer({ userId }: { userId: string }) {
  const [kind, setKind] = useState<GolfLogKind>("done");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function onPickPhoto(file: File) {
    setError(null);
    setUploading(true);
    try {
      const url = await uploadEventCover(file, userId);
      setPhotoUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setError(null);
    if (!note.trim()) {
      setError("Add a note.");
      return;
    }
    startTransition(async () => {
      try {
        await createLogEntry({
          kind,
          area: area || null,
          note,
          photoUrl,
        });
        setKind("done");
        setArea("");
        setNote("");
        setPhotoUrl(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  return (
    <div className="card space-y-4 p-5">
      {/* Done / Issue toggle */}
      <div className="inline-flex rounded-lg border border-border p-0.5">
        {(["done", "issue"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              kind === k
                ? k === "issue"
                  ? "bg-danger text-white"
                  : "bg-primary text-white"
                : "text-muted hover:text-foreground",
            )}
          >
            {k === "done" ? "Done" : "Issue"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="log-area" className="label">
            Area
          </label>
          <select
            id="log-area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="select"
          >
            <option value="">Optional…</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="log-note" className="label">
            {kind === "issue" ? "What's the issue?" : "What got done?"}
          </label>
          <textarea
            id="log-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              kind === "issue"
                ? "e.g. Pump #2 leaking at the irrigation shed."
                : "e.g. Verticut and topdressed greens 1–9."
            }
            className="textarea"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-outline btn-sm cursor-pointer">
          {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading || pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPickPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
        {photoUrl && (
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Attached"
              className="h-10 w-10 rounded object-cover"
            />
            <button
              type="button"
              onClick={() => setPhotoUrl(null)}
              className="text-sm text-muted hover:text-danger"
            >
              Remove
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || uploading}
          className="btn btn-primary btn-sm ml-auto"
        >
          {pending ? "Saving…" : "Log it"}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
