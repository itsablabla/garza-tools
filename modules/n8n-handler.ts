import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

  if (!n8nUrl || !n8nKey) {
    return new Response(
      JSON.stringify({ error: "N8N_INSTANCE_URL or N8N_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const path = url.pathname;

  const headers: Record<string, string> = {
    "X-N8N-API-KEY": n8nKey,
    "Content-Type": "application/json",
  };

  // POST /n8n/trigger — trigger a workflow via webhook
  if (path === "/n8n/trigger" && request.method === "POST") {
    const body = await request.json() as { workflowId: string; payload?: object };
    const { workflowId, payload } = body;

    if (!workflowId) {
      return new Response(
        JSON.stringify({ error: "workflowId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use n8n REST API to execute workflow
    const execUrl = `${n8nUrl}/api/v1/workflows/${workflowId}/execute`;
    const resp = await fetch(execUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: payload || {} }),
    });

    const result = await resp.text();
    return new Response(result, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // GET /n8n/workflows — list active workflows
  if (path === "/n8n/workflows" && request.method === "GET") {
    const resp = await fetch(
      `${n8nUrl}/api/v1/workflows?active=true&limit=100`,
      { headers }
    );
    const data = await resp.json() as { data: Array<{ id: string; name: string; active: boolean }> };
    const workflows = (data.data || []).map((w) => ({
      id: w.id,
      name: w.name,
      active: w.active,
    }));

    return new Response(
      JSON.stringify({ count: workflows.length, workflows }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // GET /n8n/executions — get recent executions
  if (path === "/n8n/executions" && request.method === "GET") {
    const workflowId = url.searchParams.get("workflowId");
    const limit = url.searchParams.get("limit") || "20";
    let execUrl = `${n8nUrl}/api/v1/executions?limit=${limit}&includeData=false`;
    if (workflowId) execUrl += `&workflowId=${workflowId}`;

    const resp = await fetch(execUrl, { headers });
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
