import { onRequestGet as handlePresetsGet } from "./functions/api/presets.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/presets" && request.method === "GET") {
      return handlePresetsGet({
        request,
        env,
        waitUntil: (promise) => {
          if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(promise);
          }
        }
      });
    }

    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
