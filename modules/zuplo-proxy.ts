import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const ZUPLO_BASE = "https://dev.zuplo.com/v1";
const ACCOUNT = "crimson_influential_koala";
const PROJECT = "garza-tools";

export default async function (
  request: ZuploRequest,
  context: ZuploContext
): Promise<Response> {
  const apiKey = context.variables.get("ZUPLO_API_KEY") as string;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ZUPLO_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const search = url.search;

  let upstreamPath = "";

  if (path === "/zuplo/who-am-i") {
    upstreamPath = "/who-am-i";
  } else if (path === "/zuplo/buckets") {
    upstreamPath = `/accounts/${ACCOUNT}/key-buckets`;
  } else if (path === "/zuplo/consumers") {
    const bucketName = url.searchParams.get("bucketName") || `zprj-uaadqyqkl0ien8szzusct2dj-working-copy`;
    upstreamPath = `/accounts/${ACCOUNT}/key-buckets/${bucketName}/consumers`;
  } else if (path.startsWith("/zuplo/consumers/") && path.endsWith("/keys")) {
    const parts = path.split("/");
    const consumerName = parts[3];
    const bucketName = url.searchParams.get("bucketName") || `zprj-uaadqyqkl0ien8szzusct2dj-working-copy`;
    upstreamPath = `/accounts/${ACCOUNT}/key-buckets/${bucketName}/consumers/${consumerName}/keys`;
  } else if (path.match(/^\/zuplo\/consumers\/[^/]+\/keys\/[^/]+$/)) {
    const parts = path.split("/");
    const consumerName = parts[3];
    const keyId = parts[5];
    const bucketName = url.searchParams.get("bucketName") || `zprj-uaadqyqkl0ien8szzusct2dj-working-copy`;
    upstreamPath = `/accounts/${ACCOUNT}/key-buckets/${bucketName}/consumers/${consumerName}/keys/${keyId}`;
  } else if (path.match(/^\/zuplo\/consumers\/[^/]+$/)) {
    const consumerName = path.split("/")[3];
    const bucketName = url.searchParams.get("bucketName") || `zprj-uaadqyqkl0ien8szzusct2dj-working-copy`;
    upstreamPath = `/accounts/${ACCOUNT}/key-buckets/${bucketName}/consumers/${consumerName}`;
  }

  const upstreamUrl = `${ZUPLO_BASE}${upstreamPath}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "DELETE") {
    fetchOptions.body = await request.text();
  }

  const resp = await fetch(upstreamUrl, fetchOptions);
  const body = await resp.text();

  return new Response(body, {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
