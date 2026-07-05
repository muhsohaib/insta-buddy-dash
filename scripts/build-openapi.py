#!/usr/bin/env python3
"""
Insta Buddy — Phase 6
Builds the production OpenAPI 3.1 specification from the frozen Phase 1–5 architecture.
Emits docs/openapi.json and docs/openapi.yaml (identical content, two formats).

This file is the *builder*, not the source of truth. The source of truth is
the emitted openapi.json/openapi.yaml.
"""
from __future__ import annotations
import json, os, sys
from collections import OrderedDict

try:
    import yaml
except ImportError:
    print("pip install pyyaml", file=sys.stderr); sys.exit(1)

# ---------- helpers ----------------------------------------------------------

def ref(name: str) -> dict:      return {"$ref": f"#/components/schemas/{name}"}
def pref(name: str) -> dict:     return {"$ref": f"#/components/parameters/{name}"}
def rref(name: str) -> dict:     return {"$ref": f"#/components/responses/{name}"}
def exref(name: str) -> dict:    return {"$ref": f"#/components/examples/{name}"}
def hdref(name: str) -> dict:    return {"$ref": f"#/components/headers/{name}"}

STD_ERROR_RESPONSES = {
    "400": rref("ValidationError"),
    "401": rref("Unauthorized"),
    "403": rref("Forbidden"),
    "404": rref("NotFound"),
    "409": rref("Conflict"),
    "429": rref("RateLimited"),
    "500": rref("InternalError"),
}
STD_HEADERS = {
    "X-Request-Id":         hdref("XRequestId"),
    "X-RateLimit-Limit":    hdref("XRateLimitLimit"),
    "X-RateLimit-Remaining":hdref("XRateLimitRemaining"),
    "X-RateLimit-Reset":    hdref("XRateLimitReset"),
}

FOUR_PART = """### What
{what}

### When to use
{when}

### Before / After
- **Before:** {before}
- **After:** {after}

### Notes
{notes}"""

def desc(what, when, before, after, notes="Idempotency-Key accepted on all mutating requests. Cross-workspace access returns `not_found`, never `forbidden`."):
    return FOUR_PART.format(what=what, when=when, before=before, after=after, notes=notes)

# ---------- info / servers / security ---------------------------------------

INFO = {
    "title": "Insta Buddy API",
    "version": "1.0.0",
    "summary": "Plan, publish and manage social content across every account you own or buy.",
    "description": (
        "The Insta Buddy API is the single programmable surface behind the web app, "
        "the MCP server, the SDKs and the CLI. Every resource here maps 1:1 to a page "
        "in the product (Phase 3) and to a business workflow (Phase 2).\n\n"
        "Auth: `Authorization: Bearer <api-key>`. Every request is scoped to exactly "
        "one Workspace, resolved from the key. Cursor pagination, one filter grammar, "
        "one error envelope. Additive changes ship on `/v1`; breaking changes ship on `/v2`."
    ),
    "termsOfService": "https://insta-buddy-dash.lovable.app/terms",
    "contact": {"name": "Insta Buddy Support", "url": "https://insta-buddy-dash.lovable.app/support", "email": "support@insta-buddy.example"},
    "license": {"name": "Proprietary", "url": "https://insta-buddy-dash.lovable.app/license"},
    "x-api-id": "insta-buddy-v1",
    "x-audience": "public",
    "x-logo": {"url": "https://insta-buddy-dash.lovable.app/logo.png", "altText": "Insta Buddy"},
}

SERVERS = [
    {"url": "https://insta-buddy-dash.lovable.app/api/public/v1", "description": "Production"},
    {"url": "https://project--190b66d0-cf30-4890-bfc6-0adc64a23313-dev.lovable.app/api/public/v1", "description": "Preview"},
]

SECURITY = [{"ApiKeyAuth": []}]

# ---------- tags -------------------------------------------------------------

TAGS = [
    {"name": "Posts",         "description": "Plan, schedule, publish and manage content."},
    {"name": "Assets",        "description": "Upload and manage the media used by posts."},
    {"name": "Accounts",      "description": "Connect and manage the social accounts posts publish to."},
    {"name": "Products",      "description": "Browse purchasable offerings in the Store catalog."},
    {"name": "Orders",        "description": "Create and track Store purchases."},
    {"name": "Deliveries",    "description": "Receive and manage handed-over accounts."},
    {"name": "Activity",      "description": "Immutable workspace event log."},
    {"name": "Workspace",     "description": "Workspace configuration singleton."},
    {"name": "Members",       "description": "People and AI agents in the workspace."},
    {"name": "API Keys",      "description": "Programmatic credentials."},
    {"name": "Webhooks",      "description": "Outbound event subscriptions."},
    {"name": "Notifications", "description": "Per-member inbox."},
    {"name": "Search",        "description": "Cross-resource global search."},
    {"name": "Meta",          "description": "Spec, health, current identity."},
]

TAG_GROUPS = [
    {"name": "Content",       "tags": ["Posts", "Assets", "Accounts"]},
    {"name": "Store",         "tags": ["Products", "Orders", "Deliveries"]},
    {"name": "Observability", "tags": ["Activity", "Notifications", "Search"]},
    {"name": "Configuration", "tags": ["Workspace", "Members", "API Keys", "Webhooks"]},
    {"name": "Meta",          "tags": ["Meta"]},
]

# ---------- components: schemas ---------------------------------------------

def enum_schema(values_with_desc: list[tuple[str, str]], description: str):
    return {
        "type": "string",
        "enum": [v for v, _ in values_with_desc],
        "description": description,
        "x-enum-descriptions": {v: d for v, d in values_with_desc},
    }

