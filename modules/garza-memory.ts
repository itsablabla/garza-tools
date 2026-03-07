import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = environment.N8N_INSTANCE_URL;
  const n8nKey = environment.N8N_API_KEY;

  if (!n8nUrl || !n8nKey) {
    return new Response(
      JSON.stringify({ error: "N8N credentials not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const body = request.method !== "GET" ? await request.json() : {};
  const action = path.endsWith("/store") ? "store" : "recall";

  // Try n8n webhook first
  const webhookUrl = `${n8nUrl}/webhook/garza-memory`;
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });

  if (resp.ok) {
    const result = await resp.text();
    return new Response(result, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fallback: use n8n execute API with the GARZA Memory workflow
  const MEMORY_WORKFLOW_ID = environment.GARZA_MEMORY_WORKFLOW_ID || "4gfOMFoM0GGdG2u6";
  const execUrl = `${n8nUrl}/api/v1/workflows/${MEMORY_WORKFLOW_ID}/execute`;
  const execResp = await fetch(execUrl, {
    method: "POST",
    headers: {
      "X-N8N-API-KEY": n8nKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { action, ...body } }),
  });

  const result = await execResp.text();
  return new Response(result, {
    status: execResp.status,
    headers: { "Content-Type": "application/json" },
  });
}
