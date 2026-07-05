import { defineMcp } from "@lovable.dev/mcp-js";
import listEndpoints from "./tools/list-endpoints";
import getEndpointSchema from "./tools/get-endpoint-schema";
import invokeEndpoint from "./tools/invoke-endpoint";

// Remote MCP server generated from the live OpenAPI document
// (`docs/openapi.json`). Every endpoint in the public REST API is reachable
// through the three meta-tools below — as endpoints are added to the API, they
// become callable through MCP automatically with no server change.
export default defineMcp({
  name: "insta-buddy-api",
  title: "InstaBuddy API",
  version: "0.1.0",
  instructions:
    "Tools for the InstaBuddy public REST API. Start with `list_endpoints` to discover available operations, then `get_endpoint_schema` for parameter/body shapes, then `invoke_endpoint` to call the API. Authentication uses a workspace API key (sk_live_... or sk_test_...) issued from Settings → API Keys, passed to `invoke_endpoint` as `api_key`.",
  tools: [listEndpoints, getEndpointSchema, invokeEndpoint],
});
