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
                operationId: "listPublications",
                summary: "List publications in the workspace",
                description:
                  "Returns publications for the authenticated workspace. Filter by scheduled date range, status, or Instagram account.",
                parameters: [
                  { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
                  { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
                  {
                    name: "status",
                    in: "query",
                    schema: {
                      type: "string",
                      enum: [
                        "draft",
                        "scheduled",
                        "ready_for_publishing",
                        "publishing",
                        "published",
                        "failed",
                      ],
                    },
                  },
                  { name: "account_id", in: "query", schema: { type: "string", format: "uuid" } },
                ],
                responses: {
                  "200": { description: "List of publications" },
                  "401": { description: "Unauthorized" },
                },
              },
              post: {
                operationId: "createPublication",
                summary: "Create a scheduled publication",
                description:
                  "Creates a publication that appears immediately on the calendar. Identical result whether called by the web app or an AI agent.",
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
                      example: {
                        account_id: "00000000-0000-0000-0000-000000000000",
                        type: "reel",
                        caption: "New drop today",
                        hashtags: ["fashion", "drop"],
                        scheduled_at: "2026-07-04T15:00:00Z",
                        media: [{ kind: "video", bunny_video_id: "abc", bunny_library_id: "123" }],
                      },
                    },
                  },
                },
                responses: {
                  "201": { description: "Publication created" },
                  "400": { description: "Invalid input" },
                  "401": { description: "Unauthorized" },
                },
              },
            },
            "/publications/{id}": {
              get: {
                operationId: "getPublication",
                summary: "Fetch a publication with media",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "OK" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
              patch: {
                operationId: "updatePublication",
                summary: "Update caption, schedule, status or hashtags",
                description:
                  "Partial update. Dragging a publication on the calendar sends `scheduled_at`. Publications already `publishing` or `published` are locked except for status transitions.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          caption: { type: "string", maxLength: 2200 },
                          hashtags: { type: "array", items: { type: "string" } },
                          scheduled_at: { type: "string", format: "date-time" },
                          notes: { type: "string" },
                          status: {
                            type: "string",
                            enum: [
                              "draft",
                              "scheduled",
                              "ready_for_publishing",
                              "publishing",
                              "published",
                              "failed",
                            ],
                          },
                          instagram_post_url: { type: "string" },
                          failure_reason: { type: "string" },
                        },
                      },
                      example: { scheduled_at: "2026-07-05T18:00:00Z" },
                    },
                  },
                },
                responses: {
                  "200": { description: "Updated publication" },
                  "400": { description: "Invalid input or publication locked" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
              delete: {
                operationId: "deletePublication",
                summary: "Delete a draft or scheduled publication",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Deleted" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
            },
            "/publications/{id}/status": {
              get: {
                operationId: "getPublicationStatus",
                summary: "Lightweight publication status for polling",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Status snapshot" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
            },
            "/publications/{id}/publish": {
              post: {
                operationId: "publishPublication",
                summary: "Mark a publication as published",
                description: "Records the Instagram permalink and moves the publication to `published`.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                requestBody: {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: { instagram_post_url: { type: "string" } },
                      },
                      example: { instagram_post_url: "https://instagram.com/p/abc123" },
                    },
                  },
                },
                responses: {
                  "200": { description: "Published" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
            },
            "/publications/{id}/cancel": {
              post: {
                operationId: "cancelPublication",
                summary: "Cancel a draft or scheduled publication",
                description:
                  "Removes a publication that has not started publishing from the calendar and records a cancellation event.",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Cancelled" },
                  "400": { description: "Publication is already publishing or published" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
            },
            "/calendar": {
              get: {
                operationId: "getCalendar",
                summary: "List publications grouped by day",
                parameters: [
                  { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
                  { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
                ],
                responses: {
                  "200": { description: "Publications keyed by ISO date" },
                  "401": { description: "Unauthorized" },
                },
              },
            },
            "/accounts": {
              get: {
                operationId: "listAccounts",
                summary: "List Instagram accounts in the workspace",
                description:
                  "Resource discovery: returns every Instagram account belonging to the authenticated workspace. Use the returned `id` as `account_id` when calling POST /publications.",
                responses: {
                  "200": {
                    description: "List of accounts",
                    content: {
                      "application/json": {
                        example: {
                          data: [
                            {
                              id: "00000000-0000-0000-0000-000000000000",
                              username: "brand.official",
                              display_name: "Brand",
                              niche: "fashion",
                              status: "ready",
                              profile_picture_url: "https://…/photo.jpg",
                              created_at: "2026-01-01T00:00:00Z",
                            },
                          ],
                        },
                      },
                    },
                  },
                  "401": { description: "Unauthorized" },
                },
              },
            },
            "/accounts/{id}": {
              get: {
                operationId: "getAccount",
                summary: "Fetch one Instagram account",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": {
                    description: "Account",
                    content: {
                      "application/json": {
                        example: {
                          data: {
                            id: "00000000-0000-0000-0000-000000000000",
                            username: "brand.official",
                            display_name: "Brand",
                            niche: "fashion",
                            status: "ready",
                            profile_picture_url: "https://…/photo.jpg",
                            created_at: "2026-01-01T00:00:00Z",
                          },
                        },
                      },
                    },
                  },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
              },
            },
            "/media": {
              get: {
                operationId: "listMedia",
                summary: "List uploaded media assets in the workspace",
                description:
                  "Resource discovery: returns every media asset (video or image) available to the authenticated workspace. Use `bunny_video_id` + `bunny_library_id` (videos) or `image_url` (images) when supplying `media` to POST /publications.",
                responses: {
                  "200": {
                    description: "List of media assets",
                    content: {
                      "application/json": {
                        example: {
                          data: [
                            {
                              id: "11111111-1111-1111-1111-111111111111",
                              filename: null,
                              media_type: "video",
                              thumbnail_url: "https://…/thumb.jpg",
                              bunny_video_id: "abc123",
                              bunny_library_id: "555",
                              image_url: null,
                              duration: null,
                              uploaded_at: "2026-06-15T12:00:00Z",
                            },
                          ],
                        },
                      },
                    },
                  },
                  "401": { description: "Unauthorized" },
                },
              },
            },
            "/media/{id}": {
              get: {
                operationId: "getMedia",
                summary: "Fetch one media asset",
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: {
                  "200": { description: "Media asset" },
                  "401": { description: "Unauthorized" },
                  "404": { description: "Not found" },
                },
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