SCHEMAS = {
    # ----- mixins -----
    "ResourceBase": {
        "type": "object",
        "description": "Fields present on every resource.",
        "required": ["id", "object", "created_at", "updated_at"],
        "properties": {
            "id":         {"type": "string", "description": "Opaque stable identifier.", "example": "post_01H8Z0K2Q7X9E7B5V6R2M1C3N4"},
            "object":     {"type": "string", "description": "Resource type discriminator."},
            "created_at": {"type": "string", "format": "date-time", "description": "RFC 3339 UTC creation timestamp."},
            "updated_at": {"type": "string", "format": "date-time", "description": "RFC 3339 UTC last-mutation timestamp."},
        },
    },
    "Provenance": {
        "type": "object",
        "description": "Who/what created this resource. Present on every resource.",
        "required": ["created_by", "created_via"],
        "properties": {
            "created_by":  {"type": "string", "description": "Member id of the human or AI that created the resource.", "x-resource": "Member"},
            "created_via": ref("Via"),
            "agent":       {"type": ["string", "null"], "description": "Name of the AI agent, when `created_via = mcp` or the actor is an AI Member."},
        },
    },
    # ----- envelopes / meta -----
    "PageMeta": {
        "type": "object",
        "description": "Cursor pagination metadata attached to every collection response.",
        "required": ["has_more"],
        "properties": {
            "has_more":    {"type": "boolean", "description": "True when more pages remain."},
            "next_cursor": {"type": ["string", "null"], "description": "Opaque cursor to pass as `cursor` on the next request. Omitted when exhausted."},
        },
    },
    "RateLimitMeta": {
        "type": "object", "description": "Rate-limit snapshot for the current key.",
        "properties": {
            "limit":     {"type": "integer"},
            "remaining": {"type": "integer"},
            "reset":     {"type": "string", "format": "date-time"},
        },
    },
    "Meta": {
        "type": "object", "description": "Envelope metadata.",
        "properties": {
            "request_id":  {"type": "string"},
            "api_version": {"type": "string", "example": "1.0.0"},
            "page":        ref("PageMeta"),
            "rate_limit":  ref("RateLimitMeta"),
        },
    },
    "Links": {
        "type": "object", "description": "Canonical and related links.",
        "properties": {
            "self":    {"type": "string", "format": "uri"},
            "related": {"type": "object", "additionalProperties": {"type": "string", "format": "uri"}},
        },
    },
    "Error": {
        "type": "object",
        "description": "Stable error shape. HTTP status is derived from `code`; see the errors reference.",
        "required": ["code", "message", "status", "request_id", "docs_url"],
        "properties": {
            "code":       ref("ErrorCode"),
            "message":    {"type": "string", "description": "Human-readable, safe to display."},
            "status":     {"type": "integer", "description": "HTTP status, echoed for convenience."},
            "request_id": {"type": "string"},
            "details":    {"type": "object", "description": "Flat `field → reason` map for `invalid_input`; free-form otherwise.", "additionalProperties": {"type": "string"}},
            "docs_url":   {"type": "string", "format": "uri"},
        },
    },
    "ErrorEnvelope": {
        "type": "object", "required": ["error"],
        "properties": {"error": ref("Error")},
    },
    "Operation": {
        "type": "object", "description": "Async operation handle returned by bulk actions and upload finalize.",
        "required": ["operation_id", "status"],
        "properties": {
            "operation_id": {"type": "string"},
            "status":       {"type": "string", "enum": ["pending", "running", "succeeded", "failed"]},
            "progress":     {"type": "number", "format": "float", "minimum": 0, "maximum": 1},
        },
    },
    "StatusView": {
        "type": "object", "description": "Narrow lifecycle snapshot for polling.",
        "required": ["id", "object", "status", "updated_at"],
        "properties": {
            "id":         {"type": "string"},
            "object":     {"type": "string"},
            "status":     {"type": "string"},
            "updated_at": {"type": "string", "format": "date-time"},
        },
    },
    "Money": {
        "type": "object", "required": ["amount", "currency"],
        "properties": {
            "amount":   {"type": "integer", "description": "Minor units (e.g. cents)."},
            "currency": {"type": "string", "description": "ISO 4217 code.", "example": "USD"},
        },
    },
    # ----- enums -----
    "PostStatus": enum_schema([
        ("draft",      "Editable, not yet on the schedule."),
        ("scheduled",  "On the schedule, not yet handed to the platform."),
        ("publishing", "Handed to the platform; awaiting confirmation."),
        ("published",  "Confirmed live on the destination Social Account."),
        ("failed",     "Platform rejected the publish; retry allowed."),
        ("cancelled",  "Withdrawn before publishing."),
    ], "Lifecycle state of a Post."),
    "AssetStatus": enum_schema([
        ("uploading",  "Bytes are being uploaded to the pre-signed URL."),
        ("processing", "Server-side transcoding/validation in progress."),
        ("ready",      "Attachable to Posts."),
        ("failed",     "Processing failed; upload again."),
    ], "Lifecycle state of an Asset."),
    "AccountStatus": enum_schema([
        ("connecting",       "Credentials exchange in progress."),
        ("active",           "Healthy; can send Posts."),
        ("needs_attention",  "Credentials expired or platform flagged; rotate."),
        ("retired",          "Removed from active use; kept for history."),
    ], "Lifecycle state of a Social Account."),
    "OrderStatus": enum_schema([
        ("pending",    "Awaiting payment."),
        ("paid",       "Paid; not yet fulfilled."),
        ("fulfilling", "Operators are preparing accounts."),
        ("fulfilled",  "All Deliveries handed over."),
        ("refunded",   "Payment reversed."),
        ("cancelled",  "Cancelled before fulfilment."),
    ], "Lifecycle state of an Order."),
    "DeliveryStatus": enum_schema([
        ("pending",          "Being prepared."),
        ("ready",            "Ready for the customer to accept."),
        ("accepted",         "Accepted; accounts moved into Accounts."),
        ("issue_reported",   "Customer reported a problem."),
        ("replaced",         "Superseded by a replacement Delivery."),
    ], "Lifecycle state of a Delivery."),
    "Platform": enum_schema([
        ("instagram", "Instagram — supported today."),
        ("tiktok",    "TikTok — reserved."),
        ("youtube",   "YouTube — reserved."),
        ("x",         "X (Twitter) — reserved."),
        ("linkedin",  "LinkedIn — reserved."),
        ("threads",   "Threads — reserved."),
        ("pinterest", "Pinterest — reserved."),
    ], "Destination platform. New values are additive; consumers must tolerate unknown values."),
    "ActorType": enum_schema([
        ("human",  "A human Member."),
        ("ai",     "An AI Member."),
        ("system", "The platform itself (retries, refunds, expirations)."),
    ], "Who caused an event."),
    "Via": enum_schema([
        ("web",    "Insta Buddy web app."),
        ("api",    "Direct REST API call."),
        ("mcp",    "Model Context Protocol tool call."),
        ("system", "Internal system action."),
    ], "Channel through which an action was taken."),
    "MemberRole": enum_schema([
        ("owner",  "Full control including deletion."),
        ("admin",  "Full control except workspace deletion."),
        ("editor", "Create and manage content."),
        ("viewer", "Read-only."),
        ("agent",  "AI Member; permissions scoped by API key."),
    ], "Member role in the workspace."),
    "EventType": enum_schema([
        ("post.scheduled",     "A Post entered `scheduled`."),
        ("post.publishing",    "A Post entered `publishing`."),
        ("post.published",     "A Post was confirmed live."),
        ("post.failed",        "A Post publish failed."),
        ("post.cancelled",     "A Post was cancelled."),
        ("asset.ready",        "An Asset finished processing."),
        ("asset.failed",       "An Asset failed processing."),
        ("account.connected",  "A Social Account was connected."),
        ("account.needs_attention", "A Social Account needs credential rotation."),
        ("order.paid",         "An Order was paid."),
        ("order.fulfilled",    "An Order finished fulfilment."),
        ("order.refunded",     "An Order was refunded."),
        ("delivery.ready",     "A Delivery is ready for the customer to accept."),
        ("delivery.accepted",  "A Delivery was accepted."),
        ("delivery.issue_reported", "A Delivery issue was reported."),
        ("member.invited",     "A Member was invited."),
        ("member.role_changed","A Member's role changed."),
        ("api_key.created",    "An API key was created."),
        ("api_key.revoked",    "An API key was revoked."),
    ], "Stable event type. Additive; consumers must ignore unknown values."),
    "ErrorCode": enum_schema([
        ("invalid_input",       "400 — Body/query fails validation. `details` lists field errors."),
        ("invalid_filter",      "400 — Unknown/unsupported query filter."),
        ("unauthenticated",     "401 — Missing or invalid API key."),
        ("forbidden",           "403 — Key lacks the required scope."),
        ("not_found",           "404 — Resource does not exist in this workspace."),
        ("conflict",            "409 — State transition not allowed."),
        ("precondition_failed", "412 — `If-Match` mismatch."),
        ("unsupported_media",   "415 — Upload mime not allowed."),
        ("rate_limited",        "429 — Rate limit exceeded; see `Retry-After`."),
        ("payment_required",    "402 — Plan limit hit."),
        ("internal",            "500 — Unhandled server error."),
        ("service_unavailable", "503 — Downstream unhealthy."),
    ], "Stable machine-readable error code. Additive; existing codes never change meaning."),
    # ----- refs -----
    "SocialAccountRef": {
        "type": "object", "required": ["id", "object"],
        "properties": {
            "id":     {"type": "string", "x-resource": "SocialAccount"},
            "object": {"type": "string", "enum": ["social_account"]},
            "handle": {"type": "string", "description": "Denormalized handle for display."},
        },
    },
    "AssetRef": {
        "type": "object", "required": ["id", "object"],
        "properties": {
            "id":     {"type": "string", "x-resource": "Asset"},
            "object": {"type": "string", "enum": ["asset"]},
        },
    },
    "OrderRef": {
        "type": "object", "required": ["id", "object"],
        "properties": {
            "id":     {"type": "string", "x-resource": "Order"},
            "object": {"type": "string", "enum": ["order"]},
        },
    },
    "DeliveryRef": {
        "type": "object", "required": ["id", "object"],
        "properties": {
            "id":     {"type": "string", "x-resource": "Delivery"},
            "object": {"type": "string", "enum": ["delivery"]},
        },
    },
    # ----- resources -----
    "Post": {
        "allOf": [
            ref("ResourceBase"), ref("Provenance"),
            {
                "type": "object",
                "required": ["object", "status", "account", "assets", "caption"],
                "properties": {
                    "object":       {"type": "string", "enum": ["post"]},
                    "status":       ref("PostStatus"),
                    "platform":     ref("Platform"),
                    "account":      ref("SocialAccountRef"),
                    "assets":       {"type": "array", "items": ref("AssetRef")},
                    "caption":      {"type": "string"},
                    "first_comment":{"type": ["string", "null"]},
                    "tags":         {"type": "array", "items": {"type": "string"}},
                    "campaign":     {"type": ["string", "null"]},
                    "scheduled_at": {"type": ["string", "null"], "format": "date-time"},
                    "published_at": {"type": ["string", "null"], "format": "date-time"},
                    "failure":      {"type": ["object", "null"], "properties": {"code": ref("ErrorCode"), "message": {"type": "string"}}},
                    "links":        ref("Links"),
                },
            },
        ],
        "description": "A planned or published unit of content targeting one Social Account.",
    },
    "PostCreateInput": {
        "type": "object", "additionalProperties": False,
        "required": ["account_id", "asset_ids", "caption"],
        "properties": {
            "account_id":    {"type": "string", "x-resource": "SocialAccount"},
            "asset_ids":     {"type": "array", "minItems": 1, "items": {"type": "string", "x-resource": "Asset"}},
            "caption":       {"type": "string", "maxLength": 2200},
            "first_comment": {"type": "string", "maxLength": 2200},
            "tags":          {"type": "array", "items": {"type": "string"}},
            "campaign":      {"type": "string"},
            "scheduled_at":  {"type": "string", "format": "date-time", "description": "Optional; if omitted the Post is created in `draft`."},
        },
    },
    "PostUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "caption":       {"type": "string", "maxLength": 2200},
            "first_comment": {"type": "string", "maxLength": 2200},
            "tags":          {"type": "array", "items": {"type": "string"}},
            "campaign":      {"type": "string"},
            "asset_ids":     {"type": "array", "minItems": 1, "items": {"type": "string", "x-resource": "Asset"}},
        },
    },
    "PostScheduleInput": {
        "type": "object", "additionalProperties": False, "required": ["scheduled_at"],
        "properties": {
            "scheduled_at": {"type": "string", "format": "date-time"},
            "timezone":     {"type": "string", "description": "IANA tz name. Advisory; `scheduled_at` is authoritative."},
        },
    },
    "PostCancelInput": {
        "type": "object", "additionalProperties": False,
        "properties": {"reason": {"type": "string", "maxLength": 500}},
    },
    "PostBulkCancelInput": {
        "type": "object", "additionalProperties": False, "required": ["post_ids"],
        "properties": {
            "post_ids": {"type": "array", "minItems": 1, "maxItems": 500, "items": {"type": "string", "x-resource": "Post"}},
            "reason":   {"type": "string"},
        },
    },
    "PostBulkRescheduleInput": {
        "type": "object", "additionalProperties": False, "required": ["items"],
        "properties": {
            "items": {
                "type": "array", "minItems": 1, "maxItems": 500,
                "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["post_id", "scheduled_at"],
                    "properties": {
                        "post_id":      {"type": "string", "x-resource": "Post"},
                        "scheduled_at": {"type": "string", "format": "date-time"},
                    },
                },
            },
        },
    },
    "Asset": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object",
            "required": ["object", "status", "filename", "mime", "size"],
            "properties": {
                "object":   {"type": "string", "enum": ["asset"]},
                "status":   ref("AssetStatus"),
                "filename": {"type": "string"},
                "mime":     {"type": "string"},
                "size":     {"type": "integer", "description": "Bytes."},
                "url":      {"type": ["string", "null"], "format": "uri", "description": "Playback/display URL; null while `uploading`/`processing`."},
                "width":    {"type": ["integer", "null"]},
                "height":   {"type": ["integer", "null"]},
                "duration_ms": {"type": ["integer", "null"]},
                "tags":     {"type": "array", "items": {"type": "string"}},
                "links":    ref("Links"),
            },
        }],
        "description": "A media file used by Posts.",
    },
    "AssetCreateInput": {
        "type": "object", "additionalProperties": False,
        "required": ["filename", "mime", "size"],
        "properties": {
            "filename": {"type": "string"},
            "mime":     {"type": "string", "example": "video/mp4"},
            "size":     {"type": "integer", "minimum": 1},
            "tags":     {"type": "array", "items": {"type": "string"}},
        },
    },
    "AssetCreateResponse": {
        "type": "object", "required": ["asset", "upload"],
        "properties": {
            "asset":  ref("Asset"),
            "upload": {
                "type": "object", "required": ["url", "method", "expires_at", "upload_token"],
                "properties": {
                    "url":          {"type": "string", "format": "uri", "description": "Pre-signed URL to PUT/POST the bytes to."},
                    "method":       {"type": "string", "enum": ["PUT", "POST"]},
                    "headers":      {"type": "object", "additionalProperties": {"type": "string"}},
                    "expires_at":   {"type": "string", "format": "date-time"},
                    "upload_token": {"type": "string", "description": "Pass to `assets.complete`."},
                },
            },
        },
    },
    "AssetUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "filename": {"type": "string"},
            "tags":     {"type": "array", "items": {"type": "string"}},
        },
    },
    "AssetCompleteInput": {
        "type": "object", "additionalProperties": False, "required": ["upload_token"],
        "properties": {"upload_token": {"type": "string"}},
    },
    "SocialAccount": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object",
            "required": ["object", "platform", "handle", "status"],
            "properties": {
                "object":     {"type": "string", "enum": ["social_account"]},
                "platform":   ref("Platform"),
                "handle":     {"type": "string", "example": "@founder"},
                "display_name": {"type": ["string", "null"]},
                "avatar_url": {"type": ["string", "null"], "format": "uri"},
                "status":     ref("AccountStatus"),
                "source":     {"type": "string", "enum": ["self_connected", "bought"], "description": "How this account entered the workspace."},
                "delivered_by": {"oneOf": [ref("DeliveryRef"), {"type": "null"}]},
                "tags":       {"type": "array", "items": {"type": "string"}},
                "links":      ref("Links"),
            },
        }],
        "description": "A destination account posts publish to.",
    },
    "AccountConnectInput": {
        "type": "object", "additionalProperties": False,
        "required": ["platform", "handle", "credentials_ref"],
        "properties": {
            "platform":        ref("Platform"),
            "handle":          {"type": "string"},
            "credentials_ref": {"type": "string", "description": "Opaque reference to credentials obtained via the connect flow."},
            "tags":            {"type": "array", "items": {"type": "string"}},
        },
    },
    "AccountUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "handle":       {"type": "string"},
            "display_name": {"type": "string"},
            "tags":         {"type": "array", "items": {"type": "string"}},
        },
    },
    "AccountRotateInput": {
        "type": "object", "additionalProperties": False, "required": ["new_credentials_ref"],
        "properties": {"new_credentials_ref": {"type": "string"}},
    },
    "Product": {
        "allOf": [ref("ResourceBase"), {
            "type": "object",
            "required": ["object", "name", "price", "platform"],
            "properties": {
                "object":      {"type": "string", "enum": ["product"]},
                "name":        {"type": "string"},
                "description": {"type": "string"},
                "platform":    ref("Platform"),
                "price":       ref("Money"),
                "min_quantity":{"type": "integer", "default": 1},
                "max_quantity":{"type": "integer"},
                "available":   {"type": "boolean"},
            },
        }],
        "description": "A purchasable offering in the Store.",
    },
    "Order": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object",
            "required": ["object", "status", "items", "total"],
            "properties": {
                "object": {"type": "string", "enum": ["order"]},
                "status": ref("OrderStatus"),
                "items": {"type": "array", "items": {
                    "type": "object", "required": ["product_id", "quantity"],
                    "properties": {
                        "product_id": {"type": "string", "x-resource": "Product"},
                        "quantity":   {"type": "integer", "minimum": 1},
                        "unit_price": ref("Money"),
                    },
                }},
                "total":       ref("Money"),
                "checkout_url":{"type": ["string", "null"], "format": "uri"},
                "invoice_url": {"type": ["string", "null"], "format": "uri"},
                "deliveries":  {"type": "array", "items": ref("DeliveryRef")},
                "notes":       {"type": ["string", "null"]},
                "links":       ref("Links"),
            },
        }],
        "description": "A record of a Store purchase.",
    },
    "OrderCreateInput": {
        "type": "object", "additionalProperties": False,
        "required": ["product_id", "quantity"],
        "properties": {
            "product_id": {"type": "string", "x-resource": "Product"},
            "quantity":   {"type": "integer", "minimum": 1, "maximum": 50},
            "notes":      {"type": "string"},
        },
    },
    "OrderReplacementInput": {
        "type": "object", "additionalProperties": False, "required": ["reason"],
        "properties": {
            "reason":       {"type": "string", "maxLength": 1000},
            "account_ids":  {"type": "array", "items": {"type": "string", "x-resource": "SocialAccount"}, "description": "Optional narrowing to specific delivered accounts."},
        },
    },
    "Delivery": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object",
            "required": ["object", "status", "order", "accounts"],
            "properties": {
                "object":   {"type": "string", "enum": ["delivery"]},
                "status":   ref("DeliveryStatus"),
                "order":    ref("OrderRef"),
                "accounts": {"type": "array", "items": ref("SocialAccountRef")},
                "warmup_completed_at": {"type": ["string", "null"], "format": "date-time"},
                "accepted_at":         {"type": ["string", "null"], "format": "date-time"},
                "issue":    {"type": ["object", "null"], "properties": {"reason": {"type": "string"}, "reported_at": {"type": "string", "format": "date-time"}}},
                "links":    ref("Links"),
            },
        }],
        "description": "The handover of one or more Social Accounts from an Order.",
    },
    "DeliveryAcceptInput": {
        "type": "object", "additionalProperties": False,
        "properties": {"destination_tags": {"type": "array", "items": {"type": "string"}}},
    },
    "DeliveryIssueInput": {
        "type": "object", "additionalProperties": False, "required": ["reason"],
        "properties": {
            "reason":      {"type": "string", "maxLength": 1000},
            "account_ids": {"type": "array", "items": {"type": "string", "x-resource": "SocialAccount"}},
        },
    },
    "Activity": {
        "allOf": [ref("ResourceBase"), {
            "type": "object",
            "required": ["object", "event", "actor", "occurred_at"],
            "properties": {
                "object":      {"type": "string", "enum": ["activity"]},
                "event":       ref("EventType"),
                "actor":       {"type": "object", "required": ["type", "id"], "properties": {
                    "type":  ref("ActorType"),
                    "id":    {"type": "string"},
                    "name":  {"type": "string"},
                    "agent": {"type": ["string", "null"]},
                }},
                "via":         ref("Via"),
                "target":      {"type": "object", "description": "Resource this event references.", "properties": {
                    "type": {"type": "string"},
                    "id":   {"type": "string"},
                }},
                "occurred_at": {"type": "string", "format": "date-time"},
                "message":     {"type": "string"},
                "data":        {"type": "object", "additionalProperties": True},
            },
        }],
        "description": "An immutable event recorded in the Workspace event log.",
    },
    "Workspace": {
        "allOf": [ref("ResourceBase"), {
            "type": "object",
            "required": ["object", "name"],
            "properties": {
                "object":                {"type": "string", "enum": ["workspace"]},
                "name":                  {"type": "string"},
                "timezone":              {"type": "string", "example": "Europe/Paris"},
                "default_posting_time":  {"type": ["string", "null"], "example": "18:00"},
                "branding":              {"type": "object", "properties": {"logo_url": {"type": "string", "format": "uri"}}},
                "plan":                  {"type": "string"},
            },
        }],
        "description": "The tenant.",
    },
    "WorkspaceUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "name":                 {"type": "string"},
            "timezone":             {"type": "string"},
            "default_posting_time": {"type": "string"},
            "branding":             {"type": "object", "properties": {"logo_url": {"type": "string", "format": "uri"}}},
        },
    },
    "Member": {
        "allOf": [ref("ResourceBase"), {
            "type": "object", "required": ["object", "type", "role"],
            "properties": {
                "object":     {"type": "string", "enum": ["member"]},
                "type":       {"type": "string", "enum": ["human", "ai"]},
                "role":       ref("MemberRole"),
                "email":      {"type": ["string", "null"], "format": "email"},
                "name":       {"type": "string"},
                "avatar_url": {"type": ["string", "null"], "format": "uri"},
                "last_active_at": {"type": ["string", "null"], "format": "date-time"},
            },
        }],
        "description": "A human or AI participant in the workspace.",
    },
    "MemberCreateInput": {
        "type": "object", "additionalProperties": False, "required": ["email", "role"],
        "properties": {
            "email": {"type": "string", "format": "email"},
            "role":  ref("MemberRole"),
        },
    },
    "MemberUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {"role": ref("MemberRole")},
    },
    "ApiKey": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object", "required": ["object", "name", "scopes"],
            "properties": {
                "object":       {"type": "string", "enum": ["api_key"]},
                "name":         {"type": "string"},
                "scopes":       {"type": "array", "items": {"type": "string"}, "description": "See `x-scopes` on individual operations."},
                "last_used_at": {"type": ["string", "null"], "format": "date-time"},
                "expires_at":   {"type": ["string", "null"], "format": "date-time"},
                "prefix":       {"type": "string", "description": "First few chars for identification. The full secret is only returned once at create time."},
            },
        }],
        "description": "A programmatic credential scoped to the workspace.",
    },
    "ApiKeyCreateInput": {
        "type": "object", "additionalProperties": False, "required": ["name", "scopes"],
        "properties": {
            "name":       {"type": "string"},
            "scopes":     {"type": "array", "minItems": 1, "items": {"type": "string"}},
            "expires_at": {"type": "string", "format": "date-time"},
        },
    },
    "ApiKeyCreateResponse": {
        "allOf": [ref("ApiKey"), {"type": "object", "required": ["secret"], "properties": {
            "secret": {"type": "string", "description": "The full API key. Shown once; store it now."},
        }}],
    },
    "Webhook": {
        "allOf": [ref("ResourceBase"), ref("Provenance"), {
            "type": "object", "required": ["object", "url", "events", "active"],
            "properties": {
                "object":      {"type": "string", "enum": ["webhook"]},
                "url":         {"type": "string", "format": "uri"},
                "events":      {"type": "array", "items": ref("EventType")},
                "active":      {"type": "boolean"},
                "description": {"type": "string"},
                "last_delivery_at": {"type": ["string", "null"], "format": "date-time"},
                "failure_count":    {"type": "integer"},
            },
        }],
        "description": "An outbound event subscription.",
    },
    "WebhookCreateInput": {
        "type": "object", "additionalProperties": False, "required": ["url", "events"],
        "properties": {
            "url":         {"type": "string", "format": "uri"},
            "events":      {"type": "array", "minItems": 1, "items": ref("EventType")},
            "description": {"type": "string"},
        },
    },
    "WebhookUpdateInput": {
        "type": "object", "additionalProperties": False,
        "properties": {
            "url":         {"type": "string", "format": "uri"},
            "events":      {"type": "array", "items": ref("EventType")},
            "active":      {"type": "boolean"},
            "description": {"type": "string"},
        },
    },
    "WebhookDelivery": {
        "allOf": [ref("ResourceBase"), {
            "type": "object", "required": ["object", "event", "status", "attempt"],
            "properties": {
                "object":         {"type": "string", "enum": ["webhook_delivery"]},
                "event":          ref("EventType"),
                "status":         {"type": "string", "enum": ["pending", "succeeded", "failed"]},
                "attempt":        {"type": "integer"},
                "response_code":  {"type": ["integer", "null"]},
                "response_ms":    {"type": ["integer", "null"]},
                "next_retry_at":  {"type": ["string", "null"], "format": "date-time"},
            },
        }],
    },
    "Notification": {
        "allOf": [ref("ResourceBase"), {
            "type": "object", "required": ["object", "event", "read", "message"],
            "properties": {
                "object":  {"type": "string", "enum": ["notification"]},
                "event":   ref("EventType"),
                "message": {"type": "string"},
                "read":    {"type": "boolean"},
                "target":  {"type": "object", "properties": {"type": {"type": "string"}, "id": {"type": "string"}}},
            },
        }],
    },
    "SearchResult": {
        "type": "object", "required": ["groups"],
        "properties": {
            "groups": {
                "type": "object",
                "description": "Results grouped by resource type. Absent groups have no matches.",
                "additionalProperties": {
                    "type": "object", "properties": {
                        "items": {"type": "array", "items": {"type": "object", "properties": {
                            "id":     {"type": "string"},
                            "object": {"type": "string"},
                            "title":  {"type": "string"},
                            "snippet":{"type": "string"},
                            "link":   {"type": "string", "format": "uri"},
                        }}},
                        "more_link": {"type": "string", "format": "uri"},
                    },
                },
            },
        },
    },
    "MeResponse": {
        "type": "object", "required": ["member", "workspace"],
        "properties": {
            "member":    ref("Member"),
            "workspace": ref("Workspace"),
            "scopes":    {"type": "array", "items": {"type": "string"}},
        },
    },
    "HealthResponse": {
        "type": "object", "required": ["status"],
        "properties": {"status": {"type": "string", "enum": ["ok", "degraded"]}, "version": {"type": "string"}},
    },
}

