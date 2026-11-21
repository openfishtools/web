import { MongoClient } from "mongodb";

let cachedClient = null;
let cachedClientUri = "";
let resolvedUriCache = new Map();

function normalizeHttps(url) {
  if (typeof url !== "string") return "";
  const clean = url.trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) {
    return clean.replace(/^http:\/\//i, "https://");
  }
  return `https://${clean.replace(/^\/+/, "")}`;
}

/**
 * Resolve mongodb+srv:// to a standard mongodb:// seedlist using DoH so
 * Cloudflare Workers/Pages Functions avoid native c-ares querySrv failures.
 */
async function resolveSrvUriIfNeeded(rawUri) {
  if (!rawUri || !rawUri.startsWith("mongodb+srv://")) {
    return rawUri;
  }

  const cached = resolvedUriCache.get(rawUri);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.uri;
  }

  try {
    const withoutScheme = rawUri.slice("mongodb+srv://".length);
    const atIdx = withoutScheme.lastIndexOf("@");
    const authPart = atIdx !== -1 ? withoutScheme.slice(0, atIdx + 1) : "";
    const hostAndRest = atIdx !== -1 ? withoutScheme.slice(atIdx + 1) : withoutScheme;
    const slashIdx = hostAndRest.indexOf("/");
    const srvHost = (slashIdx !== -1 ? hostAndRest.slice(0, slashIdx) : hostAndRest).split("?")[0];
    const pathAndQuery = slashIdx !== -1 ? hostAndRest.slice(slashIdx) : "/";

    const srvRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(`_mongodb._tcp.${srvHost}`)}&type=SRV`,
      { headers: { Accept: "application/dns-json" } }
    );
    if (!srvRes.ok) return rawUri;

    const srvJson = await srvRes.json();
    const answers = Array.isArray(srvJson?.Answer) ? srvJson.Answer : [];
    const seeds = answers
      .filter((a) => a && a.type === 33 && typeof a.data === "string")
      .map((a) => {
        const parts = a.data.trim().split(/\s+/);
        const port = parts[2] || "27017";
        const target = (parts[3] || "").replace(/\.$/, "");
        return target ? `${target}:${port}` : "";
      })
      .filter(Boolean);

    if (seeds.length === 0) return rawUri;

    let txtParams = "";
    try {
      const txtRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(srvHost)}&type=TXT`,
        { headers: { Accept: "application/dns-json" } }
      );
      if (txtRes.ok) {
        const txtJson = await txtRes.json();
        const txtAns = Array.isArray(txtJson?.Answer) ? txtJson.Answer : [];
        txtParams = txtAns
          .filter((a) => a && a.type === 16 && typeof a.data === "string")
          .map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s*"/g, ""))
          .join("&");
      }
    } catch (_) {}

    const [pathPart, existingQuery = ""] = pathAndQuery.split("?");
    const params = new URLSearchParams(txtParams);
    if (existingQuery) {
      const overrides = new URLSearchParams(existingQuery);
      for (const [k, v] of overrides.entries()) {
        params.set(k, v);
      }
    }
    if (!params.has("tls") && !params.has("ssl")) {
      params.set("tls", "true");
    }

    const queryStr = params.toString();
    const standardUri = `mongodb://${authPart}${seeds.join(",")}${pathPart || "/"}${queryStr ? `?${queryStr}` : ""}`;
    resolvedUriCache.set(rawUri, { uri: standardUri, expiresAt: Date.now() + 5 * 60 * 1000 });
    return standardUri;
  } catch (_) {
    return rawUri;
  }
}

async function getMongoClient(rawUri) {
  const connectUri = await resolveSrvUriIfNeeded(rawUri);
  if (cachedClient && cachedClientUri === connectUri) {
    return cachedClient;
  }
  const client = new MongoClient(connectUri, {
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 5500,
    connectTimeoutMS: 5500
  });
  await client.connect();
  cachedClient = client;
  cachedClientUri = connectUri;
  return client;
}

function mapPresetDocument(doc) {
  return {
    id: String(doc._id || ""),
    presetId: doc.presetId ?? null,
    order: doc.order ?? 0,
    name: doc.name || "",
    software: Array.isArray(doc.software) ? doc.software : [],
    version: doc.version || "",
    size: doc.size || "",
    plugin: doc.plugin || "",
    media: normalizeHttps(doc.media),
    likes: Number(doc.likes || 0),
    url: normalizeHttps(doc.url),
    urls: Array.isArray(doc.urls)
      ? doc.urls.map((u) => ({
          sw: u?.sw || "",
          url: normalizeHttps(u?.url)
        }))
      : [],
    am5MbUrl: normalizeHttps(doc.am5MbUrl),
    amPremiumUrl: normalizeHttps(doc.amPremiumUrl),
    amXmlUrl: normalizeHttps(doc.amXmlUrl),
    amXmlExtras: Array.isArray(doc.amXmlExtras)
      ? doc.amXmlExtras.map((ex) => ({
          label: ex?.label || "Extra",
          url: normalizeHttps(ex?.url)
        }))
      : []
  };
}

export async function onRequestGet(context) {
  const uri = context?.env?.MONGODB_URI;
  if (!uri) {
    return new Response(
      JSON.stringify({ error: "MONGODB_URI belum disetel pada environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }

  const reqUrl = new URL(context.request.url);
  const bypassCache = reqUrl.searchParams.get("refresh") === "1";
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${reqUrl.origin}/api/presets`, { method: "GET" });

  if (edgeCache && !bypassCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const client = await getMongoClient(uri);
    const docs = await client
      .db("test")
      .collection("presets")
      .find({ hidden: { $ne: true } })
      .sort({ order: 1, presetId: -1 })
      .toArray();

    const body = JSON.stringify({
      syncedAt: new Date().toISOString(),
      source: "live",
      items: docs.map(mapPresetDocument)
    });

    const response = new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
      }
    });

    if (edgeCache && !bypassCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, response.clone()));
    }

    return response;
  } catch (err) {
    cachedClient = null;
    cachedClientUri = "";
    return new Response(
      JSON.stringify({ error: (err && err.message) || "Gagal memuat preset dari database." }),
      { status: 502, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
}
