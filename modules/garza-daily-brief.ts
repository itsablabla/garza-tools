import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

interface ServiceCheck {
  name: string;
  ok: boolean;
  latencyMs?: number;
}

async function checkService(name: string, url: string): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const resp = await fetch(url);
    return { name, ok: resp.ok, latencyMs: Date.now() - start };
  } catch {
    return { name, ok: false, latencyMs: Date.now() - start };
  }
}

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = environment.N8N_INSTANCE_URL;
  const n8nKey = environment.N8N_API_KEY;
  const zuploKey = environment.ZUPLO_API_KEY;

  const timestamp = new Date().toISOString();
  const results: Record<string, unknown> = {
    timestamp,
    source: "garza-tools-v2",
    environment: environment.ZUPLO_ENVIRONMENT_STAGE || "unknown",
  };

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

      const n8nResult: Record<string, unknown> = { status: "healthy" };

      if (workflowsResp.ok) {
        const wfData = await workflowsResp.json() as { data: unknown[] };
        n8nResult.activeWorkflows = wfData.data?.length || 0;
      }

      if (execResp.ok) {
        const execData = await execResp.json() as {
          data: Array<{ status: string; startedAt: string }>;
        };
        const execs = execData.data || [];
        n8nResult.recentExecutions = {
          total: execs.length,
          succeeded: execs.filter((e) => e.status === "success").length,
          failed: execs.filter((e) => e.status === "error").length,
          lastRun: execs[0]?.startedAt || null,
        };
      }

      results.n8n = n8nResult;
    } catch (err) {
      results.n8n = {
        status: "unreachable",
        error: err instanceof Error ? err.message : "Unknown",
      };
    }
  } else {
    results.n8n = { status: "not_configured" };
  }

  // 2. Zuplo API Key Service
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
      } else {
        results.zuplo = { status: "degraded", httpStatus: resp.status };
      }
    } catch {
      results.zuplo = { status: "unreachable" };
    }
  } else {
    results.zuplo = { status: "not_configured" };
  }

  // 3. Service Health Spot-Check
  const serviceChecks = await Promise.all([
    checkService("zuplo-mcp", "https://zuplo-mcp.vercel.app/health"),
    checkService("garza-mcp-router", "https://garza-mcp-router.vercel.app"),
  ]);
  results.services = serviceChecks;

  // 4. Summary
  const n8nHealthy = (results.n8n as Record<string, unknown>)?.status === "healthy";
  const zuploHealthy = (results.zuplo as Record<string, unknown>)?.status === "healthy";
  const allServicesOk = serviceChecks.every((s) => s.ok);

  const alerts: string[] = [];
  if (!n8nHealthy) alerts.push("n8n automation is not reachable");
  if (!zuploHealthy) alerts.push("Zuplo API key service not responding");
  if (!allServicesOk) alerts.push("One or more downstream services are down");

  results.summary = {
    overall: alerts.length === 0 ? "healthy" : "degraded",
    readyForDay: n8nHealthy,
    alerts,
  };

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
