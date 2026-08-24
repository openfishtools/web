(function () {
    'use strict';

    const KEY_VER = 'cf_deploy_version';
    const KEY_TS = 'cf_deploy_timestamp';
    const KEY_CHECKED = 'cf_deploy_checked_session';
    const KEY_PURGE_AT = 'cf_deploy_purge_at';
    const PURGE_COOLDOWN_MS = 60000;

    async function purgeEverythingAndReload() {
        try { sessionStorage.setItem(KEY_PURGE_AT, String(Date.now())); } catch (e) {}

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
        window.location.replace(url.toString());
    }

    async function checkDeployedVersion() {
        try {
            if (sessionStorage.getItem(KEY_CHECKED)) return;
            let lastPurgeAt = 0;
            try { lastPurgeAt = Number(sessionStorage.getItem(KEY_PURGE_AT) || 0); } catch (e) {}
            if (lastPurgeAt && Date.now() - lastPurgeAt < PURGE_COOLDOWN_MS) return;

            const res = await fetch('/api/version', { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const deployedVer = data && data.version ? String(data.version) : null;
            if (!deployedVer) return;

            sessionStorage.setItem(KEY_CHECKED, '1');

            const storedVer = localStorage.getItem(KEY_VER);
            const deployedTs = Number(data.timestamp || 0);

            if (!storedVer) {
                localStorage.setItem(KEY_VER, deployedVer);
                localStorage.setItem(KEY_TS, String(deployedTs));
                return;
            }

            if (storedVer !== deployedVer) {
                localStorage.setItem(KEY_VER, deployedVer);
                localStorage.setItem(KEY_TS, String(deployedTs));
                await purgeEverythingAndReload();
            }
        } catch (e) {
            console.warn('[Deploy Check] Skipped:', e.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(checkDeployedVersion, 800));
    } else {
        setTimeout(checkDeployedVersion, 800);
    }
})();
