const ORG_NAME = "openfishtools";
const REPO_SLUG_RE = /^openfishtools\/[a-zA-Z0-9_.-]+$/i;
const CACHE_TTL_SEC = 1800; // 30 minutes

const KNOWN_REPOS_FALLBACK = [
  { name: "Studio", homepage: "https://studio.cutefish.my.id" },
  { name: "CEP", homepage: "" },
  { name: "web", homepage: "https://cutefish.my.id" },
  { name: "web-tools", homepage: "" }
];

// In-memory fallback cache per Worker isolate
const memCache = new Map();

function jsonResponse(data, status = 200, cacheHeader = "no-store") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheHeader
    }
  });
}

function sanitizeHttpUrl(raw) {
  const val = String(raw || "").trim();
  if (!val) return "";
  if (/^https?:\/\//i.test(val)) return val;
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(val)) {
    return "https://" + val;
  }
  return "";
}

function formatRepoTitle(repoName) {
  return String(repoName || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseReadmeHeader(md) {
  if (!md) return { title: "", tagline: "", iconUrl: "" };
  const centerMatch = md.match(/<div\s+align=["']center["'][^>]*>([\s\S]*?)<\/div>/i);
  const block = centerMatch ? centerMatch[1] : md.slice(0, 1200);

  const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  const titleMatch = block.match(/^\s*#\s+(.+)$/m);
  const taglineMatch = block.match(/^\s*\*\*(.+?)\*\*\s*$/m);

  return {
    title: titleMatch ? titleMatch[1].replace(/[*_`]/g, "").trim() : "",
    tagline: taglineMatch ? taglineMatch[1].trim() : "",
    iconUrl: imgMatch ? sanitizeHttpUrl(imgMatch[1]) : ""
  };
}

function cleanAboutSection(sectionText) {
  if (!sectionText) return "";
  return sectionText
    .replace(/^<a\s+name=["'][^"']+["']\s*><\/a>\s*/i, "")
    .replace(/^##\s+(?:Bahasa Indonesia|English)\s*$/gim, "")
    .replace(/^---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseReadmeSections(md) {
  if (!md) return { id: "", en: "" };
  const idAnchor = md.search(/<a\s+name=["']bahasa-indonesia["']\s*><\/a>/i);
  const enAnchor = md.search(/<a\s+name=["']english["']\s*><\/a>/i);

  let idRaw = "";
  let enRaw = "";

  if (idAnchor !== -1 && enAnchor !== -1) {
    if (idAnchor < enAnchor) {
      idRaw = md.slice(idAnchor, enAnchor);
      enRaw = md.slice(enAnchor);
    } else {
      enRaw = md.slice(enAnchor, idAnchor);
      idRaw = md.slice(idAnchor);
    }
  } else if (idAnchor !== -1) {
    idRaw = md.slice(idAnchor);
  } else if (enAnchor !== -1) {
    enRaw = md.slice(enAnchor);
  } else {
    const stripped = md.replace(/<div\s+align=["']center["'][^>]*>[\s\S]*?<\/div>/i, "").trim();
    idRaw = stripped;
    enRaw = stripped;
  }

  return {
    id: cleanAboutSection(idRaw),
    en: cleanAboutSection(enRaw)
  };
}

async function fetchRawReadme(repoFullName) {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repoFullName}/HEAD/README.md`, {
      headers: { "User-Agent": "cutefish-web/2.0" }
    });
    if (!res.ok) return "";
    return await res.text();
  } catch (_e) {
    return "";
  }
}

function buildGitHubHeaders(env) {
  const headers = {
    "User-Agent": "cutefish-web/2.0",
    "Accept": "application/vnd.github+json"
  };
  const token = env && (env.GITHUB_TOKEN || env.GH_TOKEN);
  if (token) {
    headers["Authorization"] = `Bearer ${String(token).trim()}`;
  }
  return headers;
}

function parseHumanSizeToBytes(sizeStr) {
  const m = String(sizeStr || "").match(/(\d+(?:\.\d+)?)\s*(Bytes|KB|MB|GB)/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === "GB") return Math.round(num * 1024 * 1024 * 1024);
  if (unit === "MB") return Math.round(num * 1024 * 1024);
  if (unit === "KB") return Math.round(num * 1024);
  return Math.round(num);
}

function decodeHtmlEntities(str) {
  return String(str || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToSimpleMarkdown(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi, "\n### $1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
      .replace(/<[^>]+>/g, "")
  ).replace(/\n{3,}/g, "\n\n").trim();
}

async function fetchReleaseViaWeb(repo, sourceLabel) {
  try {
    const webHeaders = { "User-Agent": "cutefish-web/2.0" };
    const r1 = await fetch(`https://github.com/${repo}/releases/latest`, {
      redirect: "manual",
      headers: webHeaders
    });
    const loc = r1.headers.get("location") || "";
    const tag = loc.includes("/tag/") ? decodeURIComponent(loc.split("/tag/")[1].split(/[?#]/)[0]) : "";
    if (!tag) return null;

    const [assetsRes, atomRes] = await Promise.all([
      fetch(`https://github.com/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`, { headers: webHeaders }),
      fetch(`https://github.com/${repo}/releases.atom`, { headers: webHeaders })
    ]);

    const assets = [];
    if (assetsRes.ok) {
      const html = await assetsRes.text();
      const re = /href="(\/[^"]+\/releases\/download\/[^"]+)"[\s\S]*?(\d+(?:\.\d+)?\s*(?:Bytes|KB|MB|GB))/gi;
      let m;
      const seen = new Set();
      while ((m = re.exec(html)) !== null) {
        const url = "https://github.com" + m[1];
        if (seen.has(url)) continue;
        seen.add(url);
        assets.push({
          name: decodeURIComponent(m[1].split("/").pop() || ""),
          size: parseHumanSizeToBytes(m[2]),
          url
        });
      }
    }

    let body = "";
    let publishedAt = "";
    if (atomRes.ok) {
      const xml = await atomRes.text();
      const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i);
      if (entryMatch) {
        const entry = entryMatch[1];
        const upd = entry.match(/<updated>([^<]+)<\/updated>/i);
        if (upd) publishedAt = upd[1].trim();
        const content = entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        if (content) {
          body = htmlToSimpleMarkdown(decodeHtmlEntities(content[1]));
        }
      }
    }

    return {
      source: sourceLabel || "",
      tag_name: tag,
      name: tag,
      body,
      published_at: publishedAt,
      html_url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
      assets
    };
  } catch (_e) {
    return null;
  }
}

function normalizeRelease(relJson, sourceLabel) {
  if (!relJson) return null;
  return {
    source: sourceLabel || "",
    tag_name: relJson.tag_name || "",
    name: relJson.name || relJson.tag_name || "",
    body: relJson.body || "",
    published_at: relJson.published_at || "",
    html_url: sanitizeHttpUrl(relJson.html_url),
    assets: Array.isArray(relJson.assets)
      ? relJson.assets
          .map((a) => ({
            name: String(a.name || ""),
            size: Number(a.size || 0),
            url: sanitizeHttpUrl(a.browser_download_url)
          }))
          .filter((a) => a.name && a.url)
      : []
  };
}

async function buildListFromRawFallback() {
  const readmes = await Promise.all(
    KNOWN_REPOS_FALLBACK.map((r) => fetchRawReadme(`${ORG_NAME}/${r.name}`))
  );
  const apps = KNOWN_REPOS_FALLBACK.map((r, idx) => {
    const meta = parseReadmeHeader(readmes[idx]);
    return {
      id: r.name.toLowerCase(),
      repo: `${ORG_NAME}/${r.name}`,
      repoName: r.name,
      name: meta.title || formatRepoTitle(r.name),
      developer: "OpenFishTools",
      tagline: meta.tagline,
      description: meta.tagline,
      iconUrl: meta.iconUrl,
      homepage: r.homepage,
      html_url: `https://github.com/${ORG_NAME}/${r.name}`
    };
  });
  return {
    developer: {
      name: "OpenFishTools",
      url: `https://github.com/${ORG_NAME}`
    },
    apps,
    fallback: true
  };
}

async function handleOrgReposList(context, reqUrl, edgeCache, headers) {
  const memKey = `org:${ORG_NAME}`;
  const cacheKey = new Request(`${reqUrl.origin}/api/github-repo?org=${ORG_NAME}&v=4`, {
    method: "GET"
  });

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const res = await fetch(`https://api.github.com/orgs/${ORG_NAME}/repos?sort=updated&per_page=30`, { headers });
    if (!res.ok) {
      // Rate-limited (403/429) or transient error: serve stale memory cache or raw.githubusercontent.com fallback
      const stale = memCache.get(memKey);
      if (stale) {
        return jsonResponse(stale, 200, "public, max-age=120");
      }
      const fallbackPayload = await buildListFromRawFallback();
      return jsonResponse(fallbackPayload, 200, "public, max-age=120");
    }

    const repos = await res.json();
    const hasStudio = (Array.isArray(repos) ? repos : []).some(
      (r) => r && r.name && String(r.name).toLowerCase() === "studio" && !r.archived && !r.fork
    );
    const filtered = (Array.isArray(repos) ? repos : [])
      .filter((r) => {
        if (!r || !r.name || r.name === ".github" || r.archived || r.fork) return false;
        if (hasStudio && String(r.name).toLowerCase() === "standalone") return false;
        return true;
      });

    const readmes = await Promise.all(
      filtered.map((r) => fetchRawReadme(r.full_name || `${ORG_NAME}/${r.name}`))
    );

    const apps = filtered.map((r, idx) => {
      const meta = parseReadmeHeader(readmes[idx]);
      return {
        id: String(r.name).toLowerCase(),
        repo: r.full_name || `${ORG_NAME}/${r.name}`,
        repoName: r.name,
        name: meta.title || formatRepoTitle(r.name),
        developer: "OpenFishTools",
        tagline: meta.tagline || String(r.description || "").trim(),
        description: String(r.description || "").trim() || meta.tagline,
        iconUrl: meta.iconUrl,
        homepage: sanitizeHttpUrl(r.homepage),
        html_url: sanitizeHttpUrl(r.html_url)
      };
    });

    apps.sort((a, b) => {
      if (a.id === "studio") return -1;
      if (b.id === "studio") return 1;
      return 0;
    });

    const payload = {
      developer: {
        name: "OpenFishTools",
        url: `https://github.com/${ORG_NAME}`
      },
      apps
    };

    memCache.set(memKey, payload);
    const out = jsonResponse(payload, 200, `public, max-age=${CACHE_TTL_SEC}, stale-while-revalidate=86400`);
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, out.clone()));
    }
    return out;
  } catch (_err) {
    const stale = memCache.get(memKey);
    if (stale) {
      return jsonResponse(stale, 200, "public, max-age=120");
    }
    const fallbackPayload = await buildListFromRawFallback();
    return jsonResponse(fallbackPayload, 200, "public, max-age=120");
  }
}

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const repo = (reqUrl.searchParams.get("repo") || "").trim();
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const headers = buildGitHubHeaders(context.env);

  if (!repo) {
    return handleOrgReposList(context, reqUrl, edgeCache, headers);
  }

  if (!REPO_SLUG_RE.test(repo)) {
    return jsonResponse({ error: "Invalid repository slug." }, 400);
  }

  const memKey = `repo:${repo.toLowerCase()}`;
  const cacheKey = new Request(`${reqUrl.origin}/api/github-repo?repo=${encodeURIComponent(repo.toLowerCase())}&v=6`, {
    method: "GET"
  });

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  const isStudio = repo.toLowerCase() === `${ORG_NAME}/studio`;

  try {
    const fetches = [
      fetch(`https://api.github.com/repos/${repo}`, { headers }),
      fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers }),
      fetchRawReadme(repo)
    ];
    if (isStudio) {
      fetches.push(fetch(`https://api.github.com/repos/${ORG_NAME}/Standalone/releases/latest`, { headers }));
    }

    const results = await Promise.all(fetches);
    const repoRes = results[0];
    const relRes = results[1];
    const readmeMd = results[2];
    const standaloneRelRes = isStudio ? results[3] : null;

    const readmeMeta = parseReadmeHeader(readmeMd);
    const readmeSections = parseReadmeSections(readmeMd);

    let mainRelease = relRes.ok ? normalizeRelease(await relRes.json(), isStudio ? "Studio" : "") : null;
    let standaloneRelease = standaloneRelRes && standaloneRelRes.ok
      ? normalizeRelease(await standaloneRelRes.json(), "Standalone")
      : null;

    // If api.github.com was rate-limited (403/429), fall back to zero-rate-limit github.com web endpoints!
    const webFallbacks = [];
    if (!mainRelease && relRes.status !== 404) {
      webFallbacks.push(fetchReleaseViaWeb(repo, isStudio ? "Studio" : "").then((r) => { mainRelease = r; }));
    }
    if (isStudio && !standaloneRelease && (!standaloneRelRes || standaloneRelRes.status !== 404)) {
      webFallbacks.push(fetchReleaseViaWeb(`${ORG_NAME}/Standalone`, "Standalone").then((r) => { standaloneRelease = r; }));
    }
    if (webFallbacks.length) {
      await Promise.all(webFallbacks);
    }

    const releases = [];
    if (mainRelease) releases.push(mainRelease);
    if (standaloneRelease) releases.push(standaloneRelease);

    let mergedRelease = mainRelease || standaloneRelease || null;
    if (mainRelease && standaloneRelease) {
      const seenAsset = new Set();
      const combinedAssets = [];
      for (const a of [...mainRelease.assets, ...standaloneRelease.assets]) {
        if (!seenAsset.has(a.url)) {
          seenAsset.add(a.url);
          combinedAssets.push(a);
        }
      }
      mergedRelease = {
        ...mainRelease,
        assets: combinedAssets
      };
    }

    const known = KNOWN_REPOS_FALLBACK.find((r) => `${ORG_NAME}/${r.name}`.toLowerCase() === repo.toLowerCase());
    const repoJson = repoRes.ok ? await repoRes.json() : null;

    if (!repoJson) {
      const stale = memCache.get(memKey);
      if (stale && stale.release && !mergedRelease) {
        return jsonResponse(stale, 200, "public, max-age=120");
      }
      const fallbackPayload = {
        repo,
        title: readmeMeta.title,
        tagline: readmeMeta.tagline,
        homepage: known ? known.homepage : "",
        html_url: `https://github.com/${repo}`,
        description: readmeMeta.tagline,
        readme: readmeSections,
        release: mergedRelease,
        releases
      };
      const out = jsonResponse(fallbackPayload, 200, `public, max-age=${CACHE_TTL_SEC}, stale-while-revalidate=86400`);
      if (edgeCache && typeof context.waitUntil === "function") {
        context.waitUntil(edgeCache.put(cacheKey, out.clone()));
      }
      return out;
    }

    const payload = {
      repo: repoJson.full_name || repo,
      title: readmeMeta.title,
      tagline: readmeMeta.tagline,
      homepage: sanitizeHttpUrl(repoJson.homepage) || (known ? known.homepage : ""),
      html_url: sanitizeHttpUrl(repoJson.html_url),
      description: String(repoJson.description || "").trim(),
      readme: readmeSections,
      release: mergedRelease,
      releases
    };

    memCache.set(memKey, payload);
    const res = jsonResponse(payload, 200, `public, max-age=${CACHE_TTL_SEC}, stale-while-revalidate=86400`);
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, res.clone()));
    }
    return res;
  } catch (_err) {
    const stale = memCache.get(memKey);
    if (stale) {
      return jsonResponse(stale, 200, "public, max-age=120");
    }
    const readmeMd = await fetchRawReadme(repo);
    const readmeMeta = parseReadmeHeader(readmeMd);
    const readmeSections = parseReadmeSections(readmeMd);
    return jsonResponse({
      repo,
      title: readmeMeta.title,
      tagline: readmeMeta.tagline,
      homepage: "",
      html_url: `https://github.com/${repo}`,
      description: readmeMeta.tagline,
      readme: readmeSections,
      release: null,
      releases: []
    }, 200, "public, max-age=120");
  }
}
