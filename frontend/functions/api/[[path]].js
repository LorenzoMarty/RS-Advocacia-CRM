/**
 * Cloudflare Pages Function — reverse-proxy for /api/*
 *
 * Why this file exists:
 *   Frontend lives on rs-advocacia.pages.dev; backend on api.35...sslip.io.
 *   Those are different sites, so the Django session cookie is a third-party
 *   cookie. WebKit (Safari + all iOS browsers) blocks third-party cookies
 *   unconditionally, causing Google OAuth to loop back to the login screen.
 *
 *   This proxy makes the browser see one origin: all /api/* requests route
 *   through Cloudflare Edge to the backend. Session cookies become first-party
 *   on pages.dev and Safari stops blocking them.
 *
 * Required Pages environment variable:
 *   BACKEND_ORIGIN = https://api.203.0.113.10.sslip.io  (no trailing slash)
 *
 * Notes:
 *   - redirect:'manual' passes 302s (OAuth start → Google, callback → frontend)
 *     straight to the browser without the Function chasing them.
 *   - getSetCookie() returns an array, preserving multiple Set-Cookie headers
 *     (Django sets both sessionid and csrftoken).
 *   - No SESSION_COOKIE_DOMAIN is set on the backend; cookies are host-only
 *     and attach to whatever origin responds — pages.dev in production.
 *     Keep it that way: do NOT add a Domain= attribute on the backend.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const backendOrigin = env.BACKEND_ORIGIN;

  if (!backendOrigin) {
    return new Response("BACKEND_ORIGIN env var not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const target = backendOrigin + url.pathname + url.search;

  const upstreamHeaders = new Headers(request.headers);
  // Remove host so the backend sees its own domain in the Host header.
  upstreamHeaders.delete("host");

  const isBodyless = ["GET", "HEAD"].includes(request.method);

  const backendResp = await fetch(target, {
    method: request.method,
    headers: upstreamHeaders,
    body: isBodyless ? undefined : request.body,
    // Pass redirects through to the browser intact (OAuth flows depend on this).
    redirect: "manual",
  });

  // Relay all response headers, preserving multiple Set-Cookie values.
  const respHeaders = new Headers(backendResp.headers);
  respHeaders.delete("set-cookie");
  for (const cookie of backendResp.headers.getSetCookie()) {
    respHeaders.append("set-cookie", cookie);
  }

  return new Response(backendResp.body, {
    status: backendResp.status,
    statusText: backendResp.statusText,
    headers: respHeaders,
  });
}
