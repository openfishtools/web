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
            .filter(p => !p.startsWith('workers/') && !p.startsWith('experimental/') && !p.startsWith('create-method/') && !p.startsWith('.'));

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
                const lower = (path || '').toLowerCase();
                if (lower === 'method/finalize.js') return 1;
                if (lower === 'method/compress.js') return 2;
                if (lower === 'method/normalize.js') return 3;
                if (lower.startsWith('method/') && !lower.startsWith('method/item/')) return 4;
                if (lower.startsWith('method/item/')) return 5;
                return 6;
            };
            return getScore(a) - getScore(b) || a.localeCompare(b);
        });

        tools.sort();

        return { helpers, tools };
    }

    async function discoverTools() {
        // No manifest cache: fetch fresh every page load so new deploys
        // are picked up immediately (script URLs are commit-pinned).

        // 1. Try local serverless endpoint /api/tools
        try {
            const res = await fetch(API_ENDPOINT, { cache: 'no-cache' });
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.helpers) && Array.isArray(data.tools) && data.tools.length > 0) {
                    const cleanHelpers = data.helpers.filter(h => !h.startsWith('workers/') && !h.startsWith('experimental/') && !h.startsWith('create-method/'));
                    const manifest = {
                        helpers: cleanHelpers,
                        tools: data.tools,
                        sha: data.sha || null,
                        timestamp: Date.now()
                    };
                    console.log(`[ToolsLoader] Discovered ${manifest.tools.length} tools via /api/tools (sha: ${manifest.sha || 'latest'}).`);
                    return manifest;
                }
            }
        } catch (apiErr) {
            console.debug('[ToolsLoader] /api/tools unavailable, falling back to GitHub Trees API:', apiErr.message);
        }

        // 2. Fallback to GitHub Trees API
        try {
            const ghRes = await fetch(GITHUB_TREES_API, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (ghRes.ok) {
                const ghData = await ghRes.json();
                if (Array.isArray(ghData.tree)) {
                    const manifest = parseTreeToManifest(ghData.tree);
                    manifest.sha = ghData.sha || null;
                    manifest.timestamp = Date.now();
                    console.log(`[ToolsLoader] Discovered ${manifest.tools.length} tools dynamically from GitHub web-tools tree (sha: ${manifest.sha || 'latest'}).`);
                    return manifest;
                }
            }
        } catch (ghErr) {
            console.debug('[ToolsLoader] GitHub Trees API unavailable:', ghErr.message);
        }

        // 3. Fallback to build-generated tools-manifest.json
        try {
            const localManifestRes = await fetch('scripts/tools-manifest.json', { cache: 'no-cache' });
            if (localManifestRes.ok) {
                const localData = await localManifestRes.json();
                if (localData && Array.isArray(localData.helpers) && Array.isArray(localData.tools) && localData.tools.length > 0) {
                    return {
                        helpers: localData.helpers,
                        tools: localData.tools,
                        sha: 'main',
                        timestamp: Date.now()
                    };
                }
            }
        } catch (_) {}

        throw new Error('All dynamic manifest sources unavailable; falling back to local bundle.');
    }

    async function loadRemoteTools() {
        const manifest = await discoverTools();
        const ref = manifest.sha || 'main';
        const primaryBase = `https://cdn.jsdelivr.net/gh/openfishtools/web-tools@${ref}/`;
        const fallbackBase = `https://raw.githubusercontent.com/openfishtools/web-tools/${ref}/`;
        const cacheBuster = manifest.sha ? '' : ('?t=' + Math.floor(Date.now() / (1000 * 60 * 5)));

        // 1. Parallel loading of helper & method scripts
        let helperResults = [];
        if (Array.isArray(manifest.helpers) && manifest.helpers.length > 0) {
            helperResults = await Promise.allSettled(manifest.helpers.map(helperPath =>
                loadScriptWithFallback(helperPath, primaryBase, fallbackBase, cacheBuster)
            ));
        }

        // 2. Parallel loading of main tools
        const results = await Promise.allSettled(manifest.tools.map(toolPath =>
            loadScriptWithFallback(toolPath, primaryBase, fallbackBase, cacheBuster)
        ));

        const failedPaths = [
            ...manifest.helpers.filter((_, i) => helperResults[i] && helperResults[i].status === 'rejected'),
            ...manifest.tools.filter((_, i) => results[i] && results[i].status === 'rejected')
        ];
        if (failedPaths.length > 0) {
            console.warn(`[ToolsLoader] ${failedPaths.length} scripts failed from all CDN sources: ${failedPaths.join(', ')}`);
            if (window.AppTools) {
                window.AppTools.loadError = `Sebagian tools gagal dimuat (${failedPaths.length}): ${failedPaths.join(', ')}. Matikan VPN/adblock lalu coba tombol muat ulang.`;
            }
        }

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
