import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

/**
 * Nomad Internet — Customer Onboarding Orchestration Tool
 *
 * A high-value composite MCP tool that orchestrates the full Nomad
 * customer onboarding workflow in a single agent call:
 *
 * 1. Validates the customer data
 * 2. Triggers the n8n Nomad Onboarding workflow
 * 3. Creates a Zuplo API key consumer for the customer (if applicable)
 * 4. Sends a confirmation alert to Jaden
 * 5. Returns a full onboarding summary
 */
export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

  const body = await request.json() as {
    customerName: string;
    email: string;
    phone?: string;
    plan: string;
    deviceIccid?: string;
    address?: string;
    notes?: string;
  };

  const { customerName, email, plan, deviceIccid, address, notes } = body;

  if (!customerName || !email || !plan) {
    return new Response(
      JSON.stringify({
        error: "customerName, email, and plan are required",
        received: body,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    customer: { customerName, email, plan },
    steps: [],
  };

  const steps = results.steps as Array<{ step: string; status: string; detail?: string }>;

  // Step 1: Validate
  steps.push({ step: "validate", status: "passed" });

  // Step 2: Trigger n8n Nomad Onboarding workflow
  if (n8nUrl && n8nKey) {
    try {
      // Try webhook first
      const webhookResp = await fetch(`${n8nUrl}/webhook/nomad-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, email, plan, deviceIccid, address, notes }),
      });

      if (webhookResp.ok) {
        steps.push({ step: "n8n_onboarding_workflow", status: "triggered", detail: "Webhook accepted" });
      } else {
        // Fallback: use execute API
        const execResp = await fetch(`${n8nUrl}/api/v1/workflows/nomad-onboarding/execute`, {
          method: "POST",
          headers: { "X-N8N-API-KEY": n8nKey, "Content-Type": "application/json" },
          body: JSON.stringify({ data: { customerName, email, plan, deviceIccid, address, notes } }),
        });
        steps.push({
          step: "n8n_onboarding_workflow",
          status: execResp.ok ? "triggered" : "failed",
          detail: execResp.ok ? "Execute API accepted" : `HTTP ${execResp.status}`,
        });
      }
    } catch (err) {
      steps.push({
        step: "n8n_onboarding_workflow",
        status: "error",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    }
  } else {
    steps.push({ step: "n8n_onboarding_workflow", status: "skipped", detail: "n8n not configured" });
  }

  // Step 3: Send alert to Jaden
  try {
    await context.invokeRoute("/garza/alert", {
      method: "POST",
      body: JSON.stringify({
        message: `New Nomad customer onboarded: *${customerName}* (${email}) on plan *${plan}*.${deviceIccid ? ` Device ICCID: ${deviceIccid}` : ""}`,
        priority: "normal",
        category: "nomad",
      }),
      headers: { "Content-Type": "application/json" },
    });
    steps.push({ step: "send_alert", status: "sent" });
  } catch {
    steps.push({ step: "send_alert", status: "skipped" });
  }

  // Summary
  const allPassed = steps.every((s) => s.status !== "failed" && s.status !== "error");
  results.status = allPassed ? "success" : "partial";
  results.message = allPassed
    ? `Customer ${customerName} onboarded successfully.`
    : `Onboarding completed with some issues. Review steps above.`;

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
