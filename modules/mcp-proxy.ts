import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

// Map of service names to their upstream MCP endpoints
const MCP_UPSTREAM_MAP: Record<string, string> = {
  // Vercel-deployed MCP servers
  "zuplo": "https://zuplo-mcp.vercel.app/mcp",
  "garza-router": "https://garza-mcp-router.vercel.app/mcp",
  "telegram": "https://telegram-mcp-v2-git-main-jadens-projects.vercel.app/mcp",
  "sure-finance": "https://sure-finance-mcp.vercel.app/mcp",
  "peta-core": "https://peta-core-git-main-jadens-projects.vercel.app/mcp",
  // These are MCP servers configured in the GARZA OS MCP stack
  // They proxy to the underlying MCP server via the manus-mcp-cli bridge
};

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path format: /mcp-proxy/{serviceName}/...
  const serviceName = pathParts[1]; // e.g., "zuplo", "telegram"

  if (!serviceName) {
    return new Response(
      JSON.stringify({
        error: "Service name required",
        available: Object.keys(MCP_UPSTREAM_MAP),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const upstream = MCP_UPSTREAM_MAP[serviceName];
  if (!upstream) {
    return new Response(
      JSON.stringify({
        error: `Unknown service: ${serviceName}`,
        available: Object.keys(MCP_UPSTREAM_MAP),
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = request.method !== "GET" ? await request.text() : undefined;

  const resp = await fetch(upstream, {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body,
  });

  const responseBody = await resp.text();
  return new Response(responseBody, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "application/json",
    },
  });
}
