/**
 * OpenFishTools Remote Tools Loader
 * Dynamically loads modular tool scripts directly from GitHub web-tools repository via jsDelivr CDN.
 * Falls back to local bundle if offline or unreachable.
 */

(function () {
    'use strict';

    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/openfishtools/web-tools@main/';
    const LOCAL_FALLBACK = 'scripts/tools-bundle.js';

    // Ordered list of tool scripts to load directly from web-tools
    const TOOL_SCRIPTS = [
        // 1. Method Main Engines
        'Method/finalize.js',
        'Method/compress.js',

        // 2. Method Item Patches
        'Method/item/streamshield.js',
        'Method/item/binarypatch.js',
        'Method/item/FRYMethod.js',
        'Method/item/fpspatch.js',
        'Method/item/wmvpatch.js',
        'Method/item/emergencymethod.js',

        // 3. TikTok Tools
        'tiktok/tiktok-quality-tool.js',
        'tiktok/tiktok-downloader-tool.js',
        'tiktok/tiktok-stats-tool.js',

        // 4. Video & Audio Tools
        'video/video-compressor-tool.js',
        'video/video-interpolation-tool.js',
        'video/audio-extractor-tool.js',
        'video/image-sequence-tool.js',

        // 5. AI Tools
        'ai/upscale-gpu-enhancer.js',
        'ai/upscale-tool.js',
        'ai/rembg-tool.js',

        // 6. Converters
        'converters/ae-to-am-beatmark-tool.js',
        'converters/fivemb-generator-tool.js'
    ];

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
    }

    async function loadRemoteTools() {
        const cacheBuster = '?t=' + Math.floor(Date.now() / (1000 * 60 * 5));
        for (const scriptPath of TOOL_SCRIPTS) {
            await loadScript(CDN_BASE + scriptPath + cacheBuster);
        }
        console.log('[ToolsLoader] Successfully loaded all modular tools from GitHub web-tools.');
    }

    async function init() {
        try {
            await loadRemoteTools();
        } catch (err) {
            console.warn('[ToolsLoader] Failed to fetch remote tools from CDN, switching to local fallback bundle:', err);
            try {
                await loadScript(LOCAL_FALLBACK);
                console.log('[ToolsLoader] Local fallback bundle loaded.');
            } catch (fallbackErr) {
                console.error('[ToolsLoader] Fatal: Unable to load tools from any source.', fallbackErr);
            }
        }
    }

    init();
})();
