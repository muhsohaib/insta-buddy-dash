import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import spec from "../../../../docs/openapi.json" with { type: "json" };

type PathItem = Record<string, { operationId?: string; summary?: string; tags?: string[] }>;
const METHODS = ["get", "post", "patch", "put", "delete"] as const;

export default defineTool({
  name: "list_endpoints",
  title: "List API endpoints",
  description:
    "List every endpoint in this workspace's public REST API (generated live from /openapi.json). Optionally filter by keyword against path, operationId, summary, or tag.",
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe("Optional case-insensitive substring filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query }) => {
    const q = (query ?? "").trim().toLowerCase();
    const rows: Array<{
      method: string;
      path: string;
      operationId?: string;
      summary?: string;
      tags?: string[];
    }> = [];
    for (const [path, item] of Object.entries(spec.paths as Record<string, PathItem>)) {
      for (const m of METHODS) {
        const op = (item as PathItem)[m];
        if (!op) continue;
        const hay = `${m} ${path} ${op.operationId ?? ""} ${op.summary ?? ""} ${(op.tags ?? []).join(" ")}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        rows.push({
          method: m.toUpperCase(),
          path,
          operationId: op.operationId,
          summary: op.summary,
          tags: op.tags,
        });
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ count: rows.length, endpoints: rows }, null, 2) }],
      structuredContent: { count: rows.length, endpoints: rows },
    };
  },
});
