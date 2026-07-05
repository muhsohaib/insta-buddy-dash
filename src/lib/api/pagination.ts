// Cursor pagination helpers.  Cursor is opaque base64url of
// `${occurred_at_iso}|${id}` — stable and sortable, works for any
// (timestamp DESC, id DESC) ordering.
import { SpecError, type PageMeta } from "./envelope";

export type ParsedCursor = { ts: string; id: string };

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

export function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > MAX_LIMIT || Math.floor(n) !== n) {
    throw new SpecError("invalid_input", `limit must be an integer 1..${MAX_LIMIT}`, {
      limit: `must be 1..${MAX_LIMIT}`,
    });
  }
  return n;
}

export function encodeCursor(ts: string, id: string): string {
  const raw = `${ts}|${id}`;
  return typeof btoa === "function"
    ? btoa(raw).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
    : Buffer.from(raw).toString("base64url");
}

export function parseCursor(raw: string | null): ParsedCursor | null {
  if (!raw) return null;
  try {
    const decoded =
      typeof atob === "function"
        ? atob(raw.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(raw, "base64url").toString("utf8");
    const [ts, id] = decoded.split("|");
    if (!ts || !id) throw new Error("bad cursor");
    return { ts, id };
  } catch {
    throw new SpecError("invalid_input", "Malformed cursor", { cursor: "malformed" });
  }
}

// Given `limit+1` fetched rows, compute page meta + trim overflow.
export function paginate<T extends { id: string }>(
  rows: T[],
  limit: number,
  tsOf: (row: T) => string,
): { data: T[]; page: PageMeta } {
  if (rows.length <= limit) {
    return { data: rows, page: { has_more: false, next_cursor: null } };
  }
  const trimmed = rows.slice(0, limit);
  const last = trimmed[trimmed.length - 1];
  return {
    data: trimmed,
    page: { has_more: true, next_cursor: encodeCursor(tsOf(last), last.id) },
  };
}
