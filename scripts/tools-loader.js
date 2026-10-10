/**
 * OpenFishTools Dynamic Tools Loader
 * Dynamically discovers, categorizes, and loads tool scripts from the GitHub web-tools repository.
 * Differentiates helper/method engines from main tools, ensuring correct loading sequence.
 * Falls back to local bundle if offline or unreachable.
 */

(function () {
    'use strict';

    const CDN_PRIMARY = 'https://cdn.jsdelivr.net/gh/openfishtools/web-tools@main/';
    const CDN_FALLBACK = 'https://raw.githubusercontent.com/openfishtools/web-tools/main/';
    const GITHUB_TREES_API = 'https://api.github.com/repos/openfishtools/web-tools/git/trees/main?recursive=1';
    const API_ENDPOINT = '/api/tools';
    const LOCAL_FALLBACK = 'scripts/tools-bundle.js';

    // Configurable delays for smooth UI transitions and throttled execution
    const FETCH_DELAY_MS = 600; // Delay before fetch to let skeleton display smoothly
    const TOOL_STAGGER_DELAY_MS = 40; // Subtle throttle between loading scripts

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
    }

    async function loadScriptWithFallback(relPath, cacheBuster) {
        try {
            await loadScript(CDN_PRIMARY + relPath + cacheBuster);
        } catch (primaryErr) {
            console.warn(`[ToolsLoader] Primary CDN failed for ${relPath}, attempting fallback...`, primaryErr);
            await loadScript(CDN_FALLBACK + relPath + cacheBuster);
        }
    }

    function parseTreeToManifest(tree) {
        const jsFiles = tree
            .filter(item => item && item.type === 'blob' && typeof item.path === 'string' && item.path.endsWith('.js'))
            .map(item => item.path)
            .filter(p => !p.startsWith('workers/') && !p.startsWith('experimental/') && !p.startsWith('.'));

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
        // Initial delay so skeleton loading animation displays smoothly without flash
        if (FETCH_DELAY_MS > 0) {
            await sleep(FETCH_DELAY_MS);
        }

        // 1. Try local serverless endpoint /api/tools
        try {
            const res = await fetch(API_ENDPOINT, { cache: 'no-cache' });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.helpers) && Array.isArray(data.tools) && data.tools.length > 0) {
                    console.log(`[ToolsLoader] Discovered ${data.tools.length} tools via /api/tools.`);
                    return { helpers: data.helpers, tools: data.tools };
                }
            }
        } catch (apiErr) {
            console.debug('[ToolsLoader] /api/tools unavailable, falling back to GitHub Trees API:', apiErr.message);
        }

        // 2. Try GitHub Trees API
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
        console.log(`[ToolsLoader] Discovered ${manifest.tools.length} tools dynamically from GitHub web-tools tree.`);
        return manifest;
    }

    async function loadRemoteTools() {
        const manifest = await discoverTools();
        const cacheBuster = '?t=' + Math.floor(Date.now() / (1000 * 60 * 5));

        // 1. Load helper & method scripts first in sequence
        for (const helperPath of manifest.helpers) {
            try {
                await loadScriptWithFallback(helperPath, cacheBuster);
            } catch (err) {
                console.warn(`[ToolsLoader] Failed to load helper ${helperPath}:`, err);
            }
        }

        // 2. Load main tools in sequence with smooth stagger
        let loadedCount = 0;
        for (const toolPath of manifest.tools) {
            try {
                await loadScriptWithFallback(toolPath, cacheBuster);
                loadedCount++;
                if (TOOL_STAGGER_DELAY_MS > 0) {
                    await sleep(TOOL_STAGGER_DELAY_MS);
                }
            } catch (err) {
                console.warn(`[ToolsLoader] Failed to load tool ${toolPath}:`, err);
            }
        }

        if (loadedCount === 0) {
            throw new Error('No tools could be loaded from remote sources.');
        }

        console.log(`[ToolsLoader] Successfully loaded ${loadedCount} dynamic tools from GitHub web-tools.`);
    }

    async function init() {
        try {
            await loadRemoteTools();
        } catch (err) {
            console.warn('[ToolsLoader] Dynamic tool loading failed, falling back to local bundle:', err);
            try {
                await loadScript(LOCAL_FALLBACK);
                console.log('[ToolsLoader] Local fallback bundle loaded successfully.');
            } catch (fallbackErr) {
                console.error('[ToolsLoader] Fatal: Unable to load tools from any source.', fallbackErr);
            }
        }
    }

    init();
})();
