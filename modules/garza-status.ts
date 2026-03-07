import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

interface ServiceStatus {
  name: string;
  url: string;
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

async function checkService(
  name: string,
  url: string,
  timeoutMs = 5000
): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - start;
    return {
      name,
      url,
      status: resp.ok ? "healthy" : "degraded",
      latencyMs,
    };
  } catch (err) {
    return {
      name,
      url,
      status: "down",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = environment.N8N_INSTANCE_URL;

  const services: Array<{ name: string; url: string }> = [
    { name: "Zuplo MCP (Vercel)", url: "https://zuplo-mcp.vercel.app/health" },
    {
      name: "garza-tools Gateway",
      url: "https://garza-tools-main-fb2210a.zuplo.app/health",
    },
    {
      name: "Clawhost API",
      url: "https://clawhost-api-jadens-projects.vercel.app",
    },
    {
      name: "Peta Core",
      url: "https://peta-core-git-main-jadens-projects.vercel.app",
    },
  ];

  if (n8nUrl) {
    services.push({ name: "n8n Automation", url: `${n8nUrl}/healthz` });
  }

  const results = await Promise.all(
    services.map((s) => checkService(s.name, s.url))
  );

  const healthy = results.filter((r) => r.status === "healthy").length;
  const degraded = results.filter((r) => r.status === "degraded").length;
  const down = results.filter((r) => r.status === "down").length;

  const overallStatus =
    down > 0 ? "degraded" : degraded > 0 ? "degraded" : "healthy";

  return new Response(
    JSON.stringify({
      overall: overallStatus,
      summary: { healthy, degraded, down, total: results.length },
      services: results,
      timestamp: new Date().toISOString(),
      gateway: "garza-tools v2.0.0",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
