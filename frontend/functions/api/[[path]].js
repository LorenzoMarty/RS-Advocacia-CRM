/**
 * Cloudflare Pages Function — reverse-proxy for /api/*
 *
 * Why: frontend (pages.dev) and backend (sslip.io) are different sites.
 * Safari/WebKit blocks third-party cookies unconditionally, causing Google
 * OAuth to loop. This proxy makes all /api/* calls same-origin on pages.dev
 * so session cookies become first-party.
 *
 * Required Pages runtime env var:
 *   BACKEND_ORIGIN = https://api.203.0.113.10.sslip.io  (no trailing slash)
 */
export async function onRequest(context) {
  const { request, env } = context;
  const backendOrigin = env.BACKEND_ORIGIN;

  if (!backendOrigin) {
    return new Response("BACKEND_ORIGIN not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const target = backendOrigin + url.pathname + url.search;

  const upstreamHeaders = new Headers(request.headers);
  upstreamHeaders.delete("host");

  const isBodyless = ["GET", "HEAD"].includes(request.method);

  let backendResp;
  try {
    backendResp = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders,
      body: isBodyless ? undefined : request.body,
      // manual: CF Workers surfaces the actual 3xx response (not opaque like browser).
      // This lets OAuth redirects (→Google, →frontend) pass through to the browser.
      redirect: "manual",
    });
  } catch (err) {
    return new Response("Upstream unreachable: " + err.message, { status: 502 });
  }

  // If redirect:'manual' produced an opaque response (status 0), fall back to
  // following the redirect and relaying the final response. This is a safety net;
  // CF Workers should surface 3xx properly, but some older compat dates may not.
  if (backendResp.status === 0) {
    try {
      backendResp = await fetch(target, {
        method: request.method,
        headers: upstreamHeaders,
        body: isBodyless ? undefined : request.body,
        redirect: "follow",
      });
    } catch (err) {
      return new Response("Redirect follow failed: " + err.message, { status: 502 });
    }
  }

  // Relay the response. Pass headers directly — avoids getSetCookie() which
  // requires a modern compatibility date and may not be available.
  return new Response(backendResp.body, {
    status: backendResp.status,
    statusText: backendResp.statusText,
    headers: backendResp.headers,
  });
}
