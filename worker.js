import { onRequestGet as handlePresetsGet } from "./functions/api/presets.js";
import { onRequestGet as handleTikTokResolveGet } from "./functions/api/tiktok-resolve.js";
import { onRequestGet as handleTikTokFpsGet } from "./functions/api/tiktok-fps.js";
import { onRequestGet as handleGitHubRepoGet } from "./functions/api/github-repo.js";
import { onRequestPost as handlePregenPost } from "./functions/api/pregen.js";

const API_RATE_LIMIT_SEC = 15;
const PREGEN_RATE_LIMIT_SEC = 86400; // 24 jam (1 hari)
const localRateLimits = new Map();

function jsonError(message, status, extraHeaders) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: Object.assign({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }, extraHeaders || {})
  });
}

function getClientIp(request) {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return cfIp.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "local";
}

function isAllowedApiCaller(request, url) {
  const expectedOrigin = url.origin;
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  const fetchSite = request.headers.get("Sec-Fetch-Site");

  // Blokir request cross-site dari website lain
  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  // Jika browser mengirim Origin (selalu ada di POST & cross-origin), wajib sama persis
  if (origin && origin !== expectedOrigin) {
    return false;
  }

  // Jika ada Referer, origin-nya wajib sama persis
  if (referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  // Blokir akses langsung tanpa Origin/Referer/Sec-Fetch-Site (misal curl / scraper polos)
  if (!origin && !referer && fetchSite !== "same-origin") {
    return false;
  }

  return true;
}

function formatRetryTime(seconds) {
  if (seconds >= 3600) {
    const h = Math.ceil(seconds / 3600);
    return `${h} jam`;
  }
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `${m} menit`;
  }
  return `${Math.max(1, Math.ceil(seconds))} detik`;
}

async function checkRateLimit(bucket, ip, ttlSeconds, ctx) {
  const now = Date.now();
  const keyStr = `${bucket}:${ip}`;

  // 1. Cek fallback memory lokal (untuk dev / warm isolate)
  const memResetAt = localRateLimits.get(keyStr);
  if (memResetAt && memResetAt > now) {
    return { allowed: false, retryAfter: Math.ceil((memResetAt - now) / 1000) };
  }

  // 2. Cek Cloudflare Edge Cache (persisten antar isolate dalam PoP)
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`https://ratelimit.cutefish.internal/${encodeURIComponent(bucket)}/${encodeURIComponent(ip)}`, {
    method: "GET"
  });

  if (edgeCache) {
    try {
      const hit = await edgeCache.match(cacheKey);
      if (hit) {
        const data = await hit.json().catch(() => ({}));
        const resetAt = Number(data.resetAt || 0);
        const remaining = resetAt > now ? Math.ceil((resetAt - now) / 1000) : ttlSeconds;
        localRateLimits.set(keyStr, now + remaining * 1000);
        return { allowed: false, retryAfter: remaining };
      }
    } catch { }
  }

  // Simpan jendela rate limit baru
  const resetAt = now + ttlSeconds * 1000;
  localRateLimits.set(keyStr, resetAt);

  if (edgeCache) {
    const marker = new Response(JSON.stringify({ resetAt }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`
      }
    });
    const putPromise = edgeCache.put(cacheKey, marker).catch(() => {});
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(putPromise);
    } else {
      await putPromise;
    }
  }

  return { allowed: true, retryAfter: 0 };
}

function makeContext(request, env, ctx) {
  return {
    request,
    env,
    waitUntil: (promise) => {
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(promise);
      }
    }
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      // Tolak CORS preflight dari domain lain
      if (request.method === "OPTIONS") {
        return jsonError("Forbidden", 403);
      }

      // Proteksi Same-Origin: hanya boleh dipanggil dari website sendiri
      if (!isAllowedApiCaller(request, url)) {
        return jsonError("Akses API ditolak (hanya untuk domain resmi).", 403);
      }

      const ip = getClientIp(request);

      // Khusus /api/pregen: 1 IP maksimal 1 request per 1 hari (per step: send-link & activate)
      if (request.method === "POST" && url.pathname === "/api/pregen") {
        let action = "default";
        try {
          const parsed = await request.clone().json();
          if (parsed && typeof parsed.action === "string") {
            action = parsed.action;
          }
        } catch {
          return jsonError("Invalid JSON request", 400);
        }

        if (action !== "send-link" && action !== "activate") {
          return jsonError("Action tidak dikenal.", 400);
        }

        const rl = await checkRateLimit(`pregen-${action}`, ip, PREGEN_RATE_LIMIT_SEC, ctx);
        if (!rl.allowed) {
          return jsonError(
            `Batas penggunaan Pre-Gen tercapai (1x per hari). Coba lagi dalam ${formatRetryTime(rl.retryAfter)}.`,
            429,
            { "Retry-After": String(rl.retryAfter) }
          );
        }

        return handlePregenPost(makeContext(request, env, ctx));
      }

      // Endpoint /api/github-repo: read-only & sudah di-edge-cache (user buka list lalu klik app dalam <15 detik)
      if (request.method === "GET" && url.pathname === "/api/github-repo") {
        return handleGitHubRepoGet(makeContext(request, env, ctx));
      }

      // Endpoint /api/* lainnya: 1 IP maksimal 1 request per 15 detik
      if (request.method === "GET") {
        let handler = null;
        if (url.pathname === "/api/presets") handler = handlePresetsGet;
        else if (url.pathname === "/api/tiktok-resolve") handler = handleTikTokResolveGet;
        else if (url.pathname === "/api/tiktok-fps") handler = handleTikTokFpsGet;

        if (handler) {
          const rl = await checkRateLimit(`api-${url.pathname}`, ip, API_RATE_LIMIT_SEC, ctx);
          if (!rl.allowed) {
            return jsonError(
              `Terlalu banyak permintaan. Coba lagi dalam ${formatRetryTime(rl.retryAfter)}.`,
              429,
              { "Retry-After": String(rl.retryAfter) }
            );
          }
          return handler(makeContext(request, env, ctx));
        }
      }

      return jsonError("Not found", 404);
    }

    if (env && env.ASSETS) {
      if (request.method === "GET" || request.method === "HEAD") {
        const presetRouteMatch = url.pathname.match(/^\/(\d+)(\/)?$/);
        if (presetRouteMatch) {
          if (presetRouteMatch[2]) {
            const cleanUrl = new URL(`/${presetRouteMatch[1]}${url.search}`, url);
            return Response.redirect(cleanUrl.toString(), 302);
          }
          const homeUrl = new URL("/home", url);
          homeUrl.search = url.search;
          let res = await env.ASSETS.fetch(new Request(homeUrl.toString(), request));
          if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get("location");
            if (loc) {
              res = await env.ASSETS.fetch(new Request(new URL(loc, url).toString(), request));
            }
          }
          return res;
        }
      }
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
