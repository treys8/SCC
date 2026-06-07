"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { PostFormState } from "@/app/(app)/posts/actions";
import { SubmitButton } from "@/components/submit-button";
import { DEPARTMENTS } from "@/lib/constants";
import type { Post } from "@/lib/database.types";

type PostAction = (
  state: PostFormState,
  formData: FormData,
) => Promise<PostFormState>;

const INITIAL: PostFormState = {};

export function PostForm({
  action,
  post,
  submitLabel,
}: {
  action: PostAction;
  post?: Post;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="department">
            Department
          </label>
          <select
            id="department"
            name="department"
            className="select"
            defaultValue={post?.department ?? "general"}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            name="is_pinned"
            defaultChecked={post?.is_pinned ?? false}
            className="h-4 w-4 rounded border-border"
          />
          Pin to top of feed
        </label>
      </div>

      <div>
        <label className="label" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={post?.title ?? ""}
          className="input"
          placeholder="Summer golf tournament sign-ups open"
        />
      </div>

      <div>
        <label className="label" htmlFor="content">
          Content
        </label>
        <textarea
          id="content"
          name="content"
          required
          defaultValue={post?.content ?? ""}
          className="textarea min-h-40"
          placeholder="Write the announcement…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="image">
            Image {post?.image_url ? "(replace)" : "(optional)"}
          </label>
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            className="input"
          />
          {post?.image_url && (
            <label className="field-hint flex items-center gap-1.5">
              <input type="checkbox" name="remove_image" /> Remove current image
            </label>
          )}
        </div>
        <div>
          <label className="label" htmlFor="pdf">
            PDF {post?.pdf_url ? "(replace)" : "(optional)"}
          </label>
          <input
            id="pdf"
            name="pdf"
            type="file"
            accept="application/pdf"
            className="input"
          />
          {post?.pdf_url && (
            <label className="field-hint flex items-center gap-1.5">
              <input type="checkbox" name="remove_pdf" /> Remove current PDF
            </label>
          )}
        </div>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
        <Link href="/posts" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
