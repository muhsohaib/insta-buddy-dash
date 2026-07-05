import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Invokes any endpoint in the live public API by fanning out to the same-origin
// `/api/public/v1/*` handler. Auth uses a workspace API key (sk_live_... or
// sk_test_...) that the caller supplies as `api_key`, or falls back to the
// MCP_API_KEY env var when configured for the workspace.
//
// This keeps the MCP surface fully driven by the live openapi.json — every new
// endpoint added to the API becomes callable through this tool automatically,
// with no server code change.

function apiBase(): string {
  // In the Worker runtime, prefer the request-derived origin (SITE_URL), then
  // fall back to the published URL, then to a stable dev URL.
  const site = process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL;
  if (site) return site.replace(/\/+$/, "") + "/api/public/v1";
  const pub = process.env.PUBLISHED_URL;
  if (pub) return pub.replace(/\/+$/, "") + "/api/public/v1";
  return "http://localhost:8080/api/public/v1";
}

function interpolatePath(path: string, pathParams: Record<string, string | number>): string {
  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    const v = pathParams[name];
    if (v === undefined || v === null || v === "") {
      throw new Error(`Missing path parameter: ${name}`);
    }
    return encodeURIComponent(String(v));
  });
}

export default defineTool({
  name: "invoke_endpoint",
  title: "Invoke API endpoint",
  description:
    "Call any endpoint in this workspace's public REST API. Discover endpoints with `list_endpoints` and their parameter/body shapes with `get_endpoint_schema` first, then invoke here. Requires a workspace API key (sk_live_... or sk_test_...) as `api_key` unless the server has MCP_API_KEY configured.",
  inputSchema: {
    method: z
      .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
      .describe("HTTP method."),
    path: z
      .string()
      .min(1)
      .describe("Path template from `list_endpoints`, e.g. `/posts` or `/posts/{post_id}`."),
    path_params: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .optional()
      .describe("Values for `{placeholders}` in the path."),
    query: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]))
      .optional()
      .describe("Query parameters."),
    body: z
      .unknown()
      .optional()
      .describe("Request body (sent as JSON)."),
    api_key: z
      .string()
      .min(10)
      .optional()
      .describe("Workspace API key. Omit to use the server-configured MCP_API_KEY."),
    idempotency_key: z
      .string()
      .min(16)
      .max(255)
      .optional()
      .describe("Optional Idempotency-Key for safe retries on mutating calls."),
  },
  annotations: { openWorldHint: true },
  handler: async (input, _ctx: ToolContext) => {
    const {
      method,
      path,
      path_params = {},
      query = {},
      body,
      api_key,
      idempotency_key,
    } = input;

    const key = api_key ?? process.env.MCP_API_KEY;
    if (!key) {
      return {
        content: [
          {
            type: "text",
            text: "Missing api_key. Pass a workspace API key (sk_live_... / sk_test_...) or set MCP_API_KEY on the server.",
          },
        ],
        isError: true,
      };
    }

    let url: URL;
    try {
      url = new URL(apiBase() + interpolatePath(path, path_params));
    } catch (e) {
      return { content: [{ type: "text", text: (e as Error).message }], isError: true };
    }
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item));
      else url.searchParams.append(k, String(v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    };
    let payload: BodyInit | undefined;
    if (body !== undefined && method !== "GET") {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (idempotency_key) headers["Idempotency-Key"] = idempotency_key;

    let resp: Response;
    try {
      resp = await fetch(url.toString(), { method, headers, body: payload });
    } catch (e) {
      return {
        content: [{ type: "text", text: `Network error: ${(e as Error).message}` }],
        isError: true,
      };
    }

    const text = await resp.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* keep as text */
    }
    const requestId = resp.headers.get("x-request-id") ?? undefined;
    const result = { status: resp.status, requestId, body: parsed };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: !resp.ok,
    };
  },
});
