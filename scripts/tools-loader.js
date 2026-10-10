/**
 * OpenFishTools Dynamic Tools Loader
 * High-performance, concurrent discovery and loading of tool modules.
 * Caches manifest in sessionStorage for instantaneous reload.
 * Gracefully reports errors to AppTools to display clean error state.
 */

(function () {
    'use strict';

    const GITHUB_TREES_API = 'https://api.github.com/repos/openfishtools/web-tools/git/trees/main?recursive=1';
    const API_ENDPOINT = '/api/tools';
    const LOCAL_FALLBACK = 'scripts/tools-bundle.js';
    const MANIFEST_CACHE_KEY = 'oft_tools_manifest_cache';
    const MANIFEST_CACHE_TTL_MS = 60 * 1000; // 1 minute

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = (err) => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    async function loadScriptWithFallback(relPath, primaryBase, fallbackBase, cacheBuster) {
        try {
            await loadScript(primaryBase + relPath + cacheBuster);
        } catch (primaryErr) {
            console.warn(`[ToolsLoader] Primary CDN failed for ${relPath}, attempting fallback...`, primaryErr);
            await loadScript(fallbackBase + relPath + cacheBuster);
        }
    }

    function parseTreeToManifest(tree) {
        const jsFiles = tree
            .filter(item => item && item.type === 'blob' && typeof item.path === 'string' && item.path.endsWith('.js'))
            .map(item => item.path)
            .filter(p => !p.startsWith('workers/') && !p.startsWith('experimental/') && !p.startsWith('.') && !p.includes('fishV2'));

        const helpers = [];
        const tools = [];

        for (const p of jsFiles) {
            if (p.endsWith('-tool.js')) {
                tools.push(p);
            } else {
                helpers.push(p);
            }
        }

        helpers.sort((a, b) => {
            const getScore = (path) => {
                if (path === 'Method/finalize.js') return 1;
                if (path === 'Method/compress.js') return 2;
                if (path.startsWith('Method/item/')) return 3;
                if (path.startsWith('Method/')) return 4;
                return 5;
            };
            return getScore(a) - getScore(b);
        });

        tools.sort();

        return { helpers, tools };
    }

    async function discoverTools() {
        // Check session cache for instantaneous start
        try {
            const rawCache = sessionStorage.getItem(MANIFEST_CACHE_KEY);
            if (rawCache) {
                const parsed = JSON.parse(rawCache);
                if (parsed && Array.isArray(parsed.tools) && parsed.tools.length > 0 && (Date.now() - parsed.timestamp < MANIFEST_CACHE_TTL_MS)) {
                    console.log(`[ToolsLoader] Restored ${parsed.tools.length} tools from session cache.`);
                    return parsed;
                }
            }
        } catch (_) {}

        // 1. Try local serverless endpoint /api/tools
        try {
            const res = await fetch(API_ENDPOINT, { cache: 'no-cache' });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.helpers) && Array.isArray(data.tools) && data.tools.length > 0) {
                    const cleanHelpers = data.helpers.filter(h => !h.includes('fishV2') && !h.startsWith('workers/') && !h.startsWith('experimental/'));
                    const manifest = {
                        helpers: cleanHelpers,
                        tools: data.tools,
                        sha: data.sha || null,
                        timestamp: Date.now()
                    };
                    try { sessionStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest)); } catch (_) {}
                    console.log(`[ToolsLoader] Discovered ${manifest.tools.length} tools via /api/tools (sha: ${manifest.sha || 'latest'}).`);
                    return manifest;
                }
            }
        } catch (apiErr) {
            console.debug('[ToolsLoader] /api/tools unavailable, falling back to GitHub Trees API:', apiErr.message);
        }

        // 2. Fallback to GitHub Trees API
        const ghRes = await fetch(GITHUB_TREES_API, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!ghRes.ok) {
            throw new Error(`GitHub API returned status ${ghRes.status}`);
        }
        const ghData = await ghRes.json();
        if (!Array.isArray(ghData.tree)) {
            throw new Error('Invalid GitHub tree structure');
        }

        const manifest = parseTreeToManifest(ghData.tree);
        manifest.sha = ghData.sha || null;
        manifest.timestamp = Date.now();
        try { sessionStorage.setItem(MANIFEST_CACHE_KEY, JSON.stringify(manifest)); } catch (_) {}
        console.log(`[ToolsLoader] Discovered ${manifest.tools.length} tools dynamically from GitHub web-tools tree (sha: ${manifest.sha || 'latest'}).`);
        return manifest;
    }

    async function loadRemoteTools() {
        const manifest = await discoverTools();
        const ref = manifest.sha || 'main';
        const primaryBase = `https://cdn.jsdelivr.net/gh/openfishtools/web-tools@${ref}/`;
        const fallbackBase = `https://raw.githubusercontent.com/openfishtools/web-tools/${ref}/`;
        const cacheBuster = manifest.sha ? '' : ('?t=' + Math.floor(Date.now() / (1000 * 60 * 5)));

        // 1. Parallel loading of helper & method scripts
        if (Array.isArray(manifest.helpers) && manifest.helpers.length > 0) {
            await Promise.allSettled(manifest.helpers.map(helperPath =>
                loadScriptWithFallback(helperPath, primaryBase, fallbackBase, cacheBuster)
            ));
        }

        // 2. Parallel loading of main tools
        const results = await Promise.allSettled(manifest.tools.map(toolPath =>
            loadScriptWithFallback(toolPath, primaryBase, fallbackBase, cacheBuster)
        ));

        const loadedCount = results.filter(r => r.status === 'fulfilled').length;
        if (loadedCount === 0) {
            throw new Error('Tidak ada tool yang berhasil dimuat dari CDN.');
        }

        console.log(`[ToolsLoader] Successfully loaded ${loadedCount} dynamic tools concurrently.`);
    }

    async function init() {
        if (window.AppTools) {
            window.AppTools.isLoading = true;
            window.AppTools.loadError = null;
        }

        try {
            await loadRemoteTools();
            if (window.AppTools) {
                window.AppTools.isLoading = false;
                window.AppTools.loadError = null;
            }
            if (typeof window.renderTools === 'function') {
                window.renderTools();
            }
        } catch (err) {
            console.warn('[ToolsLoader] Dynamic tool loading failed, attempting local fallback:', err);
            try {
                await loadScript(LOCAL_FALLBACK);
                if (window.AppTools) {
                    window.AppTools.isLoading = false;
                    window.AppTools.loadError = null;
                }
                if (typeof window.renderTools === 'function') {
                    window.renderTools();
                }
            } catch (fallbackErr) {
                console.error('[ToolsLoader] Fatal: Unable to load tools from any source.', fallbackErr);
                if (window.AppTools) {
                    window.AppTools.isLoading = false;
                    window.AppTools.loadError = err.message || 'Koneksi ke server tools terputus atau gagal dimuat.';
                }
                if (typeof window.renderTools === 'function') {
                    window.renderTools();
                }
            }
        }
    }

    window.ToolsLoader = {
        reload: () => {
            try { sessionStorage.removeItem(MANIFEST_CACHE_KEY); } catch (_) {}
            if (window.AppTools) {
                window.AppTools.isLoading = true;
                window.AppTools.loadError = null;
            }
            if (typeof window.renderTools === 'function') {
                window.renderTools();
            }
            init();
        }
    };

    init();
})();
