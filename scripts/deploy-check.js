(function () {
    'use strict';

    const STORAGE_KEY = 'cf_deploy_version';
    const STORAGE_TS_KEY = 'cf_deploy_timestamp';

    async function purgeEverythingAndReload() {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.unregister();
            }
        } catch (e) {}
        try {
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            }
        } catch (e) {}
        try {
            if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
                const dbs = await window.indexedDB.databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
            }
        } catch (e) {}
        try {
            const savedLang = localStorage.getItem('user_lang');
            sessionStorage.clear();
            localStorage.clear();
            if (savedLang) localStorage.setItem('user_lang', savedLang);
        } catch (e) {}

        const url = new URL(window.location.href);
        url.searchParams.set('nocache', Date.now().toString());
        url.searchParams.delete('v');
        window.location.replace(url.toString());
        setTimeout(() => window.location.reload(true), 500);
    }

    async function checkDeployedVersion() {
        try {
            const res = await fetch('/api/version', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) return;
            const data = await res.json();
            const deployedVer = data && data.version ? String(data.version) : null;
            const deployedTs = data && data.timestamp ? Number(data.timestamp) : 0;
            if (!deployedVer) return;

            const storedVer = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
            const storedTs = Number(sessionStorage.getItem(STORAGE_TS_KEY) || localStorage.getItem(STORAGE_TS_KEY) || 0);

            if (!storedVer || storedVer !== deployedVer || deployedTs > storedTs) {
                sessionStorage.setItem(STORAGE_KEY, deployedVer);
                sessionStorage.setItem(STORAGE_TS_KEY, String(deployedTs));
                localStorage.setItem(STORAGE_KEY, deployedVer);
                localStorage.setItem(STORAGE_TS_KEY, String(deployedTs));

                if (storedVer && (storedVer !== deployedVer || deployedTs > storedTs)) {
                    await purgeEverythingAndReload();
                    return;
                }
            }
        } catch (e) {
            console.warn('[Deploy Check] Error checking deployed version:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(checkDeployedVersion, 300));
    } else {
        setTimeout(checkDeployedVersion, 300);
    }
})();
