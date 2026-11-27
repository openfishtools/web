import { onRequestGet as handlePresetsGet } from "./functions/api/presets.js";
import { onRequestGet as handleTikTokResolveGet } from "./functions/api/tiktok-resolve.js";
import { onRequestGet as handleTikTokFpsGet } from "./functions/api/tiktok-fps.js";
import { onRequestGet as handleGitHubRepoGet } from "./functions/api/github-repo.js";

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

    if (request.method === "GET") {
      if (url.pathname === "/api/presets") {
        return handlePresetsGet(makeContext(request, env, ctx));
      }
      if (url.pathname === "/api/tiktok-resolve") {
        return handleTikTokResolveGet(makeContext(request, env, ctx));
      }
      if (url.pathname === "/api/tiktok-fps") {
        return handleTikTokFpsGet(makeContext(request, env, ctx));
      }
      if (url.pathname === "/api/github-repo") {
        return handleGitHubRepoGet(makeContext(request, env, ctx));
      }
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
