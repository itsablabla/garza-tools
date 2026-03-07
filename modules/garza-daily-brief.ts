import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

/**
 * GARZA OS Daily Brief — Composite Orchestration Tool
 *
 * Aggregates data from multiple GARZA OS services in a single call:
 * - n8n: Recent workflow execution health
 * - Zuplo: API gateway status and consumer count
 * - System: All service health checks
 *
 * This is a high-value MCP tool that gives Jaden a complete morning
 * intelligence brief in one tool call.
 */
export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;
  const zuploKey = context.variables.get("ZUPLO_API_KEY") as string;

  const timestamp = new Date().toISOString();
  const results: Record<string, unknown> = { timestamp, source: "garza-tools-v2" };

  // 1. n8n Automation Health
  if (n8nUrl && n8nKey) {
    try {
      const [workflowsResp, execResp] = await Promise.all([
        fetch(`${n8nUrl}/api/v1/workflows?active=true&limit=100`, {
          headers: { "X-N8N-API-KEY": n8nKey },
        }),
        fetch(`${n8nUrl}/api/v1/executions?limit=10&includeData=false`, {
          headers: { "X-N8N-API-KEY": n8nKey },
        }),
      ]);

      if (workflowsResp.ok) {
        const wfData = await workflowsResp.json() as { data: unknown[] };
        results.n8n = {
          status: "healthy",
          activeWorkflows: wfData.data?.length || 0,
        };
      }

      if (execResp.ok) {
        const execData = await execResp.json() as { data: Array<{ status: string; startedAt: string }> };
        const execs = execData.data || [];
        const failed = execs.filter((e) => e.status === "error").length;
        const succeeded = execs.filter((e) => e.status === "success").length;
        (results.n8n as Record<string, unknown>).recentExecutions = {
          total: execs.length,
          succeeded,
          failed,
          lastRun: execs[0]?.startedAt || null,
        };
      }
    } catch {
      results.n8n = { status: "unreachable" };
    }
  } else {
    results.n8n = { status: "not_configured" };
  }

  // 2. Zuplo API Key Consumer Count
  if (zuploKey) {
    try {
      const resp = await fetch(
        "https://dev.zuplo.com/v1/accounts/crimson_influential_koala/key-buckets",
        { headers: { Authorization: `Bearer ${zuploKey}` } }
      );
      if (resp.ok) {
        const data = await resp.json() as { data: unknown[] };
        results.zuplo = {
          status: "healthy",
          buckets: data.data?.length || 0,
        };
      }
    } catch {
      results.zuplo = { status: "unreachable" };
    }
  }

  // 3. Service Health Spot-Check
  const serviceChecks = await Promise.allSettled([
    fetch("https://zuplo-mcp.vercel.app/health").then((r) => ({
      name: "zuplo-mcp",
      ok: r.ok,
    })),
    fetch("https://garza-mcp-router.vercel.app").then((r) => ({
      name: "garza-mcp-router",
      ok: r.ok,
    })),
  ]);

  results.services = serviceChecks.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return { name: "unknown", ok: false };
  });

  // 4. Summary
  const n8nHealthy = (results.n8n as Record<string, unknown>)?.status === "healthy";
  const zuploHealthy = (results.zuplo as Record<string, unknown>)?.status === "healthy";
  const servicesHealthy = (results.services as Array<{ ok: boolean }>).every((s) => s.ok);

  results.summary = {
    overall: n8nHealthy && zuploHealthy ? "healthy" : "degraded",
    readyForDay: n8nHealthy,
    alerts: [
      ...(!n8nHealthy ? ["n8n automation is not reachable"] : []),
      ...(!zuploHealthy ? ["Zuplo API key service not responding"] : []),
      ...(!servicesHealthy ? ["One or more downstream services are down"] : []),
    ],
  };

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