# Envelope wrappers (one per resource) — declared as plain schemas so they render
def envelope(name, inner):
    SCHEMAS[name] = {"type": "object", "required": ["data"], "properties": {"data": inner, "meta": ref("Meta")}}
def coll_envelope(name, inner):
    SCHEMAS[name] = {"type": "object", "required": ["data", "meta"], "properties": {"data": {"type": "array", "items": inner}, "meta": ref("Meta")}}

for r in ["Post","Asset","SocialAccount","Product","Order","Delivery","Activity","Workspace","Member","ApiKey","Webhook","WebhookDelivery","Notification"]:
    envelope(f"{r}Envelope", ref(r))
    coll_envelope(f"{r}Collection", ref(r))
envelope("AssetCreateEnvelope", ref("AssetCreateResponse"))
envelope("ApiKeyCreateEnvelope", ref("ApiKeyCreateResponse"))
envelope("OperationEnvelope", ref("Operation"))
envelope("StatusEnvelope", ref("StatusView"))
envelope("SearchEnvelope", ref("SearchResult"))
envelope("MeEnvelope", ref("MeResponse"))

# ---------- parameters ------------------------------------------------------

PARAMETERS = {
    # pagination
    "Limit":  {"name": "limit",  "in": "query", "description": "Page size (1–100, default 25).", "required": False,
               "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25}},
    "Cursor": {"name": "cursor", "in": "query", "description": "Opaque cursor from a prior response's `meta.page.next_cursor`.", "required": False,
               "schema": {"type": "string"}},
    # time
    "CreatedAfter":   {"name": "created_after",   "in": "query", "schema": {"type": "string", "format": "date-time"}, "description": "Inclusive RFC 3339 lower bound on `created_at`."},
    "CreatedBefore":  {"name": "created_before",  "in": "query", "schema": {"type": "string", "format": "date-time"}, "description": "Exclusive RFC 3339 upper bound on `created_at`."},
    "UpdatedAfter":   {"name": "updated_after",   "in": "query", "schema": {"type": "string", "format": "date-time"}, "description": "Inclusive lower bound on `updated_at`."},
    "ScheduledAfter": {"name": "scheduled_after", "in": "query", "schema": {"type": "string", "format": "date-time"}, "description": "Inclusive lower bound on `scheduled_at` (Posts)."},
    "ScheduledBefore":{"name": "scheduled_before","in": "query", "schema": {"type": "string", "format": "date-time"}, "description": "Exclusive upper bound on `scheduled_at` (Posts)."},
    # reference filters
    "FilterAccountId": {"name": "account_id", "in": "query", "schema": {"type": "string"}, "description": "Filter to Posts targeting this Social Account."},
    "FilterAssetId":   {"name": "asset_id",   "in": "query", "schema": {"type": "string"}, "description": "Filter to Posts using this Asset."},
    "FilterProductId": {"name": "product_id", "in": "query", "schema": {"type": "string"}, "description": "Filter to Orders for this Product."},
    "FilterOrderId":   {"name": "order_id",   "in": "query", "schema": {"type": "string"}, "description": "Filter to Deliveries under this Order."},
    "FilterMemberId":  {"name": "member_id",  "in": "query", "schema": {"type": "string"}, "description": "Filter by Member id."},
    # enums (repeatable)
    "FilterPostStatus":     {"name": "status", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("PostStatus")},     "description": "Repeatable. OR within family."},
    "FilterOrderStatus":    {"name": "status", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("OrderStatus")},    "description": "Repeatable. OR within family."},
    "FilterDeliveryStatus": {"name": "status", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("DeliveryStatus")}, "description": "Repeatable. OR within family."},
    "FilterAccountStatus":  {"name": "status", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("AccountStatus")},  "description": "Repeatable. OR within family."},
    "FilterAssetStatus":    {"name": "status", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("AssetStatus")},    "description": "Repeatable. OR within family."},
    "FilterPlatform":       {"name": "platform", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("Platform")},     "description": "Repeatable."},
    "FilterActor":          {"name": "actor", "in": "query", "schema": ref("ActorType"), "description": "Filter by actor type."},
    "FilterVia":            {"name": "via",   "in": "query", "schema": ref("Via"),       "description": "Filter by channel."},
    "FilterAgent":          {"name": "agent", "in": "query", "schema": {"type": "string"}, "description": "Filter by AI agent name."},
    "FilterTag":            {"name": "tag",   "in": "query", "explode": True, "schema": {"type": "array", "items": {"type": "string"}}, "description": "Repeatable. AND within family."},
    "FilterEvent":          {"name": "event", "in": "query", "explode": True, "schema": {"type": "array", "items": ref("EventType")},   "description": "Repeatable."},
    "Query":                {"name": "q",     "in": "query", "schema": {"type": "string"}, "description": "Prefix + full-token search over resource-specific fields."},
    # headers
    "IdempotencyKey":     {"name": "Idempotency-Key",      "in": "header", "schema": {"type": "string"}, "description": "Optional. Repeats with the same key return the original response."},
    "XRequestId":         {"name": "X-Request-Id",         "in": "header", "schema": {"type": "string"}, "description": "Client-supplied request id; echoed in the response."},
    "OnBehalfOfWorkspace":{"name": "X-On-Behalf-Of-Workspace", "in": "header", "schema": {"type": "string"}, "description": "Operator-only. Perform the request against another workspace."},
    "AcceptLanguage":     {"name": "Accept-Language",      "in": "header", "schema": {"type": "string"}, "description": "Localize human-readable error messages."},
    # path params (named per resource)
}
def add_path_param(name, resource, desc_):
    PARAMETERS[name] = {"name": name.split("_")[-1] if False else name.lower(), "in": "path", "required": True,
                        "schema": {"type": "string", "x-resource": resource}, "description": desc_}

# The names below match the {slug} used in paths.
for n, r in [
    ("post_id","Post"), ("asset_id","Asset"), ("account_id","SocialAccount"),
    ("product_id","Product"), ("order_id","Order"), ("delivery_id","Delivery"),
    ("activity_id","Activity"), ("member_id","Member"), ("api_key_id","ApiKey"),
    ("webhook_id","Webhook"), ("webhook_delivery_id","WebhookDelivery"),
    ("notification_id","Notification"),
]:
    PARAMETERS["Path_" + n] = {
        "name": n, "in": "path", "required": True,
        "schema": {"type": "string", "x-resource": r},
        "description": f"Identifier of the {r}.",
    }

# ---------- responses -------------------------------------------------------

def std_headers_obj():
    return dict(STD_HEADERS)

def json_response(desc_, schema_ref, example_name=None):
    r = {"description": desc_, "headers": std_headers_obj(),
         "content": {"application/json": {"schema": ref(schema_ref)}}}
    if example_name:
        r["content"]["application/json"]["examples"] = {"default": exref(example_name)}
    return r

RESPONSES = {
    "Unauthorized":    {"description": "Missing or invalid API key.",   "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_Unauthorized")}}}},
    "Forbidden":       {"description": "Key lacks the required scope.", "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_Forbidden")}}}},
    "NotFound":        {"description": "Resource does not exist in this workspace.", "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_NotFound")}}}},
    "Conflict":        {"description": "State transition not allowed.", "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_Conflict")}}}},
    "ValidationError": {"description": "Body/query fails validation.",  "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_ValidationError")}}}},
    "RateLimited":     {"description": "Rate limit exceeded. See `Retry-After`.", "headers": {"Retry-After": hdref("RetryAfter"), **STD_HEADERS},
                        "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_RateLimited")}}}},
    "InternalError":   {"description": "Unhandled server error.",       "content": {"application/json": {"schema": ref("ErrorEnvelope"), "examples": {"default": exref("Error_Internal")}}}},
    "NoContent":       {"description": "Success with no body.",         "headers": std_headers_obj()},
}

HEADERS = {
    "XRequestId":         {"schema": {"type": "string"}, "description": "Echoed request id."},
    "XRateLimitLimit":    {"schema": {"type": "integer"}, "description": "Rate-limit ceiling for this key."},
    "XRateLimitRemaining":{"schema": {"type": "integer"}, "description": "Requests remaining in the window."},
    "XRateLimitReset":    {"schema": {"type": "string", "format": "date-time"}, "description": "When the window resets."},
    "RetryAfter":         {"schema": {"type": "integer"}, "description": "Seconds to wait before retrying."},
    "Deprecation":        {"schema": {"type": "string"}, "description": "RFC 8594 deprecation flag."},
    "Sunset":             {"schema": {"type": "string"}, "description": "RFC 8594 sunset date."},
}

# ---------- examples (coherent narrative) -----------------------------------
# One customer journey: buy 3 IG accounts → Delivery → accept → upload video →
# create Post → schedule → publish → status → cancel → activity → webhook.

ACCOUNT_ID  = "acc_01H8Z0K2Q7X9E7B5V6R2M1C3N4"
ASSET_ID    = "ast_01H8Z0N4H1J8V0W3P2Y6R5F1S2"
POST_ID     = "post_01H8Z0P9M4C7T2K1D9B8Q3E5U7"
ORDER_ID    = "ord_01H8Z0R2S5A6B7C8D9E0F1G2H3"
DELIVERY_ID = "del_01H8Z0T6U7V8W9X0Y1Z2A3B4C5"
PRODUCT_ID  = "prod_01H8Z0V9WARM3IG"
MEMBER_ID   = "mem_01H8Z0X1Y2Z3A4B5C6D7E8F9G0"
API_KEY_ID  = "key_01H8Z0Y3Z4A5B6C7D8E9F0G1H2"
WEBHOOK_ID  = "wh_01H8Z0Z5A6B7C8D9E0F1G2H3I4"
REQ_ID      = "req_01H8Z1000000000000000000000"
NOW         = "2026-07-05T10:00:00Z"
LATER       = "2026-07-06T18:00:00Z"

