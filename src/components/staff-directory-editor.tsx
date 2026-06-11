"use client";

import { useRef, useState, useTransition } from "react";
import {
  deleteStaffMember,
  saveStaffMember,
} from "@/app/(app)/manage/directory/actions";
import { cn } from "@/lib/cn";
import { DEPARTMENTS } from "@/lib/constants";
import type { DepartmentType, StaffMember } from "@/lib/database.types";

/**
 * Staff editor for the member-facing directory. Each member is its own DB row,
 * so (unlike the facility detail-rows editor) every row owns its save/delete —
 * modelled as a small per-row component with its own pending state. The parent
 * only manages which rows are on screen (add a blank draft, drop a removed one).
 */
type RowItem = { key: string; initial: StaffMember | null };

export function StaffDirectoryEditor({ initial }: { initial: StaffMember[] }) {
  const nextKey = useRef(0);
  const [items, setItems] = useState<RowItem[]>(
    initial.map((m) => ({ key: `db-${m.id}`, initial: m })),
  );

  const addMember = () =>
    setItems((prev) => [
      ...prev,
      { key: `new-${nextKey.current++}`, initial: null },
    ]);

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((it) => it.key !== key));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-muted">
            No staff yet — add the first member below.
          </p>
        )}
        {items.map((it) => (
          <StaffRow
            key={it.key}
            initial={it.initial}
            onRemoved={() => removeItem(it.key)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={addMember}
        className="btn btn-outline btn-sm"
      >
        Add member
      </button>
    </div>
  );
}

function StaffRow({
  initial,
  onRemoved,
}: {
  initial: StaffMember | null;
  onRemoved: () => void;
}) {
  const [id, setId] = useState<string | null>(initial?.id ?? null);
  const [fullName, setFullName] = useState(initial?.full_name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [department, setDepartment] = useState<string>(
    initial?.department ?? "",
  );
  const [sortOrder, setSortOrder] = useState<string>(
    String(initial?.sort_order ?? 0),
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Any edit invalidates a prior "Saved" tick and clears a stale error.
  const edited = () => {
    setSaved(false);
    setError(null);
  };

  const save = () => {
    setError(null);
    if (!fullName.trim() || !title.trim()) {
      setError("Name and title are both required.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await saveStaffMember({
          id: id ?? undefined,
          full_name: fullName,
          title,
          email: email.trim() || null,
          phone: phone.trim() || null,
          department: (department || null) as DepartmentType | null,
          sort_order: Number(sortOrder) || 0,
        });
        setId(res.id);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  };

  const remove = () => {
    if (!id) {
      onRemoved(); // unsaved draft — just drop it
      return;
    }
    if (!confirm(`Remove ${fullName || "this staff member"}?`)) return;
    startTransition(async () => {
      try {
        await deleteStaffMember(id);
        onRemoved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove.");
      }
    });
  };

  return (
    <div className={cn("card p-4 sm:p-5", isPending && "opacity-70")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input
            className="input"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              edited();
            }}
            maxLength={80}
            placeholder="Full name"
          />
        </label>
        <label className="block">
          <span className="label">Title</span>
          <input
            className="input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              edited();
            }}
            maxLength={100}
            placeholder="e.g. Director of Golf"
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              edited();
            }}
            maxLength={120}
            placeholder="name@starkvillecc.org"
          />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input
            className="input"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              edited();
            }}
            maxLength={40}
            placeholder="Optional"
          />
        </label>
        <label className="block">
          <span className="label">Department</span>
          <select
            className="select"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              edited();
            }}
          >
            <option value="">— None —</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
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
            placeholder="0"
          />
        </label>
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="btn btn-primary btn-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          className="btn btn-outline btn-sm"
        >
          Remove
        </button>
        {saved && !isPending && (
          <span className="text-caption text-success">Saved</span>
        )}
      </div>
    </div>
  );
}
