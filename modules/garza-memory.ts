import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

// GARZA Memory Service workflow ID in n8n
const MEMORY_WORKFLOW_ID = "4gfOMFoM0GGdG2u6";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

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

  // Trigger the GARZA Memory Service workflow via n8n webhook
  const webhookUrl = `${n8nUrl}/webhook/garza-memory`;

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });

  if (!resp.ok) {
    // Fallback: use n8n execute API
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

  const result = await resp.text();
  return new Response(result, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