def meta_ex(extra=None):
    m = {"request_id": REQ_ID, "api_version": "1.0.0", "rate_limit": {"limit": 600, "remaining": 599, "reset": "2026-07-05T10:01:00Z"}}
    if extra: m.update(extra)
    return m

EXAMPLES = {
    # ----- products / orders / deliveries -----
    "Product_IGWarm": {"summary": "Warmed-up Instagram account", "value": {
        "data": {"id": PRODUCT_ID, "object": "product", "created_at": NOW, "updated_at": NOW,
                 "name": "Warmed-up Instagram Account", "description": "30-day warmed IG account, ready to post.",
                 "platform": "instagram", "price": {"amount": 4900, "currency": "USD"},
                 "min_quantity": 1, "max_quantity": 25, "available": True},
        "meta": meta_ex()}},
    "Product_Collection": {"summary": "Catalog", "value": {
        "data": [{"id": PRODUCT_ID, "object": "product", "created_at": NOW, "updated_at": NOW,
                  "name": "Warmed-up Instagram Account", "description": "30-day warmed IG account.",
                  "platform": "instagram", "price": {"amount": 4900, "currency": "USD"},
                  "min_quantity": 1, "max_quantity": 25, "available": True}],
        "meta": meta_ex({"page": {"has_more": False, "next_cursor": None}})}},
    "OrderCreate_Req": {"summary": "Buy 3 IG accounts", "value": {"product_id": PRODUCT_ID, "quantity": 3, "notes": "For summer launch"}},
    "Order_Created": {"summary": "Order created — awaiting payment", "value": {
        "data": {"id": ORDER_ID, "object": "order", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "status": "pending",
                 "items": [{"product_id": PRODUCT_ID, "quantity": 3, "unit_price": {"amount": 4900, "currency": "USD"}}],
                 "total": {"amount": 14700, "currency": "USD"},
                 "checkout_url": "https://checkout.example/pay/ord_...",
                 "invoice_url": None, "deliveries": [], "notes": "For summer launch",
                 "links": {"self": "/v1/orders/" + ORDER_ID}},
        "meta": meta_ex()}},
    "Order_Fulfilled": {"summary": "Order fulfilled", "value": {
        "data": {"id": ORDER_ID, "object": "order", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "status": "fulfilled",
                 "items": [{"product_id": PRODUCT_ID, "quantity": 3, "unit_price": {"amount": 4900, "currency": "USD"}}],
                 "total": {"amount": 14700, "currency": "USD"},
                 "checkout_url": None, "invoice_url": "https://invoices.example/ord_...pdf",
                 "deliveries": [{"id": DELIVERY_ID, "object": "delivery"}],
                 "notes": "For summer launch",
                 "links": {"self": "/v1/orders/" + ORDER_ID, "related": {"deliveries": "/v1/orders/" + ORDER_ID + "/deliveries"}}},
        "meta": meta_ex()}},
    "Delivery_Ready": {"summary": "Delivery ready to accept", "value": {
        "data": {"id": DELIVERY_ID, "object": "delivery", "created_at": NOW, "updated_at": NOW,
                 "created_by": "mem_system", "created_via": "system",
                 "status": "ready", "order": {"id": ORDER_ID, "object": "order"},
                 "accounts": [{"id": ACCOUNT_ID, "object": "social_account", "handle": "@brand_alpha"}],
                 "warmup_completed_at": NOW, "accepted_at": None, "issue": None,
                 "links": {"self": "/v1/deliveries/" + DELIVERY_ID}},
        "meta": meta_ex()}},
    "DeliveryAccept_Req": {"summary": "Accept and tag", "value": {"destination_tags": ["summer-launch"]}},
    # ----- accounts -----
    "AccountConnect_Req": {"summary": "Connect an IG account you own", "value": {
        "platform": "instagram", "handle": "@founder", "credentials_ref": "conn_temp_abc123", "tags": ["personal"]}},
    "Account_Active": {"summary": "Active account", "value": {
        "data": {"id": ACCOUNT_ID, "object": "social_account", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "platform": "instagram", "handle": "@brand_alpha", "display_name": "Brand Alpha",
                 "avatar_url": "https://cdn.example/av.png", "status": "active", "source": "bought",
                 "delivered_by": {"id": DELIVERY_ID, "object": "delivery"},
                 "tags": ["summer-launch"], "links": {"self": "/v1/accounts/" + ACCOUNT_ID}},
        "meta": meta_ex()}},
    "Account_Collection": {"summary": "Accounts", "value": {
        "data": [{"id": ACCOUNT_ID, "object": "social_account", "created_at": NOW, "updated_at": NOW,
                  "created_by": MEMBER_ID, "created_via": "web",
                  "platform": "instagram", "handle": "@brand_alpha", "display_name": "Brand Alpha",
                  "avatar_url": None, "status": "active", "source": "bought",
                  "delivered_by": {"id": DELIVERY_ID, "object": "delivery"},
                  "tags": ["summer-launch"], "links": {"self": "/v1/accounts/" + ACCOUNT_ID}}],
        "meta": meta_ex({"page": {"has_more": False, "next_cursor": None}})}},
    # ----- assets -----
    "AssetCreate_Req": {"summary": "Initiate upload for a Reel", "value": {
        "filename": "summer-teaser.mp4", "mime": "video/mp4", "size": 8_412_331, "tags": ["reel", "summer"]}},
    "AssetCreate_Res": {"summary": "Upload URL issued", "value": {
        "data": {
            "asset": {"id": ASSET_ID, "object": "asset", "created_at": NOW, "updated_at": NOW,
                      "created_by": MEMBER_ID, "created_via": "web",
                      "status": "uploading", "filename": "summer-teaser.mp4", "mime": "video/mp4",
                      "size": 8_412_331, "url": None, "width": None, "height": None,
                      "duration_ms": None, "tags": ["reel", "summer"],
                      "links": {"self": "/v1/assets/" + ASSET_ID}},
            "upload": {"url": "https://uploads.example/put/ast_...", "method": "PUT",
                       "headers": {"Content-Type": "video/mp4"},
                       "expires_at": "2026-07-05T10:15:00Z",
                       "upload_token": "upl_tok_abc"},
        },
        "meta": meta_ex()}},
    "AssetComplete_Req": {"summary": "Finalize upload", "value": {"upload_token": "upl_tok_abc"}},
    "Asset_Ready": {"summary": "Asset ready", "value": {
        "data": {"id": ASSET_ID, "object": "asset", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "status": "ready", "filename": "summer-teaser.mp4", "mime": "video/mp4",
                 "size": 8_412_331, "url": "https://cdn.example/ast_.../v.mp4",
                 "width": 1080, "height": 1920, "duration_ms": 12500,
                 "tags": ["reel", "summer"], "links": {"self": "/v1/assets/" + ASSET_ID}},
        "meta": meta_ex()}},
    # ----- posts -----
    "PostCreate_Req": {"summary": "Schedule a Reel for tomorrow 18:00", "value": {
        "account_id": ACCOUNT_ID, "asset_ids": [ASSET_ID],
        "caption": "Summer is coming ☀️", "first_comment": "#summer #reel",
        "tags": ["summer"], "scheduled_at": LATER}},
    "Post_Scheduled": {"summary": "Post scheduled", "value": {
        "data": {"id": POST_ID, "object": "post", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "status": "scheduled", "platform": "instagram",
                 "account": {"id": ACCOUNT_ID, "object": "social_account", "handle": "@brand_alpha"},
                 "assets": [{"id": ASSET_ID, "object": "asset"}],
                 "caption": "Summer is coming ☀️", "first_comment": "#summer #reel",
                 "tags": ["summer"], "campaign": None,
                 "scheduled_at": LATER, "published_at": None, "failure": None,
                 "links": {"self": "/v1/posts/" + POST_ID}},
        "meta": meta_ex()}},
    "Post_Published": {"summary": "Post published", "value": {
        "data": {"id": POST_ID, "object": "post", "created_at": NOW, "updated_at": "2026-07-06T18:00:12Z",
                 "created_by": MEMBER_ID, "created_via": "web",
                 "status": "published", "platform": "instagram",
                 "account": {"id": ACCOUNT_ID, "object": "social_account", "handle": "@brand_alpha"},
                 "assets": [{"id": ASSET_ID, "object": "asset"}],
                 "caption": "Summer is coming ☀️", "first_comment": "#summer #reel",
                 "tags": ["summer"], "campaign": None,
                 "scheduled_at": LATER, "published_at": "2026-07-06T18:00:12Z", "failure": None,
                 "links": {"self": "/v1/posts/" + POST_ID}},
        "meta": meta_ex()}},
    "Post_Collection": {"summary": "Posts, this week", "value": {
        "data": [{"id": POST_ID, "object": "post", "created_at": NOW, "updated_at": NOW,
                  "created_by": MEMBER_ID, "created_via": "web",
                  "status": "scheduled", "platform": "instagram",
                  "account": {"id": ACCOUNT_ID, "object": "social_account", "handle": "@brand_alpha"},
                  "assets": [{"id": ASSET_ID, "object": "asset"}],
                  "caption": "Summer is coming ☀️", "first_comment": None,
                  "tags": ["summer"], "campaign": None,
                  "scheduled_at": LATER, "published_at": None, "failure": None,
                  "links": {"self": "/v1/posts/" + POST_ID}}],
        "meta": meta_ex({"page": {"has_more": True, "next_cursor": "cur_abc"}})}},
    "PostStatus": {"summary": "Post status snapshot", "value": {
        "data": {"id": POST_ID, "object": "post", "status": "scheduled", "updated_at": NOW},
        "meta": meta_ex()}},
    "PostSchedule_Req": {"summary": "Reschedule", "value": {"scheduled_at": "2026-07-07T18:00:00Z", "timezone": "Europe/Paris"}},
    "PostCancel_Req": {"summary": "Cancel with reason", "value": {"reason": "Copy changed."}},
    "PostBulkCancel_Req": {"summary": "Cancel three posts", "value": {"post_ids": [POST_ID, "post_02...", "post_03..."], "reason": "Campaign paused."}},
    "PostBulkReschedule_Req": {"summary": "Push two posts by one day", "value": {
        "items": [{"post_id": POST_ID, "scheduled_at": "2026-07-07T18:00:00Z"},
                  {"post_id": "post_02...", "scheduled_at": "2026-07-08T18:00:00Z"}]}},
    "Operation_Async": {"summary": "Async operation acknowledged", "value": {
        "data": {"operation_id": "op_01H8Z1BULK", "status": "pending", "progress": 0.0},
        "meta": meta_ex()}},
    # ----- activity -----
    "Activity_Collection": {"summary": "Recent activity", "value": {
        "data": [{"id": "act_01H8Z1P", "object": "activity",
                  "created_at": "2026-07-06T18:00:12Z", "updated_at": "2026-07-06T18:00:12Z",
                  "event": "post.published", "actor": {"type": "system", "id": "sys", "name": "publisher"},
                  "via": "system", "target": {"type": "post", "id": POST_ID},
                  "occurred_at": "2026-07-06T18:00:12Z",
                  "message": "Post published to @brand_alpha.", "data": {}}],
        "meta": meta_ex({"page": {"has_more": False, "next_cursor": None}})}},
    # ----- workspace / members / api keys / webhooks / notifications -----
    "Workspace": {"summary": "Workspace", "value": {
        "data": {"id": "ws_01H8Z1WS", "object": "workspace", "created_at": NOW, "updated_at": NOW,
                 "name": "Alpha Studio", "timezone": "Europe/Paris",
                 "default_posting_time": "18:00", "branding": {}, "plan": "growth"},
        "meta": meta_ex()}},
    "MemberInvite_Req": {"summary": "Invite an editor", "value": {"email": "kai@alpha.example", "role": "editor"}},
    "Member": {"summary": "Member", "value": {
        "data": {"id": MEMBER_ID, "object": "member", "created_at": NOW, "updated_at": NOW,
                 "type": "human", "role": "editor", "email": "kai@alpha.example",
                 "name": "Kai", "avatar_url": None, "last_active_at": NOW},
        "meta": meta_ex()}},
    "ApiKeyCreate_Req": {"summary": "Create key for automation", "value": {
        "name": "GitHub Actions", "scopes": ["posts:write", "posts:publish", "assets:write"],
        "expires_at": "2027-07-05T00:00:00Z"}},
    "ApiKey_Created": {"summary": "New key — secret shown once", "value": {
        "data": {"id": API_KEY_ID, "object": "api_key", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "name": "GitHub Actions",
                 "scopes": ["posts:write", "posts:publish", "assets:write"],
                 "last_used_at": None, "expires_at": "2027-07-05T00:00:00Z",
                 "prefix": "ib_live_gha_", "secret": "ib_live_gha_XXXXXXXXXXXXXXXXXXXXXXXX"},
        "meta": meta_ex()}},
    "WebhookCreate_Req": {"summary": "Subscribe to publish events", "value": {
        "url": "https://hooks.example/insta-buddy",
        "events": ["post.published", "post.failed", "delivery.ready"],
        "description": "Ops alerts"}},
    "Webhook": {"summary": "Webhook", "value": {
        "data": {"id": WEBHOOK_ID, "object": "webhook", "created_at": NOW, "updated_at": NOW,
                 "created_by": MEMBER_ID, "created_via": "web",
                 "url": "https://hooks.example/insta-buddy",
                 "events": ["post.published", "post.failed", "delivery.ready"],
                 "active": True, "description": "Ops alerts",
                 "last_delivery_at": None, "failure_count": 0},
        "meta": meta_ex()}},
    "Notification_Collection": {"summary": "Inbox", "value": {
        "data": [{"id": "ntf_01", "object": "notification", "created_at": NOW, "updated_at": NOW,
                  "event": "delivery.ready", "message": "Your delivery is ready to accept.",
                  "read": False, "target": {"type": "delivery", "id": DELIVERY_ID}}],
        "meta": meta_ex({"page": {"has_more": False, "next_cursor": None}})}},
    # ----- search / meta -----
    "Search_Result": {"summary": "Search 'summer'", "value": {
        "data": {"groups": {
            "post":   {"items": [{"id": POST_ID, "object": "post", "title": "Summer is coming ☀️", "snippet": "Reel scheduled for tomorrow", "link": "/v1/posts/" + POST_ID}], "more_link": "/v1/posts?q=summer"},
            "asset":  {"items": [{"id": ASSET_ID, "object": "asset", "title": "summer-teaser.mp4", "snippet": "Reel · 1080×1920", "link": "/v1/assets/" + ASSET_ID}], "more_link": "/v1/assets?q=summer"},
        }},
        "meta": meta_ex()}},
    "Me": {"summary": "Current identity", "value": {
        "data": {
            "member": {"id": MEMBER_ID, "object": "member", "created_at": NOW, "updated_at": NOW,
                       "type": "human", "role": "owner", "email": "you@alpha.example",
                       "name": "You", "avatar_url": None, "last_active_at": NOW},
            "workspace": {"id": "ws_01H8Z1WS", "object": "workspace", "created_at": NOW, "updated_at": NOW,
                          "name": "Alpha Studio", "timezone": "Europe/Paris",
                          "default_posting_time": "18:00", "branding": {}, "plan": "growth"},
            "scopes": ["*"]},
        "meta": meta_ex()}},
    "Health": {"summary": "Healthy", "value": {"data": {"status": "ok", "version": "1.0.0"}}},
    # ----- errors -----
    "Error_Unauthorized":    {"value": {"error": {"code": "unauthenticated", "message": "Missing or invalid API key.", "status": 401, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/unauthenticated"}}},
    "Error_Forbidden":       {"value": {"error": {"code": "forbidden",       "message": "This key lacks scope `posts:publish`.", "status": 403, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/forbidden"}}},
    "Error_NotFound":        {"value": {"error": {"code": "not_found",       "message": "Post not found.", "status": 404, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/not_found"}}},
    "Error_Conflict":        {"value": {"error": {"code": "conflict",        "message": "Cannot cancel a Post that is already published.", "status": 409, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/conflict"}}},
    "Error_ValidationError": {"value": {"error": {"code": "invalid_input",   "message": "`scheduled_at` must be in the future.", "status": 400, "request_id": REQ_ID, "details": {"scheduled_at": "must be in the future"}, "docs_url": "https://docs.insta-buddy.example/errors/invalid_input"}}},
    "Error_RateLimited":     {"value": {"error": {"code": "rate_limited",    "message": "Too many requests. Retry after 30s.", "status": 429, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/rate_limited"}}},
    "Error_Internal":        {"value": {"error": {"code": "internal",        "message": "Something went wrong on our end.", "status": 500, "request_id": REQ_ID, "docs_url": "https://docs.insta-buddy.example/errors/internal"}}},
}

# ---------- security schemes ------------------------------------------------

SECURITY_SCHEMES = {
    "ApiKeyAuth": {
        "type": "http", "scheme": "bearer", "bearerFormat": "Insta Buddy API key",
        "description": "Bearer token; obtain via **Settings → API Keys**. Scoped to a single Workspace."
    },
}

# ---------- operations builder ----------------------------------------------

PATHS = {}

def op(*, path, method, tag, verb, summary, what, when, before, after,
       parameters=None, body_schema=None, body_example=None, body_required=True,
       response_schema, response_example, response_status="200",
       workflow, page, related=None, next_step=None,
       ai_summary, ai_example, scopes, rate_tier="standard",
       error_codes=None, idempotent=False, extra_responses=None, extra_response_headers=None):
    op_id = f"{tag.lower().replace(' ', '_')}.{verb}"
    parameters = list(parameters or [])
    # Attach shared headers on every op
    parameters.append(pref("XRequestId"))
    if method in ("POST", "PATCH", "PUT", "DELETE") and not idempotent:
        parameters.append(pref("IdempotencyKey"))

    responses = {}
    ok = {"description": summary, "headers": std_headers_obj(),
          "content": {"application/json": {"schema": ref(response_schema),
                                           "examples": {"default": exref(response_example)}}}}
    if extra_response_headers:
        ok["headers"].update(extra_response_headers)
    responses[response_status] = ok
    for c, r in STD_ERROR_RESPONSES.items():
        responses[c] = r
    if extra_responses:
        responses.update(extra_responses)

    operation = {
        "tags": [tag],
        "operationId": op_id,
        "summary": summary,
        "description": desc(what, when, before, after),
        "parameters": parameters,
        "responses": responses,
        "x-workflow": workflow,
        "x-page": page,
        "x-ai-summary": ai_summary,
        "x-ai-example": ai_example,
        "x-scopes": scopes,
        "x-rate-limit-tier": rate_tier,
        "x-error-codes": error_codes or ["invalid_input", "unauthenticated", "forbidden", "not_found", "rate_limited", "internal"],
        "x-idempotent": idempotent,
    }
    if related:   operation["x-related-operations"] = related
    if next_step: operation["x-next-step"] = next_step

    if body_schema:
        operation["requestBody"] = {
            "required": body_required,
            "content": {"application/json": {"schema": ref(body_schema),
                                             "examples": {"default": exref(body_example)} if body_example else {}}}
        }

    PATHS.setdefault(path, {})[method.lower()] = operation

# ---------- POSTS -----------------------------------------------------------

POST_LIST_PARAMS = [pref(p) for p in [
    "Limit","Cursor","FilterPostStatus","FilterAccountId","FilterAssetId","FilterPlatform",
    "FilterActor","FilterVia","FilterAgent","FilterTag","Query",
    "CreatedAfter","CreatedBefore","UpdatedAfter","ScheduledAfter","ScheduledBefore",
]]

op(path="/posts", method="GET", tag="Posts", verb="list",
   summary="List posts",
   what="Return posts in the current workspace, most recently scheduled first.",
   when="Any Posts view (Calendar/Board/List) uses this; agents call it to enumerate scheduled or failed work.",
   before="`accounts.list` to know which account to filter by.",
   after="`posts.get` or `posts.publish` on a specific id.",
   parameters=POST_LIST_PARAMS,
   response_schema="PostCollection", response_example="Post_Collection",
   workflow="plan_post", page="posts",
   related=["posts.create","posts.get","posts.status"],
   ai_summary="List posts with optional status, account, or time-window filters.",
   ai_example="Show me every failed post from the last 24 hours.",
   scopes=["posts:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/posts", method="POST", tag="Posts", verb="create",
   summary="Create a post",
   what="Create a Post in `draft`, or in `scheduled` if `scheduled_at` is provided.",
   when="Customer plans a post from the UI or an agent drafts one via MCP.",
   before="`assets.create` + `assets.complete` for any media; `accounts.list` for the destination.",
   after="`posts.schedule`, `posts.publish`, or `posts.update`.",
   body_schema="PostCreateInput", body_example="PostCreate_Req",
   response_schema="PostEnvelope", response_example="Post_Scheduled", response_status="201",
   workflow="plan_post", page="posts",
   related=["posts.schedule","posts.publish","assets.create","accounts.list"],
   next_step="posts.publish",
   ai_summary="Create a new post targeting one social account with one or more assets.",
   ai_example="Schedule a reel of summer-teaser.mp4 to @brand_alpha for tomorrow at 6pm.",
   scopes=["posts:write"],
   error_codes=["invalid_input","unauthenticated","forbidden","conflict","payment_required","rate_limited","internal"])

op(path="/posts/{post_id}", method="GET", tag="Posts", verb="get",
   summary="Get a post",
   what="Return one Post by id, including current status and failure detail if any.",
   when="Post detail page; agent inspecting the result of an action.",
   before="`posts.list` or the id returned by `posts.create`.",
   after="`posts.update`, `posts.publish`, `posts.cancel`.",
   parameters=[pref("Path_post_id")],
   response_schema="PostEnvelope", response_example="Post_Scheduled",
   workflow="plan_post", page="post_detail",
   related=["posts.status","posts.update","posts.publish","posts.cancel"],
   ai_summary="Fetch a single post by id.",
   ai_example="Show me post post_01H....",
   scopes=["posts:read"], idempotent=True)

op(path="/posts/{post_id}", method="PATCH", tag="Posts", verb="update",
   summary="Update a post",
   what="Update caption, first comment, tags, campaign, or attached assets. Only allowed while `draft` or `scheduled`.",
   when="Customer edits copy before publish; agent revises AI-generated draft.",
   before="`posts.get`.",
   after="`posts.publish` or `posts.schedule`.",
   parameters=[pref("Path_post_id")],
   body_schema="PostUpdateInput", body_example="PostCreate_Req",
   response_schema="PostEnvelope", response_example="Post_Scheduled",
   workflow="edit_post", page="post_detail",
   related=["posts.get","posts.publish"],
   ai_summary="Update a draft or scheduled post.",
   ai_example="Change the caption of post_01H... to 'Launch day!'.",
   scopes=["posts:write"],
   error_codes=["invalid_input","unauthenticated","forbidden","not_found","conflict","rate_limited","internal"])

op(path="/posts/{post_id}", method="DELETE", tag="Posts", verb="delete",
   summary="Delete a draft post",
   what="Permanently delete a Post that has never been scheduled or published.",
   when="Cleanup of drafts. Scheduled or published posts must be cancelled instead.",
   before="`posts.get` to confirm status is `draft`.",
   after="—",
   parameters=[pref("Path_post_id")],
   response_status="204",
   response_schema="PostEnvelope",  # not returned; kept for schema plumbing
   response_example="Post_Scheduled",
   workflow="edit_post", page="post_detail",
   extra_responses={"204": rref("NoContent")},
   related=["posts.cancel"],
   ai_summary="Delete a draft post.",
   ai_example="Delete the draft post_01H....",
   scopes=["posts:write"],
   error_codes=["unauthenticated","forbidden","not_found","conflict","rate_limited","internal"])
# strip the 200 default we don't want on DELETE
PATHS["/posts/{post_id}"]["delete"]["responses"].pop("200", None)

op(path="/posts/{post_id}/schedule", method="POST", tag="Posts", verb="schedule",
   summary="Schedule a post",
   what="Move a Post to `scheduled` at the given time. Rescheduling an already-scheduled Post is allowed.",
   when="Customer picks a time; agent schedules AI-drafted content.",
   before="`posts.create` (draft) or `posts.get`.",
   after="`posts.status`, `posts.publish`, `posts.cancel`.",
   parameters=[pref("Path_post_id")],
   body_schema="PostScheduleInput", body_example="PostSchedule_Req",
   response_schema="PostEnvelope", response_example="Post_Scheduled",
   workflow="schedule_post", page="post_detail",
   related=["posts.publish","posts.cancel","posts.bulk_reschedule"],
   next_step="posts.status",
   ai_summary="Set or change the scheduled time of a post.",
   ai_example="Push post_01H... to next Monday at 9am UTC.",
   scopes=["posts:write"],
   error_codes=["invalid_input","unauthenticated","forbidden","not_found","conflict","rate_limited","internal"])

op(path="/posts/{post_id}/publish", method="POST", tag="Posts", verb="publish",
   summary="Publish a post now",
   what="Publish immediately regardless of `scheduled_at`. Returns the updated Post; the platform confirmation is asynchronous.",
   when="Customer clicks Publish Now; agent responds to 'post this now'.",
   before="`posts.get` (status must be `draft`, `scheduled`, or `failed`).",
   after="`posts.status` to poll `publishing` → `published` / `failed`.",
   parameters=[pref("Path_post_id")],
   response_schema="PostEnvelope", response_example="Post_Published",
   workflow="publish_post", page="post_detail",
   related=["posts.status","posts.retry","webhooks.list_deliveries"],
   next_step="posts.status",
   ai_summary="Publish a post immediately.",
   ai_example="Publish post_01H... right now.",
   scopes=["posts:publish"], rate_tier="heavy",
   error_codes=["unauthenticated","forbidden","not_found","conflict","payment_required","rate_limited","service_unavailable","internal"])

op(path="/posts/{post_id}/cancel", method="POST", tag="Posts", verb="cancel",
   summary="Cancel a post",
   what="Move a Post to `cancelled`. Not allowed once `published`.",
   when="Customer withdraws before publish; agent aborts a mistaken draft.",
   before="`posts.get` (status ≠ `published`).",
   after="`posts.list` to refresh.",
   parameters=[pref("Path_post_id")],
   body_schema="PostCancelInput", body_example="PostCancel_Req", body_required=False,
   response_schema="PostEnvelope", response_example="Post_Scheduled",
   workflow="cancel_post", page="post_detail",
   related=["posts.bulk_cancel","posts.status"],
   ai_summary="Cancel a scheduled or failed post.",
   ai_example="Cancel every post scheduled for tomorrow.",
   scopes=["posts:write"])

op(path="/posts/{post_id}/retry", method="POST", tag="Posts", verb="retry",
   summary="Retry a failed post",
   what="Re-attempt publish on a Post whose status is `failed`.",
   when="After a transient platform failure; visible in Activity as `post.failed`.",
   before="`posts.get` (status must be `failed`).",
   after="`posts.status`.",
   parameters=[pref("Path_post_id")],
   response_schema="PostEnvelope", response_example="Post_Scheduled",
   workflow="retry_post", page="post_detail",
   related=["posts.publish","posts.status"],
   ai_summary="Retry publishing a failed post.",
   ai_example="Retry every failed post from last night.",
   scopes=["posts:publish"], rate_tier="heavy")

op(path="/posts/{post_id}/duplicate", method="POST", tag="Posts", verb="duplicate",
   summary="Duplicate a post",
   what="Create a new `draft` Post copying caption, assets, tags, and campaign from the source.",
   when="Customer repurposes a Post to another account or time slot.",
   before="`posts.get`.",
   after="`posts.update`, `posts.schedule`.",
   parameters=[pref("Path_post_id")],
   response_schema="PostEnvelope", response_example="Post_Scheduled", response_status="201",
   workflow="plan_post", page="post_detail",
   related=["posts.update","posts.schedule"],
   ai_summary="Duplicate a post as a new draft.",
   ai_example="Duplicate post_01H... for next week.",
   scopes=["posts:write"])

op(path="/posts/{post_id}/status", method="GET", tag="Posts", verb="status",
   summary="Get post status",
   what="Return the narrow lifecycle snapshot (id, status, updated_at). Cheap; safe to poll.",
   when="Polling after `publish`, `retry`, or a bulk operation.",
   before="`posts.publish`, `posts.retry`, or `posts.bulk_reschedule`.",
   after="`posts.get` for full detail once terminal.",
   parameters=[pref("Path_post_id")],
   response_schema="StatusEnvelope", response_example="PostStatus",
   workflow="publish_post", page="post_detail",
   related=["posts.get"],
   ai_summary="Cheap lifecycle status of a post.",
   ai_example="Is post_01H... published yet?",
   scopes=["posts:read"], idempotent=True)

op(path="/posts:bulk-cancel", method="POST", tag="Posts", verb="bulk_cancel",
   summary="Cancel many posts",
   what="Cancel up to 500 Posts in one call. Returns an async operation handle.",
   when="Campaign paused; agent cleans up bad drafts.",
   before="`posts.list` with `status=scheduled`.",
   after="`posts.list` or per-post `posts.status`.",
   body_schema="PostBulkCancelInput", body_example="PostBulkCancel_Req",
   response_schema="OperationEnvelope", response_example="Operation_Async", response_status="202",
   workflow="cancel_post", page="posts",
   related=["posts.cancel","posts.bulk_reschedule"],
   ai_summary="Bulk-cancel a set of posts.",
   ai_example="Cancel all posts I have scheduled for this weekend.",
   scopes=["posts:write"], rate_tier="bulk")

op(path="/posts:bulk-reschedule", method="POST", tag="Posts", verb="bulk_reschedule",
   summary="Reschedule many posts",
   what="Reschedule up to 500 Posts in one call. Returns an async operation handle.",
   when="Time-shift a campaign; move everything past a holiday.",
   before="`posts.list`.",
   after="Poll operation via `posts.status` per id or via Activity.",
   body_schema="PostBulkRescheduleInput", body_example="PostBulkReschedule_Req",
   response_schema="OperationEnvelope", response_example="Operation_Async", response_status="202",
   workflow="schedule_post", page="posts",
   related=["posts.schedule","posts.bulk_cancel"],
   ai_summary="Bulk-reschedule a set of posts.",
   ai_example="Push everything scheduled for Monday to Tuesday.",
   scopes=["posts:write"], rate_tier="bulk")

# ---------- ASSETS ----------------------------------------------------------

ASSET_LIST_PARAMS = [pref(p) for p in [
    "Limit","Cursor","FilterAssetStatus","FilterTag","Query",
    "FilterActor","FilterVia","FilterAgent",
    "CreatedAfter","CreatedBefore","UpdatedAfter",
]]

op(path="/assets", method="GET", tag="Assets", verb="list",
   summary="List assets",
   what="Return uploaded assets in the current workspace.",
   when="Assets grid; picker inside `posts.create`.",
   before="—",
   after="`assets.get`, `posts.create`.",
   parameters=ASSET_LIST_PARAMS,
   response_schema="AssetCollection", response_example="Asset_Ready",  # collection wraps items
   workflow="upload_asset", page="assets",
   related=["assets.create","posts.create"],
   ai_summary="List assets in the workspace.",
   ai_example="Show me all my reels tagged 'summer'.",
   scopes=["assets:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/assets", method="POST", tag="Assets", verb="create",
   summary="Initiate an asset upload",
   what="Reserve an Asset record and return a pre-signed upload URL. Two-step upload.",
   when="Before attaching media to a Post.",
   before="—",
   after="PUT bytes to the returned URL, then `assets.complete`.",
   body_schema="AssetCreateInput", body_example="AssetCreate_Req",
   response_schema="AssetCreateEnvelope", response_example="AssetCreate_Res", response_status="201",
   workflow="upload_asset", page="assets",
   related=["assets.complete","posts.create"],
   next_step="assets.complete",
   ai_summary="Reserve an asset and get an upload URL.",
   ai_example="I want to upload summer-teaser.mp4.",
   scopes=["assets:write"],
   error_codes=["invalid_input","unauthenticated","forbidden","payment_required","unsupported_media","rate_limited","internal"])

op(path="/assets/{asset_id}", method="GET", tag="Assets", verb="get",
   summary="Get an asset",
   what="Return one Asset by id, including status and CDN URL when `ready`.",
   when="Asset detail page.",
   before="`assets.list`.",
   after="`assets.update`, `posts.create`.",
   parameters=[pref("Path_asset_id")],
   response_schema="AssetEnvelope", response_example="Asset_Ready",
   workflow="upload_asset", page="asset_detail",
   related=["assets.list_posts"],
   ai_summary="Fetch a single asset by id.",
   ai_example="Show me asset ast_....",
   scopes=["assets:read"], idempotent=True)

op(path="/assets/{asset_id}", method="PATCH", tag="Assets", verb="update",
   summary="Update asset metadata",
   what="Rename or retag an Asset.",
   when="Library organization.",
   before="`assets.get`.",
   after="`assets.list`.",
   parameters=[pref("Path_asset_id")],
   body_schema="AssetUpdateInput", body_example="AssetCreate_Req",
   response_schema="AssetEnvelope", response_example="Asset_Ready",
   workflow="upload_asset", page="asset_detail",
   ai_summary="Rename or tag an asset.",
   ai_example="Tag ast_... as 'launch'.",
   scopes=["assets:write"])

op(path="/assets/{asset_id}", method="DELETE", tag="Assets", verb="delete",
   summary="Delete an asset",
   what="Delete an unreferenced Asset. Fails with `conflict` if any Post references it.",
   when="Library cleanup.",
   before="`assets.list_posts` to check references.",
   after="—",
   parameters=[pref("Path_asset_id")],
   response_status="204",
   response_schema="AssetEnvelope", response_example="Asset_Ready",
   extra_responses={"204": rref("NoContent")},
   workflow="upload_asset", page="asset_detail",
   ai_summary="Delete an unreferenced asset.",
   ai_example="Delete ast_....",
   scopes=["assets:write"],
   error_codes=["unauthenticated","forbidden","not_found","conflict","rate_limited","internal"])
PATHS["/assets/{asset_id}"]["delete"]["responses"].pop("200", None)

op(path="/assets/{asset_id}/complete", method="POST", tag="Assets", verb="complete",
   summary="Complete an asset upload",
   what="Finalize the upload started by `assets.create`. Kicks off server-side processing.",
   when="Immediately after successful PUT to the pre-signed URL.",
   before="`assets.create` and PUT the bytes.",
   after="Poll `assets.get`; use once `status = ready`.",
   parameters=[pref("Path_asset_id")],
   body_schema="AssetCompleteInput", body_example="AssetComplete_Req",
   response_schema="AssetEnvelope", response_example="Asset_Ready", response_status="202",
   workflow="upload_asset", page="assets",
   related=["assets.get","posts.create"], next_step="assets.get",
   ai_summary="Finalize an in-progress asset upload.",
   ai_example="I finished uploading; process it.",
   scopes=["assets:write"])

op(path="/assets/{asset_id}/posts", method="GET", tag="Assets", verb="list_posts",
   summary="List posts that use this asset",
   what="Return posts referencing the asset. Same shape as `posts.list`.",
   when="Asset detail page; before delete.",
   before="`assets.get`.",
   after="`posts.get`.",
   parameters=[pref("Path_asset_id"), pref("Limit"), pref("Cursor")],
   response_schema="PostCollection", response_example="Post_Collection",
   workflow="upload_asset", page="asset_detail",
   ai_summary="List posts using this asset.",
   ai_example="What posts use ast_...?",
   scopes=["posts:read","assets:read"], idempotent=True)

# ---------- ACCOUNTS --------------------------------------------------------

ACC_LIST_PARAMS = [pref(p) for p in ["Limit","Cursor","FilterAccountStatus","FilterPlatform","FilterTag","Query","CreatedAfter","CreatedBefore","UpdatedAfter"]]

op(path="/accounts", method="GET", tag="Accounts", verb="list",
   summary="List social accounts",
   what="Return every connected or delivered Social Account.",
   when="Accounts page; account picker in `posts.create`.",
   before="—",
   after="`accounts.get`, `posts.create`.",
   parameters=ACC_LIST_PARAMS,
   response_schema="SocialAccountCollection", response_example="Account_Collection",
   workflow="manage_account", page="accounts",
   related=["accounts.create","store.orders.create"],
   ai_summary="List all social accounts in the workspace.",
   ai_example="How many active IG accounts do I have?",
   scopes=["accounts:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/accounts", method="POST", tag="Accounts", verb="create",
   summary="Connect a social account",
   what="Connect an account you own to the workspace using credentials obtained via the connect flow.",
   when="Bring-your-own account. Bought accounts arrive via Deliveries.",
   before="Run the OAuth/credential exchange to get `credentials_ref`.",
   after="`accounts.get`, `posts.create`.",
   body_schema="AccountConnectInput", body_example="AccountConnect_Req",
   response_schema="SocialAccountEnvelope", response_example="Account_Active", response_status="201",
   workflow="connect_account", page="accounts",
   related=["accounts.rotate","posts.create"], next_step="posts.create",
   ai_summary="Connect an account you own.",
   ai_example="Connect my IG account @founder.",
   scopes=["accounts:write"])

op(path="/accounts/{account_id}", method="GET", tag="Accounts", verb="get",
   summary="Get a social account",
   what="Return one Social Account by id.",
   when="Account detail page.",
   before="`accounts.list`.",
   after="`accounts.list_posts`, `accounts.rotate`.",
   parameters=[pref("Path_account_id")],
   response_schema="SocialAccountEnvelope", response_example="Account_Active",
   workflow="manage_account", page="account_detail",
   related=["accounts.list_posts","accounts.rotate"],
   ai_summary="Fetch one social account.",
   ai_example="Show me acc_....",
   scopes=["accounts:read"], idempotent=True)

op(path="/accounts/{account_id}", method="PATCH", tag="Accounts", verb="update",
   summary="Update account metadata",
   what="Rename, retag, or update display name.",
   when="Housekeeping.",
   before="`accounts.get`.",
   after="—",
   parameters=[pref("Path_account_id")],
   body_schema="AccountUpdateInput", body_example="AccountConnect_Req",
   response_schema="SocialAccountEnvelope", response_example="Account_Active",
   workflow="manage_account", page="account_detail",
   ai_summary="Rename or tag a social account.",
   ai_example="Tag acc_... as 'launch'.",
   scopes=["accounts:write"])

op(path="/accounts/{account_id}", method="DELETE", tag="Accounts", verb="delete",
   summary="Retire a social account",
   what="Set the account to `retired`. History and past Posts are preserved.",
   when="Account no longer used.",
   before="`accounts.get`.",
   after="—",
   parameters=[pref("Path_account_id")],
   response_status="204",
   response_schema="SocialAccountEnvelope", response_example="Account_Active",
   extra_responses={"204": rref("NoContent")},
   workflow="retire_account", page="account_detail",
   ai_summary="Retire a social account.",
   ai_example="Retire acc_....",
   scopes=["accounts:write"])
PATHS["/accounts/{account_id}"]["delete"]["responses"].pop("200", None)

op(path="/accounts/{account_id}/rotate", method="POST", tag="Accounts", verb="rotate",
   summary="Rotate account credentials",
   what="Replace stored credentials. Used after platform re-auth or an `needs_attention` event.",
   when="An Activity `account.needs_attention` fires.",
   before="Run the re-auth flow to get a new `credentials_ref`.",
   after="`accounts.get` — expect `active`.",
   parameters=[pref("Path_account_id")],
   body_schema="AccountRotateInput", body_example="AccountConnect_Req",
   response_schema="SocialAccountEnvelope", response_example="Account_Active",
   workflow="rotate_account", page="account_detail",
   ai_summary="Rotate credentials on a social account.",
   ai_example="I re-authorized acc_...; save the new credentials.",
   scopes=["accounts:write"])

op(path="/accounts/{account_id}/posts", method="GET", tag="Accounts", verb="list_posts",
   summary="List posts on this account",
   what="Same shape as `posts.list`, pre-filtered.",
   when="Account detail page.",
   before="`accounts.get`.",
   after="`posts.get`.",
   parameters=[pref("Path_account_id"), pref("Limit"), pref("Cursor"), pref("FilterPostStatus")],
   response_schema="PostCollection", response_example="Post_Collection",
   workflow="plan_post", page="account_detail",
   ai_summary="List posts on this social account.",
   ai_example="What have I posted on acc_... this month?",
   scopes=["posts:read","accounts:read"], idempotent=True)

# ---------- PRODUCTS / ORDERS / DELIVERIES ---------------------------------

op(path="/products", method="GET", tag="Products", verb="list",
   summary="List products",
   what="Browse the Store catalog.",
   when="Store → Catalog page.",
   before="—",
   after="`orders.create`.",
   parameters=[pref("Limit"), pref("Cursor"), pref("FilterPlatform"), pref("Query")],
   response_schema="ProductCollection", response_example="Product_Collection",
   workflow="buy_accounts", page="store_catalog",
   related=["orders.create"],
   ai_summary="Browse purchasable products.",
   ai_example="What IG account packages do you sell?",
   scopes=["store:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/products/{product_id}", method="GET", tag="Products", verb="get",
   summary="Get a product",
   what="Return one product by id.",
   when="Product detail (rare — usually listed).",
   before="`products.list`.",
   after="`orders.create`.",
   parameters=[pref("Path_product_id")],
   response_schema="ProductEnvelope", response_example="Product_IGWarm",
   workflow="buy_accounts", page="store_catalog",
   ai_summary="Get one product.",
   ai_example="Show me prod_....",
   scopes=["store:read"], idempotent=True)

op(path="/orders", method="GET", tag="Orders", verb="list",
   summary="List orders",
   what="Return the current workspace's orders.",
   when="Store → Orders tab.",
   before="—",
   after="`orders.get`.",
   parameters=[pref("Limit"), pref("Cursor"), pref("FilterOrderStatus"), pref("FilterProductId"), pref("Query"), pref("CreatedAfter"), pref("CreatedBefore")],
   response_schema="OrderCollection", response_example="Order_Fulfilled",  # collection shape
   workflow="buy_accounts", page="store_orders",
   related=["orders.create","orders.get"],
   ai_summary="List store orders.",
   ai_example="What orders do I have pending?",
   scopes=["store:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/orders", method="POST", tag="Orders", verb="create",
   summary="Create an order",
   what="Create an Order and return a `checkout_url`. Order stays `pending` until payment.",
   when="Buy accounts.",
   before="`products.list`.",
   after="Send user to `checkout_url`; wait for `order.paid` → `delivery.ready`.",
   body_schema="OrderCreateInput", body_example="OrderCreate_Req",
   response_schema="OrderEnvelope", response_example="Order_Created", response_status="201",
   workflow="buy_accounts", page="store_catalog",
   related=["orders.get","deliveries.accept"], next_step="orders.get",
   ai_summary="Create a store order.",
   ai_example="Buy 3 warmed-up IG accounts.",
   scopes=["store:write"], rate_tier="heavy",
   error_codes=["invalid_input","unauthenticated","forbidden","payment_required","rate_limited","internal"])

op(path="/orders/{order_id}", method="GET", tag="Orders", verb="get",
   summary="Get an order",
   what="Return one Order by id, including linked Deliveries.",
   when="Order detail page.",
   before="`orders.list`.",
   after="`orders.list_deliveries`, `deliveries.accept`.",
   parameters=[pref("Path_order_id")],
   response_schema="OrderEnvelope", response_example="Order_Fulfilled",
   workflow="buy_accounts", page="order_detail",
   related=["orders.list_deliveries","orders.replacement"],
   ai_summary="Fetch one order.",
   ai_example="Show me ord_....",
   scopes=["store:read"], idempotent=True)

op(path="/orders/{order_id}/deliveries", method="GET", tag="Orders", verb="list_deliveries",
   summary="List an order's deliveries",
   what="Return the Deliveries that belong to this Order.",
   when="Order detail page.",
   before="`orders.get`.",
   after="`deliveries.accept`.",
   parameters=[pref("Path_order_id"), pref("Limit"), pref("Cursor")],
   response_schema="DeliveryCollection", response_example="Delivery_Ready",
   workflow="receive_delivery", page="order_detail",
   related=["deliveries.accept"],
   ai_summary="List deliveries for an order.",
   ai_example="What deliveries came from ord_...?",
   scopes=["store:read"], idempotent=True)

op(path="/orders/{order_id}/replacement", method="POST", tag="Orders", verb="replacement",
   summary="Request a replacement",
   what="File a replacement request against an Order (typically after an issue on a Delivery).",
   when="Delivery had bad accounts and warranty window is open.",
   before="`deliveries.report_issue` optionally.",
   after="Wait for Activity `order.fulfilled` again with new Deliveries.",
   parameters=[pref("Path_order_id")],
   body_schema="OrderReplacementInput", body_example="PostCancel_Req",  # small json — reuse cancel example shape
   response_schema="OrderEnvelope", response_example="Order_Fulfilled",
   workflow="replacement", page="order_detail",
   related=["deliveries.report_issue","orders.get"],
   ai_summary="Request replacement accounts for an order.",
   ai_example="Two accounts from ord_... don't work; request replacements.",
   scopes=["store:write"])

op(path="/deliveries", method="GET", tag="Deliveries", verb="list",
   summary="List deliveries",
   what="Return every Delivery in the workspace.",
   when="Store → Deliveries tab.",
   before="—",
   after="`deliveries.accept`.",
   parameters=[pref("Limit"), pref("Cursor"), pref("FilterDeliveryStatus"), pref("FilterOrderId")],
   response_schema="DeliveryCollection", response_example="Delivery_Ready",
   workflow="receive_delivery", page="store_deliveries",
   related=["deliveries.accept","deliveries.report_issue"],
   ai_summary="List all deliveries.",
   ai_example="Which deliveries are ready to accept?",
   scopes=["store:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/deliveries/{delivery_id}", method="GET", tag="Deliveries", verb="get",
   summary="Get a delivery",
   what="Return one Delivery by id.",
   when="Delivery detail page.",
   before="`deliveries.list` or `orders.list_deliveries`.",
   after="`deliveries.accept`.",
   parameters=[pref("Path_delivery_id")],
   response_schema="DeliveryEnvelope", response_example="Delivery_Ready",
   workflow="receive_delivery", page="delivery_detail",
   related=["deliveries.accept","deliveries.report_issue"],
   ai_summary="Fetch one delivery.",
   ai_example="Show me del_....",
   scopes=["store:read"], idempotent=True)

op(path="/deliveries/{delivery_id}/accept", method="POST", tag="Deliveries", verb="accept",
   summary="Accept a delivery",
   what="Accept the handover. Included Social Accounts move to `active` in Accounts.",
   when="Customer confirms delivery contents look right.",
   before="`deliveries.get` (status must be `ready`).",
   after="`accounts.list`, `posts.create`.",
   parameters=[pref("Path_delivery_id")],
   body_schema="DeliveryAcceptInput", body_example="DeliveryAccept_Req", body_required=False,
   response_schema="DeliveryEnvelope", response_example="Delivery_Ready",
   workflow="receive_delivery", page="delivery_detail",
   related=["accounts.list","posts.create"], next_step="posts.create",
   ai_summary="Accept a delivery.",
   ai_example="Accept del_....",
   scopes=["store:write"])

op(path="/deliveries/{delivery_id}/report-issue", method="POST", tag="Deliveries", verb="report_issue",
   summary="Report a delivery issue",
   what="Report a problem with delivered accounts.",
   when="One or more accounts don't work.",
   before="`deliveries.get`.",
   after="`orders.replacement`.",
   parameters=[pref("Path_delivery_id")],
   body_schema="DeliveryIssueInput", body_example="PostCancel_Req",
   response_schema="DeliveryEnvelope", response_example="Delivery_Ready",
   workflow="replacement", page="delivery_detail",
   related=["orders.replacement"], next_step="orders.replacement",
   ai_summary="Report an issue with a delivery.",
   ai_example="Two accounts in del_... are shadow-banned.",
   scopes=["store:write"])

# ---------- ACTIVITY --------------------------------------------------------

op(path="/activity", method="GET", tag="Activity", verb="list",
   summary="List activity events",
   what="Immutable, workspace-wide event log. Newest first.",
   when="Activity page; agent audits its own actions.",
   before="—",
   after="Open the referenced resource via its own tag.",
   parameters=[pref(p) for p in ["Limit","Cursor","FilterEvent","FilterActor","FilterVia","FilterAgent","CreatedAfter","CreatedBefore","Query"]],
   response_schema="ActivityCollection", response_example="Activity_Collection",
   workflow="audit", page="activity",
   related=["activity.get","webhooks.list"],
   ai_summary="Read the workspace audit log.",
   ai_example="What did the AI agent do in the last hour?",
   scopes=["activity:read"], idempotent=True,
   error_codes=["invalid_filter","unauthenticated","forbidden","rate_limited","internal"])

op(path="/activity/{activity_id}", method="GET", tag="Activity", verb="get",
   summary="Get one activity event",
   what="Return one activity event by id.",
   when="Debugging a specific event.",
   before="`activity.list`.",
   after="Open the referenced object.",
   parameters=[pref("Path_activity_id")],
   response_schema="ActivityEnvelope", response_example="Activity_Collection",
   workflow="audit", page="activity",
   ai_summary="Fetch one activity event.",
   ai_example="Show me act_....",
   scopes=["activity:read"], idempotent=True)

# ---------- WORKSPACE / MEMBERS / API KEYS / WEBHOOKS / NOTIFICATIONS ------

op(path="/workspace", method="GET", tag="Workspace", verb="get",
   summary="Get workspace",
   what="Return the current workspace singleton.",
   when="Settings → General.",
   before="—",
   after="`workspace.update`.",
   response_schema="WorkspaceEnvelope", response_example="Workspace",
   workflow="configure_workspace", page="settings_general",
   related=["workspace.update"],
   ai_summary="Get workspace settings.",
   ai_example="What timezone is my workspace in?",
   scopes=["workspace:read"], idempotent=True)

op(path="/workspace", method="PATCH", tag="Workspace", verb="update",
   summary="Update workspace",
   what="Update workspace configuration.",
   when="Settings → General.",
   before="`workspace.get`.",
   after="—",
   body_schema="WorkspaceUpdateInput", body_example="Workspace",
   response_schema="WorkspaceEnvelope", response_example="Workspace",
   workflow="configure_workspace", page="settings_general",
   ai_summary="Update workspace settings.",
   ai_example="Set my workspace timezone to Europe/Paris.",
   scopes=["workspace:admin"])

op(path="/workspace/members", method="GET", tag="Members", verb="list",
   summary="List members",
   what="Return all humans and AI members in the workspace.",
   when="Settings → Members.",
   before="—",
   after="`members.update` or `members.delete`.",
   parameters=[pref("Limit"), pref("Cursor"), pref("Query")],
   response_schema="MemberCollection", response_example="Member",
   workflow="manage_members", page="settings_members",
   related=["members.create"],
   ai_summary="List workspace members.",
   ai_example="Who has access to my workspace?",
   scopes=["members:read"], idempotent=True)

op(path="/workspace/members", method="POST", tag="Members", verb="create",
   summary="Invite a member",
   what="Invite a human by email with an initial role.",
   when="Settings → Members → Invite.",
   before="—",
   after="Recipient accepts the emailed invitation.",
   body_schema="MemberCreateInput", body_example="MemberInvite_Req",
   response_schema="MemberEnvelope", response_example="Member", response_status="201",
   workflow="invite_member", page="settings_members",
   related=["members.update","members.delete"],
   ai_summary="Invite a new member by email.",
   ai_example="Invite kai@alpha.example as an editor.",
   scopes=["members:write"])

op(path="/workspace/members/{member_id}", method="GET", tag="Members", verb="get",
   summary="Get a member",
   what="Return one member by id.",
   when="Settings → Members.",
   before="`members.list`.",
   after="—",
   parameters=[pref("Path_member_id")],
   response_schema="MemberEnvelope", response_example="Member",
   workflow="manage_members", page="settings_members",
   ai_summary="Fetch one member.",
   ai_example="Show me mem_....",
   scopes=["members:read"], idempotent=True)

op(path="/workspace/members/{member_id}", method="PATCH", tag="Members", verb="update",
   summary="Update a member's role",
   what="Change a member's role.",
   when="Promote/demote.",
   before="`members.get`.",
   after="—",
   parameters=[pref("Path_member_id")],
   body_schema="MemberUpdateInput", body_example="MemberInvite_Req",
   response_schema="MemberEnvelope", response_example="Member",
   workflow="manage_members", page="settings_members",
   ai_summary="Change a member's role.",
   ai_example="Make mem_... an admin.",
   scopes=["members:write"])

op(path="/workspace/members/{member_id}", method="DELETE", tag="Members", verb="delete",
   summary="Remove a member",
   what="Remove a member from the workspace.",
   when="Offboarding.",
   before="`members.get`.",
   after="—",
   parameters=[pref("Path_member_id")],
   response_status="204",
   response_schema="MemberEnvelope", response_example="Member",
   extra_responses={"204": rref("NoContent")},
   workflow="manage_members", page="settings_members",
   ai_summary="Remove a member.",
   ai_example="Remove mem_....",
   scopes=["members:write"])
PATHS["/workspace/members/{member_id}"]["delete"]["responses"].pop("200", None)

op(path="/workspace/api-keys", method="GET", tag="API Keys", verb="list",
   summary="List API keys",
   what="Return API keys in the workspace. Secrets are never returned.",
   when="Settings → API Keys.",
   before="—",
   after="`api_keys.create` or `api_keys.delete`.",
   parameters=[pref("Limit"), pref("Cursor")],
   response_schema="ApiKeyCollection", response_example="ApiKey_Created",
   workflow="manage_api_keys", page="settings_api_keys",
   related=["api_keys.create"],
   ai_summary="List API keys.",
   ai_example="What API keys exist in my workspace?",
   scopes=["api_keys:read"], idempotent=True)

op(path="/workspace/api-keys", method="POST", tag="API Keys", verb="create",
   summary="Create an API key",
   what="Create a new API key. The full secret is returned exactly once.",
   when="Setting up automation, MCP, or a CI job.",
   before="Decide the scope set.",
   after="Store the secret; use it as `Authorization: Bearer <secret>`.",
   body_schema="ApiKeyCreateInput", body_example="ApiKeyCreate_Req",
   response_schema="ApiKeyCreateEnvelope", response_example="ApiKey_Created", response_status="201",
   workflow="manage_api_keys", page="settings_api_keys",
   related=["api_keys.delete"],
   ai_summary="Create an API key with explicit scopes.",
   ai_example="Create a key for GitHub Actions that can publish posts.",
   scopes=["api_keys:write"])

op(path="/workspace/api-keys/{api_key_id}", method="GET", tag="API Keys", verb="get",
   summary="Get an API key",
   what="Return one API key's metadata.",
   when="Settings → API Keys.",
   before="`api_keys.list`.",
   after="—",
   parameters=[pref("Path_api_key_id")],
   response_schema="ApiKeyEnvelope", response_example="ApiKey_Created",
   workflow="manage_api_keys", page="settings_api_keys",
   ai_summary="Get one API key.",
   ai_example="Show me key_....",
   scopes=["api_keys:read"], idempotent=True)

op(path="/workspace/api-keys/{api_key_id}", method="DELETE", tag="API Keys", verb="delete",
   summary="Revoke an API key",
   what="Immediately revoke an API key. Subsequent calls with it return `unauthenticated`.",
   when="Rotation, offboarding, or leak.",
   before="`api_keys.get`.",
   after="—",
   parameters=[pref("Path_api_key_id")],
   response_status="204",
   response_schema="ApiKeyEnvelope", response_example="ApiKey_Created",
   extra_responses={"204": rref("NoContent")},
   workflow="manage_api_keys", page="settings_api_keys",
   ai_summary="Revoke an API key.",
   ai_example="Revoke key_....",
   scopes=["api_keys:write"])
PATHS["/workspace/api-keys/{api_key_id}"]["delete"]["responses"].pop("200", None)

op(path="/workspace/webhooks", method="GET", tag="Webhooks", verb="list",
   summary="List webhooks",
   what="Return webhook subscriptions in the workspace.",
   when="Settings → Webhooks.",
   before="—",
   after="`webhooks.create` or `webhooks.update`.",
   parameters=[pref("Limit"), pref("Cursor")],
   response_schema="WebhookCollection", response_example="Webhook",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="List webhook subscriptions.",
   ai_example="What webhooks am I subscribed to?",
   scopes=["webhooks:read"], idempotent=True)

op(path="/workspace/webhooks", method="POST", tag="Webhooks", verb="create",
   summary="Create a webhook",
   what="Subscribe a URL to one or more event types.",
   when="Wiring external automation.",
   before="Decide the URL and event set.",
   after="Trigger a test event; use `webhooks.replay_delivery` if needed.",
   body_schema="WebhookCreateInput", body_example="WebhookCreate_Req",
   response_schema="WebhookEnvelope", response_example="Webhook", response_status="201",
   workflow="manage_webhooks", page="settings_webhooks",
   related=["webhooks.list_deliveries","webhooks.replay_delivery"],
   ai_summary="Subscribe an HTTPS endpoint to workspace events.",
   ai_example="POST post.published events to https://hooks.example/insta-buddy.",
   scopes=["webhooks:manage"])

op(path="/workspace/webhooks/{webhook_id}", method="GET", tag="Webhooks", verb="get",
   summary="Get a webhook",
   what="Return one webhook.",
   when="Settings → Webhooks.",
   before="`webhooks.list`.",
   after="—",
   parameters=[pref("Path_webhook_id")],
   response_schema="WebhookEnvelope", response_example="Webhook",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="Get one webhook.",
   ai_example="Show me wh_....",
   scopes=["webhooks:read"], idempotent=True)

op(path="/workspace/webhooks/{webhook_id}", method="PATCH", tag="Webhooks", verb="update",
   summary="Update a webhook",
   what="Change URL, events, or active state.",
   when="Rotating endpoints; adjusting event subscription.",
   before="`webhooks.get`.",
   after="—",
   parameters=[pref("Path_webhook_id")],
   body_schema="WebhookUpdateInput", body_example="WebhookCreate_Req",
   response_schema="WebhookEnvelope", response_example="Webhook",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="Update a webhook.",
   ai_example="Add post.failed to wh_....",
   scopes=["webhooks:manage"])

op(path="/workspace/webhooks/{webhook_id}", method="DELETE", tag="Webhooks", verb="delete",
   summary="Delete a webhook",
   what="Delete a webhook subscription.",
   when="Endpoint retired.",
   before="`webhooks.get`.",
   after="—",
   parameters=[pref("Path_webhook_id")],
   response_status="204",
   response_schema="WebhookEnvelope", response_example="Webhook",
   extra_responses={"204": rref("NoContent")},
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="Delete a webhook.",
   ai_example="Delete wh_....",
   scopes=["webhooks:manage"])
PATHS["/workspace/webhooks/{webhook_id}"]["delete"]["responses"].pop("200", None)

op(path="/workspace/webhooks/{webhook_id}/rotate-secret", method="POST", tag="Webhooks", verb="rotate_secret",
   summary="Rotate webhook secret",
   what="Issue a new signing secret. Returned once.",
   when="Suspected leak.",
   before="`webhooks.get`.",
   after="Update receiver.",
   parameters=[pref("Path_webhook_id")],
   response_schema="WebhookEnvelope", response_example="Webhook",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="Rotate a webhook's signing secret.",
   ai_example="Rotate the secret on wh_....",
   scopes=["webhooks:manage"])

op(path="/workspace/webhooks/{webhook_id}/deliveries", method="GET", tag="Webhooks", verb="list_deliveries",
   summary="List webhook deliveries",
   what="Return recent delivery attempts for this webhook.",
   when="Debugging a broken receiver.",
   before="`webhooks.get`.",
   after="`webhooks.replay_delivery`.",
   parameters=[pref("Path_webhook_id"), pref("Limit"), pref("Cursor")],
   response_schema="WebhookDeliveryCollection", response_example="Webhook",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="List webhook delivery attempts.",
   ai_example="Show recent deliveries for wh_....",
   scopes=["webhooks:read"], idempotent=True)

op(path="/workspace/webhooks/{webhook_id}/deliveries/{webhook_delivery_id}/replay",
   method="POST", tag="Webhooks", verb="replay_delivery",
   summary="Replay a webhook delivery",
   what="Re-send a specific delivery attempt.",
   when="Receiver was down at delivery time.",
   before="`webhooks.list_deliveries`.",
   after="`webhooks.list_deliveries` — expect a new attempt.",
   parameters=[pref("Path_webhook_id"), pref("Path_webhook_delivery_id")],
   response_schema="WebhookEnvelope", response_example="Webhook", response_status="202",
   workflow="manage_webhooks", page="settings_webhooks",
   ai_summary="Replay a specific webhook delivery.",
   ai_example="Retry delivery wd_... for webhook wh_....",
   scopes=["webhooks:manage"])

op(path="/workspace/notifications", method="GET", tag="Notifications", verb="list",
   summary="List notifications",
   what="Return the current member's inbox.",
   when="Top-bar bell.",
   before="—",
   after="`notifications.read`.",
   parameters=[pref("Limit"), pref("Cursor")],
   response_schema="NotificationCollection", response_example="Notification_Collection",
   workflow="notify", page="notifications",
   related=["notifications.read","notifications.read_all"],
   ai_summary="List notifications for the current member.",
   ai_example="Show me my unread notifications.",
   scopes=["notifications:read"], idempotent=True)

op(path="/workspace/notifications/{notification_id}/read", method="POST", tag="Notifications", verb="read",
   summary="Mark a notification read",
   what="Mark one notification as read.",
   when="User clicks it.",
   before="`notifications.list`.",
   after="—",
   parameters=[pref("Path_notification_id")],
   response_schema="NotificationEnvelope", response_example="Notification_Collection",
   workflow="notify", page="notifications",
   ai_summary="Mark a notification as read.",
   ai_example="Mark ntf_01 as read.",
   scopes=["notifications:write"], idempotent=True)

op(path="/workspace/notifications:read-all", method="POST", tag="Notifications", verb="read_all",
   summary="Mark all notifications read",
   what="Mark every unread notification for the current member as read.",
   when="Clear inbox.",
   before="`notifications.list`.",
   after="—",
   response_schema="NotificationCollection", response_example="Notification_Collection",
   workflow="notify", page="notifications",
   ai_summary="Mark all notifications as read.",
   ai_example="Clear all my notifications.",
   scopes=["notifications:write"], idempotent=True)

# ---------- SEARCH & META --------------------------------------------------

op(path="/search", method="GET", tag="Search", verb="search",
   summary="Global search",
   what="Search across posts, assets, accounts, orders, deliveries, members, activity.",
   when="Cmd-K bar; agent orienting inside an unfamiliar workspace.",
   before="—",
   after="Open the returned resource via its own tag.",
   parameters=[{"name": "q", "in": "query", "required": True, "schema": {"type": "string"}, "description": "Query string."}, pref("Limit")],
   response_schema="SearchEnvelope", response_example="Search_Result",
   workflow="search", page="search",
   related=["posts.list","assets.list","accounts.list","orders.list","deliveries.list","activity.list"],
   ai_summary="Search everything in the workspace.",
   ai_example="Find anything matching 'summer'.",
   scopes=["search:read"], idempotent=True,
   error_codes=["invalid_input","unauthenticated","forbidden","rate_limited","internal"])

op(path="/me", method="GET", tag="Meta", verb="me",
   summary="Who am I",
   what="Return the current member and workspace.",
   when="Boot; showing 'signed in as'.",
   before="—",
   after="—",
   response_schema="MeEnvelope", response_example="Me",
   workflow="identity", page="any",
   ai_summary="Return the caller's member and workspace.",
   ai_example="Who am I signed in as?",
   scopes=["meta:read"], idempotent=True)

# Unauthenticated meta endpoints
def add_meta(path, method, op_id, summary, description_text, schema, example):
    PATHS.setdefault(path, {})[method.lower()] = {
        "tags": ["Meta"], "operationId": op_id, "summary": summary, "description": description_text,
        "security": [],
        "responses": {"200": {"description": summary,
                              "content": {"application/json": {"schema": ref(schema),
                                                              "examples": {"default": exref(example)}}}}},
        "x-workflow": "meta", "x-page": "any",
        "x-ai-summary": summary, "x-ai-example": summary,
        "x-scopes": [], "x-rate-limit-tier": "standard",
        "x-error-codes": [], "x-idempotent": True,
    }

add_meta("/health", "GET", "meta.health", "Health check",
         "Liveness probe. No auth required.",
         "HealthResponse", "Health")
add_meta("/openapi.json", "GET", "meta.openapi", "Serve the OpenAPI 3.1 specification",
         "Return this OpenAPI document. No auth required.",
         "HealthResponse", "Health")

# ---------- webhooks (outbound event contracts) ----------------------------

WEBHOOKS = {}
def add_webhook(event, summary, example_target_type, example_target_id):
    WEBHOOKS[event] = {
        "post": {
            "summary": summary,
            "operationId": f"webhook.{event.replace('.', '_')}",
            "description": f"Fired when `{event}` occurs. Payload is an `Activity` envelope.",
            "x-ai-summary": summary,
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": ref("ActivityEnvelope"),
                                                 "examples": {"default": {"value": {
                                                     "data": {"id": "act_01H8Z1P", "object": "activity",
                                                              "created_at": NOW, "updated_at": NOW,
                                                              "event": event,
                                                              "actor": {"type": "system", "id": "sys", "name": "publisher"},
                                                              "via": "system",
                                                              "target": {"type": example_target_type, "id": example_target_id},
                                                              "occurred_at": NOW,
                                                              "message": summary, "data": {}}}}}}},
            },
            "responses": {"2XX": {"description": "Receiver acknowledged."},
                          "4XX": {"description": "Receiver rejected; will retry with backoff."}},
        }
    }
for ev, s, tt, tid in [
    ("post.published",   "A post was confirmed live.",           "post",     POST_ID),
    ("post.failed",      "A post publish failed.",               "post",     POST_ID),
    ("delivery.ready",   "A delivery is ready to accept.",       "delivery", DELIVERY_ID),
    ("delivery.accepted","A delivery was accepted.",             "delivery", DELIVERY_ID),
    ("order.paid",       "An order was paid.",                   "order",    ORDER_ID),
    ("order.fulfilled",  "An order finished fulfilment.",        "order",    ORDER_ID),
    ("account.needs_attention","An account requires credential rotation.","social_account", ACCOUNT_ID),
    ("asset.ready",      "An asset finished processing.",        "asset",    ASSET_ID),
]:
    add_webhook(ev, s, tt, tid)

# ---------- assemble --------------------------------------------------------

SPEC = OrderedDict([
    ("openapi", "3.1.0"),
    ("info", INFO),
    ("servers", SERVERS),
    ("security", SECURITY),
    ("tags", TAGS),
    ("x-tagGroups", TAG_GROUPS),
    ("paths", OrderedDict(sorted(PATHS.items()))),
    ("webhooks", WEBHOOKS),
    ("components", OrderedDict([
        ("schemas", SCHEMAS),
        ("parameters", PARAMETERS),
        ("responses", RESPONSES),
        ("headers", HEADERS),
        ("examples", EXAMPLES),
        ("securitySchemes", SECURITY_SCHEMES),
    ])),
])

# ---------- internal lint ---------------------------------------------------

def lint(spec):
    problems = []
    ops = []
    for p, methods in spec["paths"].items():
        for m, o in methods.items():
            ops.append((p, m.upper(), o))
    seen_ids = set()
    for p, m, o in ops:
        if "tags" not in o or not o["tags"]:
            problems.append(f"{m} {p}: missing tag")
        if "operationId" not in o:
            problems.append(f"{m} {p}: missing operationId")
        else:
            if o["operationId"] in seen_ids:
                problems.append(f"{m} {p}: duplicate operationId {o['operationId']}")
            seen_ids.add(o["operationId"])
        for k in ("summary", "description"):
            if k not in o or not o[k]:
                problems.append(f"{m} {p}: missing {k}")
        # AI metadata (skip for meta unauth endpoints)
        if o.get("tags", [""])[0] != "Meta":
            for k in ("x-workflow", "x-page", "x-ai-summary", "x-ai-example", "x-scopes", "x-rate-limit-tier", "x-error-codes"):
                if k not in o:
                    problems.append(f"{m} {p}: missing {k}")
        # every response has an example (checked shallowly)
        for code, r in o.get("responses", {}).items():
            if "$ref" in r: continue
            if "content" in r:
                for ct, mt in r["content"].items():
                    if "examples" not in mt and "example" not in mt and "schema" not in mt:
                        problems.append(f"{m} {p} {code}: missing example/schema")
    # No inline schemas anywhere in paths (must be $ref)
    def walk(node, trail):
        if isinstance(node, dict):
            if "schema" in node and isinstance(node["schema"], dict):
                s = node["schema"]
                if "$ref" not in s and "type" not in s and "allOf" not in s and "oneOf" not in s and "anyOf" not in s:
                    problems.append(f"inline non-$ref schema at {'/'.join(trail)}")
            for k, v in node.items():
                walk(v, trail + [str(k)])
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, trail + [str(i)])
    walk(spec["paths"], ["paths"])
    return problems

problems = lint(SPEC)
if problems:
    print("LINT ISSUES:")
    for p in problems[:50]:
        print("  -", p)
    print(f"({len(problems)} total)")
else:
    print("Lint: OK")

# ---------- write -----------------------------------------------------------

os.makedirs("docs", exist_ok=True)
with open("docs/openapi.json", "w") as f:
    json.dump(SPEC, f, indent=2)
# yaml with unicode preserved, blocks not flow
class _OD(yaml.SafeDumper): pass
_OD.add_representer(OrderedDict, lambda d, data: d.represent_mapping("tag:yaml.org,2002:map", data.items()))
with open("docs/openapi.yaml", "w") as f:
    yaml.dump(SPEC, f, Dumper=_OD, sort_keys=False, allow_unicode=True, width=100)

print(f"Wrote docs/openapi.json  ({os.path.getsize('docs/openapi.json')} bytes)")
print(f"Wrote docs/openapi.yaml  ({os.path.getsize('docs/openapi.yaml')} bytes)")
print(f"Operations: {sum(len(v) for v in PATHS.values())}")
print(f"Paths: {len(PATHS)}")
print(f"Schemas: {len(SCHEMAS)}")
print(f"Examples: {len(EXAMPLES)}")
print(f"Tags: {len(TAGS)}")
