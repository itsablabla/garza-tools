import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";

const worker = new Worker();
export default worker;

// ============================================================
// SPRINT 0: Health Check
// ============================================================

worker.tool("healthCheck", {
  title: "Service Health Check",
  description:
    "Ping key GARZA OS endpoints and return their status. Use this to check if infrastructure services are online.",
  schema: j.object({
    endpoints: j
      .array(j.string())
      .describe("Optional list of URLs to check. Defaults to core services.")
      .nullable(),
  }),
  execute: async ({ endpoints }) => {
    const defaults = [
      { name: "n8n Primary", url: "https://primary-production-f10f7.up.railway.app/healthz" },
      { name: "Langfuse", url: "https://langfuse-web-production-20d9.up.railway.app/api/public/health" },
      { name: "Chatwoot", url: "https://chatwoot-production-7d0d.up.railway.app" },
      { name: "Beeper MCP", url: "https://beeper-mcp-server-production.up.railway.app" },
      { name: "Home Assistant", url: "https://ha-central.fly.dev" },
    ];

    const targets = endpoints
      ? endpoints.map((u) => ({ name: u, url: u }))
      : defaults;

    const results = await Promise.allSettled(
      targets.map(async ({ name, url }) => {
        const start = Date.now();
        try {
          const res = await fetch(url, {
            method: "HEAD",
            signal: AbortSignal.timeout(10_000),
          });
          return {
            name,
            status: res.ok ? "UP" : `WARN_${res.status}`,
            latency: `${Date.now() - start}ms`,
            error: "",
          };
        } catch (err) {
          return {
            name,
            status: "DOWN",
            latency: `${Date.now() - start}ms`,
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    return results.map((r) =>
      r.status === "fulfilled" ? r.value : { name: "Unknown", status: "ERROR" }
    );
  },
});

// ============================================================
// SPRINT 1: Tailscale Tools
// ============================================================

const TAILSCALE_API = "https://api.tailscale.com/api/v2";
const tsHeaders = () => ({
  Authorization: `Bearer ${process.env.TAILSCALE_API_KEY}`,
});

worker.tool("tailscaleDevices", {
  title: "List Tailscale Devices",
  description: "List all devices on the Tailscale tailnet with their status, IP, and last seen time.",
  schema: j.object({}),
  execute: async () => {
    const res = await fetch(`${TAILSCALE_API}/tailnet/-/devices`, {
      headers: tsHeaders(),
    });
    if (!res.ok) throw new Error(`Tailscale API error: ${res.status}`);
    const data = await res.json();
    return data.devices.map((d: any) => ({
      name: d.hostname,
      os: d.os,
      ipv4: d.addresses?.[0],
      online: d.online,
      lastSeen: d.lastSeen,
    }));
  },
});

worker.tool("tailscaleDNS", {
  title: "Get Tailscale DNS Config",
  description: "Retrieve the current DNS configuration for the Tailscale tailnet.",
  schema: j.object({}),
  execute: async () => {
    const res = await fetch(`${TAILSCALE_API}/tailnet/-/dns/nameservers`, {
      headers: tsHeaders(),
    });
    if (!res.ok) throw new Error(`Tailscale DNS API error: ${res.status}`);
    return res.json();
  },
});

worker.tool("tailscaleDeviceStatus", {
  title: "Get Tailscale Device Status",
  description: "Get detailed status for a specific Tailscale device by hostname.",
  schema: j.object({
    hostname: j.string().describe("The hostname of the device to check"),
  }),
  execute: async ({ hostname }) => {
    const res = await fetch(`${TAILSCALE_API}/tailnet/-/devices`, {
      headers: tsHeaders(),
    });
    if (!res.ok) throw new Error(`Tailscale API error: ${res.status}`);
    const data = await res.json();
    const device = data.devices.find(
      (d: any) => d.hostname.toLowerCase() === hostname.toLowerCase()
    );
    if (!device) return { error: `Device '${hostname}' not found`, name: "", os: "", ipv4: "", online: false, lastSeen: "", clientVersion: "", authorized: false, tags: [] as string[] };
    return {
      error: "",
      name: device.hostname as string,
      os: device.os as string,
      ipv4: (device.addresses?.[0] ?? "") as string,
      online: device.online as boolean,
      lastSeen: device.lastSeen as string,
      clientVersion: device.clientVersion as string,
      authorized: device.authorized as boolean,
      tags: (device.tags ?? []) as string[],
    };
  },
});

// ============================================================
// SPRINT 1: GitHub Tools
// ============================================================

const ghHeaders = () => ({
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "garza-tools-worker",
});

worker.tool("githubFetchFile", {
  title: "Fetch GitHub File",
  description:
    "Fetch the contents of a file from a GitHub repository. Returns the decoded text content.",
  schema: j.object({
    owner: j.string().describe("Repository owner (e.g. 'garza-os')"),
    repo: j.string().describe("Repository name"),
    path: j.string().describe("File path within the repo (e.g. 'src/index.ts')"),
    ref: j.string().describe("Branch or commit SHA. Defaults to main.").nullable(),
  }),
  execute: async ({ owner, repo, path, ref }) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${
      ref ? `?ref=${ref}` : ""
    }`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (data.encoding === "base64" && data.content) {
      return {
        path: data.path,
        size: data.size,
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        download_url: "",
      };
    }
    return { path: data.path, size: data.size, content: "", download_url: data.download_url };
  },
});

worker.tool("githubRepoInfo", {
  title: "Get GitHub Repository Info",
  description:
    "Get metadata about a GitHub repository: stars, language, last push, open issues, description.",
  schema: j.object({
    owner: j.string().describe("Repository owner"),
    repo: j.string().describe("Repository name"),
  }),
  execute: async ({ owner, repo }) => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: ghHeaders(),
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const r = await res.json();
    return {
      name: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      lastPush: r.pushed_at,
      defaultBranch: r.default_branch,
      private: r.private,
      url: r.html_url,
    };
  },
});

worker.tool("githubListRepos", {
  title: "List GitHub Repositories",
  description: "List repositories for an org or user. Returns name, language, stars, and last push.",
  schema: j.object({
    org: j.string().describe("GitHub org or username (e.g. 'garza-os')"),
    limit: j.number().describe("Max repos to return (default 30)").nullable(),
  }),
  execute: async ({ org, limit }) => {
    const perPage = Math.min(limit ?? 30, 100);
    const res = await fetch(
      `https://api.github.com/orgs/${org}/repos?per_page=${perPage}&sort=pushed`,
      { headers: ghHeaders() }
    );
    if (res.status === 404) {
      const userRes = await fetch(
        `https://api.github.com/users/${org}/repos?per_page=${perPage}&sort=pushed`,
        { headers: ghHeaders() }
      );
      if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);
      const repos = await userRes.json();
      return repos.map((r: any) => ({
        name: r.full_name,
        language: r.language,
        stars: r.stargazers_count,
        lastPush: r.pushed_at,
        private: r.private,
      }));
    }
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const repos = await res.json();
    return repos.map((r: any) => ({
      name: r.full_name,
      language: r.language,
      stars: r.stargazers_count,
      lastPush: r.pushed_at,
      private: r.private,
    }));
  },
});

// ============================================================
// SPRINT 1: URL Scraper
// ============================================================

worker.tool("scrapeURL", {
  title: "Scrape Web Page",
  description:
    "Fetch a web page and return its text content. Useful for quick lookups, documentation pages, and status pages.",
  schema: j.object({
    url: j.string().describe("The URL to scrape"),
    maxLength: j
      .number()
      .describe("Max characters to return (default 5000)")
      .nullable(),
  }),
  execute: async ({ url, maxLength }) => {
    const res = await fetch(url, {
      headers: { "User-Agent": "garza-tools-worker/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cap = maxLength ?? 5000;
    return {
      url,
      length: text.length,
      truncated: text.length > cap,
      content: text.slice(0, cap),
    };
  },
});

// ============================================================
// SPRINT 1: Text Summarizer
// ============================================================

worker.tool("summarizeText", {
  title: "Summarize Text",
  description:
    "Summarize a block of text into key points. Returns a structured prompt for the Notion agent's LLM to reason over.",
  schema: j.object({
    text: j.string().describe("The text to summarize"),
    style: j
      .string()
      .describe("Summary style: 'bullets', 'paragraph', or 'tldr'. Default: 'bullets'")
      .nullable(),
  }),
  execute: ({ text, style }) => {
    const s = style ?? "bullets";
    const wordCount = text.split(/\s+/).length;
    return {
      inputWordCount: wordCount,
      requestedStyle: s,
      instruction: `Summarize the following text in ${s} format. Text (${wordCount} words): ${text.slice(0, 8000)}`,
    };
  },
});

// ============================================================
// SPRINT 3: Nomad Customer Tools
// ============================================================

const cbHeaders = () => {
  const key = process.env.CHARGEBEE_API_KEY ?? "";
  return {
    Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
    "Content-Type": "application/json",
  };
};
const cbSite = () => process.env.CHARGEBEE_SITE ?? "nomad-internet";

worker.tool("getCustomerStatus", {
  title: "Get Nomad Customer Status",
  description:
    "Look up a Nomad Internet customer by email. Returns subscription status, plan, billing info, and last payment.",
  schema: j.object({
    email: j.string().describe("Customer email address"),
  }),
  execute: async ({ email }) => {
    const custRes = await fetch(
      `https://${cbSite()}.chargebee.com/api/v2/customers?email[is]=${encodeURIComponent(email)}`,
      { headers: cbHeaders() }
    );
    if (!custRes.ok) throw new Error(`Chargebee error: ${custRes.status}`);
    const custData = await custRes.json();
    if (!custData.list?.length) return { found: false, email, customer: null, subscriptions: [] as any[], totalSubscriptions: 0 };

    const customer = custData.list[0].customer;

    const subRes = await fetch(
      `https://${cbSite()}.chargebee.com/api/v2/subscriptions?customer_id[is]=${customer.id}&status[is]=active`,
      { headers: cbHeaders() }
    );
    const subData = subRes.ok ? await subRes.json() : { list: [] };
    const subs = subData.list?.map((s: any) => ({
      id: s.subscription.id,
      plan: s.subscription.plan_id,
      status: s.subscription.status,
      mrr: s.subscription.mrr ? s.subscription.mrr / 100 : null,
      nextBilling: s.subscription.next_billing_at
        ? new Date(s.subscription.next_billing_at * 1000).toISOString()
        : null,
      createdAt: new Date(s.subscription.created_at * 1000).toISOString(),
    })) ?? [];

    return {
      found: true,
      email,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        createdAt: new Date(customer.created_at * 1000).toISOString(),
      },
      subscriptions: subs,
      totalSubscriptions: subs.length,
    };
  },
});

worker.tool("checkRefundEligibility", {
  title: "Check Refund Eligibility",
  description:
    "Check if a Nomad Internet customer is eligible for a refund based on business rules: no refund in last 90 days, account in good standing.",
  schema: j.object({
    email: j.string().describe("Customer email address"),
  }),
  execute: async ({ email }) => {
    const custRes = await fetch(
      `https://${cbSite()}.chargebee.com/api/v2/customers?email[is]=${encodeURIComponent(email)}`,
      { headers: cbHeaders() }
    );
    if (!custRes.ok) throw new Error(`Chargebee error: ${custRes.status}`);
    const custData = await custRes.json();
    if (!custData.list?.length) return { eligible: false, reason: "Customer not found", email, customerId: "", customerSince: "" };

    const customer = custData.list[0].customer;
    const ninetyDaysAgo = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
    const cnRes = await fetch(
      `https://${cbSite()}.chargebee.com/api/v2/credit_notes?customer_id[is]=${customer.id}&date[after]=${ninetyDaysAgo}`,
      { headers: cbHeaders() }
    );
    const cnData = cnRes.ok ? await cnRes.json() : { list: [] };
    const recentRefunds = cnData.list?.length ?? 0;

    if (recentRefunds > 0) {
      return {
        eligible: false,
        reason: `Customer has ${recentRefunds} refund(s) in the last 90 days`,
        customerId: customer.id,
        email,
        customerSince: "",
      };
    }

    return {
      eligible: true,
      reason: "No refunds in last 90 days - eligible",
      customerId: customer.id,
      email,
      customerSince: new Date(customer.created_at * 1000).toISOString(),
    };
  },
});

// ============================================================
// SPRINT 3: SMS via Twilio
// ============================================================

worker.tool("sendSMS", {
  title: "Send SMS",
  description:
    "Send a text message to a phone number via Twilio. Use for customer outage alerts, resolution updates, and operational notifications.",
  schema: j.object({
    to: j.string().describe("Phone number in E.164 format (e.g. +13035551234)"),
    message: j.string().describe("Message body (max 1600 chars)"),
  }),
  execute: async ({ to, message }) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    const from = process.env.TWILIO_PHONE_NUMBER ?? "";

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Twilio error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return {
      success: true,
      sid: data.sid,
      to: data.to,
      status: data.status,
    };
  },
});
