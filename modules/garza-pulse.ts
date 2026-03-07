import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = environment.N8N_INSTANCE_URL;
  const n8nKey = environment.N8N_API_KEY;
  const PULSE_WORKFLOW_ID = environment.GARZA_PULSE_WORKFLOW_ID || "7Yi5SCaKznY2U4oF";

  if (!n8nUrl || !n8nKey) {
    return new Response(
      JSON.stringify({
        status: "not_configured",
        message: "GARZA Pulse requires N8N_INSTANCE_URL and N8N_API_KEY environment variables.",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
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

    const data = await resp.json() as {
      data: Array<{
        id: string;
        startedAt: string;
        stoppedAt: string;
        status: string;
      }>;
    };
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
        message: "GARZA Pulse is active.",
        pulseUrl: `${n8nUrl}/workflow/${PULSE_WORKFLOW_ID}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
