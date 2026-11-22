const TIKTOK_URL_RE = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\//i;

function jsonResponse(data, status = 200, cacheHeader = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheHeader
    }
  });
}

function normalizeTikTokMeta(d) {
  return {
    id: d.id || "",
    title: d.title || "",
    cover: d.cover || d.origin_cover || d.ai_dynamic_cover || "",
    origin_cover: d.origin_cover || d.cover || "",
    play: d.play || "",
    hdplay: d.hdplay || d.play || "",
    music: d.music || "",
    duration: d.duration || 0,
    size: d.size || d.hd_size || 0,
    hd_size: d.hd_size || d.size || 0,
    create_time: d.create_time || 0,
    region: d.region || "",
    is_nff_or_nr: Boolean(d.is_ad || d.commercial_video_info),
    play_count: d.play_count || 0,
    digg_count: d.digg_count || 0,
    comment_count: d.comment_count || 0,
    share_count: d.share_count || 0,
    collect_count: d.collect_count || 0,
    author_nickname: (d.author && d.author.nickname) || "Creator",
    author_unique_id: (d.author && d.author.unique_id) || "tiktok"
  };
}

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const targetUrl = (reqUrl.searchParams.get("url") || "").trim();
  const coverOnly = reqUrl.searchParams.get("cover") === "1";

  if (!targetUrl || !TIKTOK_URL_RE.test(targetUrl)) {
    return jsonResponse({ error: "URL TikTok tidak valid." }, 400);
  }

  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKeyUrl = `${reqUrl.origin}/api/tiktok-resolve?${coverOnly ? "cover=1&" : ""}url=${encodeURIComponent(targetUrl)}`;
  const cacheKey = new Request(cacheKeyUrl, { method: "GET" });

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  // Fast path for cover-only requests (Preset gallery): try TikTok oEmbed first (no rate limit)
  if (coverOnly) {
    try {
      const oeRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`);
      if (oeRes.ok) {
        const oe = await oeRes.json();
        if (oe && oe.thumbnail_url) {
          const res = jsonResponse(
            { cover: oe.thumbnail_url, origin_cover: oe.thumbnail_url },
            200,
            "public, max-age=3600, s-maxage=21600"
          );
          if (edgeCache && typeof context.waitUntil === "function") {
            context.waitUntil(edgeCache.put(cacheKey, res.clone()));
          }
          return res;
        }
      }
    } catch (_) {}
  }

  try {
    let payload = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const apiRes = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
          }
        }
      );
      if (!apiRes.ok) {
        return jsonResponse({ error: `Upstream TikWM mengembalikan HTTP ${apiRes.status}.` }, 502);
      }

      payload = await apiRes.json();
      if (payload && payload.code === -1 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1100));
        continue;
      }
      break;
    }

    if (!payload || payload.code !== 0 || !payload.data) {
      return jsonResponse(
        { error: (payload && payload.msg) || "Video tidak ditemukan atau bersifat privat." },
        404
      );
    }

    const normalized = normalizeTikTokMeta(payload.data);
    const body = coverOnly
      ? { cover: normalized.cover, origin_cover: normalized.origin_cover }
      : normalized;

    const cachePolicy = coverOnly
      ? "public, max-age=3600, s-maxage=21600"
      : "public, max-age=60, s-maxage=60";

    const res = jsonResponse(body, 200, cachePolicy);
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, res.clone()));
    }
    return res;
  } catch (err) {
    return jsonResponse({ error: (err && err.message) || "Gagal mengambil metadata TikTok." }, 502);
  }
}
