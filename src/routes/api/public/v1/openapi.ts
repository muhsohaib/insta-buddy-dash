import { createFileRoute } from "@tanstack/react-router";

// GET /api/public/v1/openapi.json  — minimal machine-readable spec.
// Kept intentionally hand-written to stay dependency-free.
export const Route = createFileRoute("/api/public/v1/openapi")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const spec = {
          openapi: "3.1.0",
          info: {
            title: "Loomly Public API",
            version: "1.0.0",
            description:
              "REST access to the Loomly Order Management System. Every request is authenticated with either a Clerk session JWT (browser) or an opaque workspace API key issued in Settings → API Keys. All calls are scoped to the caller's workspace (Clerk Organization).",
          },
          servers: [{ url: `${origin}/api/public/v1` }],
          components: {
            securitySchemes: {
              bearer: { type: "http", scheme: "bearer" },
            },
          },
          security: [{ bearer: [] }],
          paths: {
            "/products": {
              get: { summary: "List active products", responses: { "200": { description: "OK" } } },
            },
            "/orders": {
              get: { summary: "List workspace orders", responses: { "200": { description: "OK" } } },
              post: {
                summary: "Create an order and start checkout",
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { quantity: { type: "integer", minimum: 1, maximum: 50 } },
                        required: ["quantity"],
                      },
                    },
                  },
                },
                responses: { "201": { description: "Created" } },
              },
            },
            "/orders/{id}": {
              get: {
                summary: "Get one order with items, details and deliverables",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
            },
            "/orders/{id}/status": {
              get: {
                summary: "Lightweight order status for polling",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
            },
            "/orders/{id}/details": {
              post: {
                summary: "Submit per-item details after payment",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          submit: { type: "boolean", default: true },
                          items: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                order_item_id: { type: "string", format: "uuid" },
                                data: { type: "object" },
                              },
                              required: ["order_item_id", "data"],
                            },
                          },
                        },
                        required: ["items"],
                      },
                    },
                  },
                },
                responses: { "200": { description: "OK" } },
              },
            },
            "/orders/{id}/deliverables": {
              get: {
                summary: "Fetch delivered Instagram account credentials",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
            },
            "/publications": {
              get: {
                summary: "List publications in the workspace (filter by from/to/status/account_id)",
                parameters: [
                  { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
                  { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
                  { name: "status", in: "query", schema: { type: "string" } },
                  { name: "account_id", in: "query", schema: { type: "string", format: "uuid" } },
                ],
                responses: { "200": { description: "OK" } },
              },
              post: {
                summary: "Create a scheduled publication",
                requestBody: {
                  required: true,
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        required: ["account_id", "scheduled_at", "media"],
                        properties: {
                          account_id: { type: "string", format: "uuid" },
                          type: { type: "string", enum: ["reel", "image", "carousel", "video"] },
                          caption: { type: "string", maxLength: 2200 },
                          hashtags: { type: "array", items: { type: "string" } },
                          scheduled_at: { type: "string", format: "date-time" },
                          notes: { type: "string" },
                          status: { type: "string", enum: ["draft", "scheduled"] },
                          media: {
                            type: "array",
                            minItems: 1,
                            items: {
                              type: "object",
                              required: ["kind"],
                              properties: {
                                kind: { type: "string", enum: ["video", "image"] },
                                bunny_video_id: { type: "string" },
                                bunny_library_id: { type: "string" },
                                thumbnail_url: { type: "string" },
                                image_url: { type: "string" },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                responses: { "201": { description: "Created" } },
              },
            },
            "/publications/{id}": {
              get: {
                summary: "Fetch a publication with media",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
              patch: {
                summary: "Update caption, schedule, status or hashtags",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
              delete: {
                summary: "Delete a draft or scheduled publication",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
            },
            "/publications/{id}/publish": {
              post: {
                summary: "Mark a publication as published (records Instagram URL)",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "OK" } },
              },
            },
            "/calendar": {
              get: {
                summary: "List publications grouped by day for a date range",
                parameters: [
                  { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
                  { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
                ],
                responses: { "200": { description: "OK" } },
              },
            },

          },
        };
        return new Response(JSON.stringify(spec, null, 2), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
