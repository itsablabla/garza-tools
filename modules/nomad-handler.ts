import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

  const url = new URL(request.url);
  const path = url.pathname;

  // GET /nomad/subscriber/:id
  if (path.startsWith("/nomad/subscriber/")) {
    const subscriberId = path.split("/")[3];
    if (!subscriberId) {
      return new Response(
        JSON.stringify({ error: "subscriberId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Trigger n8n subscriber lookup workflow
    const execUrl = `${n8nUrl}/api/v1/workflows/subscriber-lookup/execute`;
    const resp = await fetch(execUrl, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": n8nKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { subscriberId } }),
    });

    if (!resp.ok) {
      // Return a structured placeholder response
      return new Response(
        JSON.stringify({
          subscriberId,
          status: "lookup_unavailable",
          message: "Subscriber lookup service is being configured. Check back soon.",
          hint: "Use the ThingSpace MCP tool (nomad-thingspace-line-manager) for live device data.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await resp.text();
    return new Response(result, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // GET /nomad/financial/summary
  if (path === "/nomad/financial/summary") {
    // Trigger n8n financial summary workflow
    const execUrl = `${n8nUrl}/api/v1/workflows/financial-summary/execute`;
    const resp = await fetch(execUrl, {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": n8nKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: {} }),
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          status: "service_initializing",
          message: "Financial summary service is being configured.",
          hint: "Use the data-analysis-plugin skill or query the Nomad financial dashboards directly.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await resp.text();
    return new Response(result, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
