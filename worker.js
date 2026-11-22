import { onRequestGet as handlePresetsGet } from "./functions/api/presets.js";
import { onRequestGet as handleTikTokResolveGet } from "./functions/api/tiktok-resolve.js";
import { onRequestGet as handleTikTokFpsGet } from "./functions/api/tiktok-fps.js";

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
    }

    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
