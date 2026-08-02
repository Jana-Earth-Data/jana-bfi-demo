"use client";

/**
 * Evidence attachments panel (P31).
 *
 * Drops in below any remarks-style textarea across the platform so the
 * officer can attach the source PDF / image / Word doc that justifies
 * whatever they wrote. Each panel is keyed by
 * (entity_type, entity_id, field_key) — the API routes handle the
 * tenant scoping.
 *
 * Renders:
 *   - "Attachments (<n>)" heading
 *   - One row per existing file (filename · size · uploader · time · Download · X)
 *   - "Add file" native picker (multiple)
 *   - Inline error state (too large, network failure)
 *   - Empty state ("No attachments · Click Add file to upload evidence")
 *
 * When `readOnly` is set, Add + Delete are hidden but Download stays.
 * `compact` tightens the spacing for inline row-level uses (CAP items,
 * PCAF rows).
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export type EvidenceEntityType =
  | "esdd"
  | "cap_item"
  | "covenant"
  | "monitoring_report"
  | "pcaf_availability"
  | "pf_screening";

type Attachment = {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
};

export type EvidenceAttachmentsProps = {
  entityType: EvidenceEntityType;
  entityId: string;
  fieldKey: string;
  readOnly?: boolean;
  label?: string;
  compact?: boolean;
  onCountChange?: (n: number) => void;
};

export function EvidenceAttachments({
  entityType,
  entityId,
  fieldKey,
  readOnly = false,
  label = "Attachments",
  compact = false,
  onCountChange,
}: EvidenceAttachmentsProps) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Notify parent of count changes. Runs after items settle so a mid-flight
  // fetch doesn't briefly report 0.
  useEffect(() => {
    if (!loading) onCountChange?.(items.length);
  }, [items.length, loading, onCountChange]);

  const refresh = useCallback(async () => {
    if (!entityId) return;
    try {
      setError(null);
      const url = `/api/evidence?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}&field_key=${encodeURIComponent(fieldKey)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Server returned ${res.status}`);
        return;
      }
      const body = (await res.json()) as {
        attachments: Attachment[];
      };
      setItems(body.attachments ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, fieldKey]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE_BYTES) {
          setError(
            `"${file.name}" exceeds 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
          );
          continue;
        }
        const form = new FormData();
        form.append("entity_type", entityType);
        form.append("entity_id", entityId);
        form.append("field_key", fieldKey);
        form.append("file", file);
        const res = await fetch("/api/evidence", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Upload failed (${res.status})`);
          break;
        }
        const body = (await res.json()) as { attachment: Attachment };
        setItems((prev) => [...prev, body.attachment]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/evidence/${encodeURIComponent(pendingDelete.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Delete failed (${res.status})`);
        return;
      }
      setItems((prev) => prev.filter((a) => a.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const wrapPad = compact ? "mt-2" : "mt-3";
  const headingSize = compact ? "text-[10px]" : "text-xs";
  const rowPad = compact ? "py-1" : "py-1.5";

  return (
    <div className={wrapPad}>
      <div className="flex items-center justify-between gap-2">
        <div
          className={`flex items-center gap-1.5 ${headingSize} uppercase tracking-wide text-slate-500`}
        >
          <PaperclipIcon />
          <span>{label}</span>
          {items.length > 0 && (
            <span className="rounded-full border border-line bg-panel px-1.5 py-[1px] text-[10px] normal-case text-slate-300">
              {items.length}
            </span>
          )}
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-slate-200 hover:bg-line/30 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <SpinnerIcon /> Uploading…
                </>
              ) : (
                <>
                  <PlusIcon /> Add file
                </>
              )}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className={`mt-1 ${headingSize} text-slate-500`}>
          Loading attachments…
        </div>
      ) : items.length === 0 ? (
        <div className={`mt-1 ${headingSize} text-slate-500 normal-case`}>
          {readOnly
            ? "No attachments on file."
            : "No attachments · Click Add file to upload evidence."}
        </div>
      ) : (
        <ul className="mt-1 flex flex-col divide-y divide-line/50 rounded-md border border-line/60 bg-panel/40">
          {items.map((a) => (
            <li
              key={a.id}
              className={`flex items-center justify-between gap-3 px-2 ${rowPad} text-[11px]`}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-slate-100"
                  title={a.filename}
                >
                  {a.filename}
                </div>
                <div className="text-[10px] text-slate-500">
                  {formatSize(a.size_bytes)}
                  {" · "}
                  {a.uploaded_by_name ?? "Unknown officer"}
                  {" · "}
                  {formatRelative(a.uploaded_at)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/api/evidence/${encodeURIComponent(a.id)}/download`}
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-0.5 text-[10px] text-slate-200 hover:bg-line/30"
                  title="Download"
                >
                  <DownloadIcon />
                  <span className="hidden sm:inline">Download</span>
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(a)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-panel text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                    title="Delete"
                    aria-label={`Delete ${a.filename}`}
                  >
                    <XIcon />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-1 text-[11px] text-rose-300">{error}</div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(2,6,23,0.85)" }}
          onClick={() => (deleting ? undefined : setPendingDelete(null))}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line p-6 shadow-2xl"
            style={{ backgroundColor: "#111827" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-wide text-rose-300">
              Delete attachment
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Remove &ldquo;{pendingDelete.filename}&rdquo;?
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              This permanently deletes the uploaded file. Other officers on
              this loan will no longer see it as supporting evidence.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="rounded-md border border-line bg-panel px-3 py-1.5 text-sm text-slate-200 hover:bg-line/30 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="rounded-md border border-rose-500/50 bg-rose-500/20 px-3 py-1.5 text-sm font-semibold text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete attachment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers — formatting + inline SVG icons (match the header.tsx pattern)
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function PaperclipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.98 8.83l-8.58 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
