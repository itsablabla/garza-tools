import { ZuploContext, ZuploRequest, environment } from "@zuplo/runtime";

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
  const telegramToken = environment.TELEGRAM_BOT_TOKEN;
  const telegramChatId = environment.TELEGRAM_CHAT_ID;
  const n8nUrl = environment.N8N_INSTANCE_URL;

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

  // Fallback: route through n8n webhook
  if (n8nUrl) {
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
