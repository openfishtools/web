const ORG_NAME = "openfishtools";
const REPO_SLUG_RE = /^openfishtools\/[a-zA-Z0-9_.-]+$/i;

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
    // Single-language README: strip header div
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

async function handleOrgReposList(context, reqUrl, edgeCache, headers) {
  const cacheKey = new Request(`${reqUrl.origin}/api/github-repo?org=${ORG_NAME}&v=3`, {
    method: "GET"
  });

  if (edgeCache) {
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;
  }

  try {
    const res = await fetch(`https://api.github.com/orgs/${ORG_NAME}/repos?sort=updated&per_page=30`, { headers });
    if (!res.ok) {
      return jsonResponse({ error: `GitHub API returned ${res.status}` }, 502);
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

    const out = jsonResponse(payload, 200, "public, max-age=300");
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, out.clone()));
    }
    return out;
  } catch (err) {
    return jsonResponse({ error: err && err.message ? err.message : "Failed to fetch organization repos" }, 502);
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

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const repo = (reqUrl.searchParams.get("repo") || "").trim();
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  const token = context.env.GITHUB_TOKEN || context.env.GH_TOKEN;
  const headers = {
    "User-Agent": "cutefish-web/2.0",
    "Accept": "application/vnd.github+json"
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!repo) {
    return handleOrgReposList(context, reqUrl, edgeCache, headers);
  }

  if (!REPO_SLUG_RE.test(repo)) {
    return jsonResponse({ error: "Invalid repository slug." }, 400);
  }

  const cacheKey = new Request(`${reqUrl.origin}/api/github-repo?repo=${encodeURIComponent(repo.toLowerCase())}&v=4`, {
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

    if (!repoRes.ok) {
      // Fallback grace jika rate limit GitHub atau repo gagal diakses
      const payload = {
        repo: repo,
        title: readmeMeta.title || formatRepoTitle(repo.split("/")[1] || repo),
        tagline: readmeMeta.tagline || "",
        homepage: `https://github.com/${repo}`,
        html_url: `https://github.com/${repo}`,
        description: readmeMeta.tagline || "",
        readme: readmeSections,
        release: null,
        releases: []
      };
      return jsonResponse(payload, 200, "public, max-age=60");
    }

    const repoJson = await repoRes.json();
    const readmeMeta = parseReadmeHeader(readmeMd);
    const readmeSections = parseReadmeSections(readmeMd);

    let mainRelease = relRes.ok ? normalizeRelease(await relRes.json(), isStudio ? "Studio" : "") : null;
    let standaloneRelease = standaloneRelRes && standaloneRelRes.ok
      ? normalizeRelease(await standaloneRelRes.json(), "Standalone")
      : null;

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

    const payload = {
      repo: repoJson.full_name || repo,
      title: readmeMeta.title,
      tagline: readmeMeta.tagline,
      homepage: sanitizeHttpUrl(repoJson.homepage),
      html_url: sanitizeHttpUrl(repoJson.html_url),
      description: String(repoJson.description || "").trim(),
      readme: readmeSections,
      release: mergedRelease,
      releases
    };

    const res = jsonResponse(payload, 200, "public, max-age=300");
    if (edgeCache && typeof context.waitUntil === "function") {
      context.waitUntil(edgeCache.put(cacheKey, res.clone()));
    }
    return res;
  } catch (err) {
    return jsonResponse({ error: err && err.message ? err.message : "Failed to fetch GitHub data" }, 502);
  }
}
