/**
 * OpenFishTools Remote Tools Loader
 * Fetches the unified web-tools bundle from GitHub / jsDelivr CDN with local fallback.
 */

(function () {
    'use strict';

    const REMOTE_BUNDLE_URL = 'https://cdn.jsdelivr.net/gh/openfishtools/web-tools@main/dist/web-tools.bundle.js';
    const LOCAL_FALLBACK_URL = 'scripts/tools-bundle.js';

    function injectScript(src, isFallback = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            // Cache busting for remote bundle to ensure instant updates on push
            const cacheBuster = isFallback ? '' : ('?t=' + Math.floor(Date.now() / (1000 * 60 * 5))); // 5-min cache window
            script.src = src + cacheBuster;
            script.defer = true;

            script.onload = () => {
                console.log(`[ToolsLoader] Successfully loaded tools bundle from: ${src}`);
                resolve();
            };

            script.onerror = (err) => {
                console.warn(`[ToolsLoader] Failed to load tools bundle from: ${src}`);
                reject(err);
            };

            document.head.appendChild(script);
        });
    }

    // Try remote CDN first; on failure, automatically use local fallback
    injectScript(REMOTE_BUNDLE_URL)
        .catch(() => {
            console.log(`[ToolsLoader] Switching to local fallback bundle: ${LOCAL_FALLBACK_URL}`);
            return injectScript(LOCAL_FALLBACK_URL, true);
        })
        .catch((fatalErr) => {
            console.error('[ToolsLoader] Fatal error: Could not load tools bundle from any source.', fatalErr);
        });
})();
