import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const n8nUrl = environment.N8N_INSTANCE_URL;
  const n8nKey = environment.N8N_API_KEY;
  const telegramToken = environment.TELEGRAM_BOT_TOKEN;
  const telegramChatId = environment.TELEGRAM_CHAT_ID;

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

  const steps = results.steps as Array<{
    step: string;
    status: string;
    detail?: string;
  }>;

  // Step 1: Validate
  steps.push({ step: "validate", status: "passed" });

  // Step 2: Trigger n8n Nomad Onboarding workflow
  if (n8nUrl && n8nKey) {
    try {
      const webhookResp = await fetch(`${n8nUrl}/webhook/nomad-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          email,
          plan,
          deviceIccid,
          address,
          notes,
        }),
      });

      if (webhookResp.ok) {
        steps.push({
          step: "n8n_onboarding_workflow",
          status: "triggered",
          detail: "Webhook accepted",
        });
      } else {
        steps.push({
          step: "n8n_onboarding_workflow",
          status: "failed",
          detail: `HTTP ${webhookResp.status}`,
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
    steps.push({
      step: "n8n_onboarding_workflow",
      status: "skipped",
      detail: "n8n not configured",
    });
  }

  // Step 3: Send Telegram alert to Jaden
  if (telegramToken && telegramChatId) {
    try {
      const alertMsg = `⚪ *GARZA OS Alert*\n*Priority:* NORMAL\n*Category:* nomad\n\nNew Nomad customer onboarded: *${customerName}* (${email}) on plan *${plan}*.${deviceIccid ? ` Device ICCID: \`${deviceIccid}\`` : ""}`;
      const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
      const alertResp = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: alertMsg,
          parse_mode: "Markdown",
        }),
      });
      steps.push({
        step: "send_alert",
        status: alertResp.ok ? "sent" : "failed",
      });
    } catch {
      steps.push({ step: "send_alert", status: "skipped" });
    }
  } else {
    steps.push({ step: "send_alert", status: "skipped", detail: "Telegram not configured" });
  }

  // Summary
  const allPassed = steps.every(
    (s) => s.status !== "failed" && s.status !== "error"
  );
  results.status = allPassed ? "success" : "partial";
  results.message = allPassed
    ? `Customer ${customerName} onboarded successfully.`
    : `Onboarding completed with some issues. Review steps above.`;

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
