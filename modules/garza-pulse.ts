import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

  if (!n8nUrl || !n8nKey) {
    return new Response(
      JSON.stringify({ error: "n8n credentials not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Try to fetch the latest GARZA PULSE brief from n8n
  // The GARZA PULSE UI workflow ID
  const PULSE_WORKFLOW_ID = "7Yi5SCaKznY2U4oF";

  const execUrl = `${n8nUrl}/api/v1/executions?workflowId=${PULSE_WORKFLOW_ID}&limit=1&includeData=false`;
  const resp = await fetch(execUrl, {
    headers: {
      "X-N8N-API-KEY": n8nKey,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    return new Response(
      JSON.stringify({
        status: "unavailable",
        message: "GARZA Pulse service is initializing.",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await resp.json() as { data: Array<{ id: string; startedAt: string; stoppedAt: string; status: string }> };
  const executions = data.data || [];
  const latest = executions[0];

  return new Response(
    JSON.stringify({
      status: "ok",
      latestRun: latest
        ? {
            id: latest.id,
            startedAt: latest.startedAt,
            stoppedAt: latest.stoppedAt,
            status: latest.status,
          }
        : null,
      message: "GARZA Pulse is active. Latest execution details above.",
      pulseUrl: `${n8nUrl}/workflow/${PULSE_WORKFLOW_ID}`,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
