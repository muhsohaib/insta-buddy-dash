// Regression tests for publications.core lifecycle handling.
// The original bug: cancelling a publication deleted the row, so subsequent
// GET /publications/{id}/status calls threw "Publication not found" and
// bubbled up as HTTP 500. Cancel is now a soft transition and every lifecycle
// state — including cancelled — must remain retrievable via getPublicationStatusCore.
import { describe, it, expect, beforeEach } from "vitest";
import {
  cancelPublicationCore,
  getPublicationStatusCore,
  listPublicationsInRangeCore,
  updatePublicationCore,
  type PubCtx,
  type PublicationStatus,
} from "./publications.core";

type Row = Record<string, unknown> & { id: string; org_id: string; status: PublicationStatus };

// Minimal in-memory Supabase stub: enough to back the two tables this suite
// touches (publications + publication_events). Chainable, awaitable.
function makeSupabase(seed: Row[]) {
  const tables: Record<string, Row[]> = {
    publications: [...seed],
    publication_events: [],
    instagram_accounts: [],
  };

  function from(name: string) {
    let rows = () => tables[name] ?? (tables[name] = []);
    let filters: Array<(r: Row) => boolean> = [];
    let mode: "select" | "update" | "insert" | "delete" = "select";
    let updatePatch: Partial<Row> | null = null;
    let insertPayload: Row[] = [];
    let single = false;
    let maybeSingle = false;

    const q: any = {
      select() { mode = "select"; return q; },
      insert(payload: Row | Row[]) {
        mode = "insert";
        insertPayload = Array.isArray(payload) ? payload : [payload];
        return q;
      },
      update(patch: Partial<Row>) { mode = "update"; updatePatch = patch; return q; },
      delete() { mode = "delete"; return q; },
      eq(col: string, val: unknown) { filters.push((r) => r[col] === val); return q; },
      neq(col: string, val: unknown) { filters.push((r) => r[col] !== val); return q; },
      gte() { return q; },
      lte() { return q; },
      order() { return q; },
      single() { single = true; return q; },
      maybeSingle() { maybeSingle = true; return q; },
      then(onFulfilled: (v: unknown) => unknown) {
        const matches = () => rows().filter((r) => filters.every((f) => f(r)));
        let result: unknown;
        if (mode === "insert") {
          const withIds = insertPayload.map((r, i) => ({
            ...r,
            id: (r.id as string) ?? `gen-${name}-${rows().length + i}`,
          })) as Row[];
          rows().push(...withIds);
          result = { data: single ? withIds[0] : withIds, error: null };
        } else if (mode === "update") {
          const m = matches();
          for (const r of m) Object.assign(r, updatePatch);
          result = { data: single ? m[0] ?? null : m, error: null };
        } else if (mode === "delete") {
          const m = matches();
          tables[name] = rows().filter((r) => !m.includes(r));
          result = { data: null, error: null };
        } else {
          const m = matches();
          const one = single ? m[0] : maybeSingle ? m[0] ?? null : m;
          result = { data: one, error: null };
        }
        return Promise.resolve(result).then(onFulfilled);
      },
    };
    return q;
  }
  return { from, _tables: tables };
}

function ctx(supabase: unknown, orgId = "org_1"): PubCtx {
  return { supabase: supabase as never, orgId, userId: "user_1", actor: "user" };
}

const ALL_STATES: PublicationStatus[] = [
  "draft",
  "scheduled",
  "ready_for_publishing",
  "publishing",
  "published",
  "failed",
  "cancelled",
];

describe("publications.core lifecycle", () => {
  let supa: ReturnType<typeof makeSupabase>;
  const seedFor = (status: PublicationStatus): Row => ({
    id: `pub_${status}`,
    org_id: "org_1",
    account_id: "acc_1",
    status,
    scheduled_at: "2026-07-04T10:00:00Z",
    published_at: null,
    instagram_post_url: null,
    failure_reason: null,
    updated_at: "2026-07-04T09:00:00Z",
  });

  beforeEach(() => {
    supa = makeSupabase(ALL_STATES.map(seedFor));
  });

  it.each(ALL_STATES)("getPublicationStatusCore returns %s publications", async (status) => {
    const res = await getPublicationStatusCore(ctx(supa), `pub_${status}`);
    expect(res.status).toBe(status);
  });

  it("cancel soft-transitions to 'cancelled' instead of deleting (regression)", async () => {
    const before = supa._tables.publications.find((r) => r.id === "pub_scheduled");
    expect(before?.status).toBe("scheduled");

    await cancelPublicationCore(ctx(supa), "pub_scheduled");

    // Row still exists and is queryable — this was the failure mode.
    const status = await getPublicationStatusCore(ctx(supa), "pub_scheduled");
    expect(status.status).toBe("cancelled");
  });

  it("cancel refuses to touch publishing/published rows", async () => {
    await expect(cancelPublicationCore(ctx(supa), "pub_publishing")).rejects.toThrow();
    await expect(cancelPublicationCore(ctx(supa), "pub_published")).rejects.toThrow();
  });

  it("cancelled rows are hidden from the default calendar listing", async () => {
    const rows = await listPublicationsInRangeCore(ctx(supa));
    expect(rows.map((r) => r.status)).not.toContain("cancelled");
  });

  it("cancelled rows show up when explicitly filtered", async () => {
    const rows = await listPublicationsInRangeCore(ctx(supa), { status: "cancelled" });
    expect(rows).toHaveLength(1);
  });

  it("cancelled rows are locked from further edits", async () => {
    await expect(
      updatePublicationCore(ctx(supa), "pub_cancelled", { caption: "nope" }),
    ).rejects.toThrow(/locked/);
  });
});
