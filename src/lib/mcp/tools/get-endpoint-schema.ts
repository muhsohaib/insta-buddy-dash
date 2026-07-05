import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import spec from "../../../../docs/openapi.json" with { type: "json" };

const METHODS = ["get", "post", "patch", "put", "delete"] as const;
type Method = (typeof METHODS)[number];

// Resolve local $refs (e.g. "#/components/schemas/Post") into inline objects.
// Depth-limited so a self-referential schema can't blow the stack.
function resolveRefs(node: unknown, depth = 0): unknown {
  if (depth > 20 || node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => resolveRefs(n, depth + 1));
  const obj = node as Record<string, unknown>;
  const ref = obj.$ref;
  if (typeof ref === "string" && ref.startsWith("#/")) {
    const parts = ref.slice(2).split("/");
    let cur: unknown = spec;
    for (const p of parts) {
      if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[p];
      else return { $ref: ref };
    }
    return resolveRefs(cur, depth + 1);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = resolveRefs(v, depth + 1);
  return out;
}

export default defineTool({
  name: "get_endpoint_schema",
  title: "Get endpoint schema",
  description:
    "Return the OpenAPI schema for one endpoint (parameters, request body, and success response) with local $refs resolved. Use this before calling `invoke_endpoint`.",
  inputSchema: {
    method: z
      .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
      .describe("HTTP method."),
    path: z
      .string()
      .min(1)
      .describe("Path from `list_endpoints`, e.g. `/posts` or `/posts/{post_id}`."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ method, path }) => {
    const item = (spec.paths as Record<string, Record<string, unknown>>)[path];
    const op = item?.[method.toLowerCase() as Method] as
      | { parameters?: unknown; requestBody?: unknown; responses?: unknown; summary?: string; description?: string; operationId?: string }
      | undefined;
    if (!op) {
      return {
        content: [{ type: "text", text: `No endpoint ${method} ${path}` }],
        isError: true,
      };
    }
    const success =
      (op.responses as Record<string, unknown> | undefined)?.["200"] ??
      (op.responses as Record<string, unknown> | undefined)?.["201"] ??
      (op.responses as Record<string, unknown> | undefined)?.["204"];
    const out = {
      method,
      path,
      operationId: op.operationId,
      summary: op.summary,
      description: op.description,
      parameters: resolveRefs(op.parameters ?? []),
      requestBody: resolveRefs(op.requestBody ?? null),
      successResponse: resolveRefs(success ?? null),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      structuredContent: out,
    };
  },
});
