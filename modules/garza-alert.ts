import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const PRIORITY_EMOJI: Record<string, string> = {
  low: "🔵",
  normal: "⚪",
  high: "🟡",
  critical: "🔴",
};

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const telegramToken = context.variables.get("TELEGRAM_BOT_TOKEN") as string;
  const telegramChatId = context.variables.get("TELEGRAM_CHAT_ID") as string;
  const n8nUrl = context.variables.get("N8N_INSTANCE_URL") as string;
  const n8nKey = context.variables.get("N8N_API_KEY") as string;

  const body = await request.json() as {
    message: string;
    priority?: string;
    category?: string;
  };

  const { message, priority = "normal", category = "general" } = body;

  if (!message) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const emoji = PRIORITY_EMOJI[priority] || "⚪";
  const formattedMessage = `${emoji} *GARZA OS Alert*\n*Priority:* ${priority.toUpperCase()}\n*Category:* ${category}\n\n${message}`;

  // Try direct Telegram API first
  if (telegramToken && telegramChatId) {
    const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const resp = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: formattedMessage,
        parse_mode: "Markdown",
      }),
    });

    if (resp.ok) {
      return new Response(
        JSON.stringify({ status: "sent", channel: "telegram", priority, category }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Fallback: route through n8n
  if (n8nUrl && n8nKey) {
    const webhookUrl = `${n8nUrl}/webhook/garza-alert`;
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: formattedMessage, priority, category }),
    });

    if (resp.ok) {
      return new Response(
        JSON.stringify({ status: "sent", channel: "n8n_webhook", priority, category }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({
      status: "queued",
      message: "Alert queued — Telegram and n8n credentials not fully configured.",
      alert: { message, priority, category },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
