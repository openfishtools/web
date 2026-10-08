(function () {
    'use strict';

    const KEY_VER = 'cf_deploy_version';
    const KEY_TS = 'cf_deploy_timestamp';
    const KEY_CHECKED = 'cf_deploy_checked_session';
    const KEY_PURGE_AT = 'cf_deploy_purge_at';
    const PURGE_COOLDOWN_MS = 60000;

    // Bersihkan parameter 'nocache' dari address bar URL agar tidak persist atau berulang saat refresh
    try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('nocache')) {
            currentUrl.searchParams.delete('nocache');
            const cleanUrl = currentUrl.pathname + (currentUrl.search ? currentUrl.search : '') + currentUrl.hash;
            window.history.replaceState(null, '', cleanUrl);
        }
    } catch (_) {}

    // Bersihkan service worker usang secara silent tanpa reload, KECUALI coi-serviceworker
    try {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                for (const reg of regs) {
                    if (reg.active && reg.active.scriptURL && reg.active.scriptURL.includes('coi-serviceworker')) {
                        continue;
                    }
                    reg.unregister().catch(() => {});
                }
            }).catch(() => {});
        }
    } catch (_) {}

    async function purgeEverythingAndReload(newVer, newTs) {
        const now = Date.now();

        // 1. Unregister service worker usang (jangan coi-serviceworker agar crossOriginIsolated tidak rusak)
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) {
                    if (reg.active && reg.active.scriptURL && reg.active.scriptURL.includes('coi-serviceworker')) {
                        continue;
                    }
                    await reg.unregister();
                }
            }
        } catch (e) {}

        // 2. Clear browser caches
        try {
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(name => caches.delete(name)));
            }
        } catch (e) {}

        // 3. Clear IndexedDB
        try {
            if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
                const dbs = await window.indexedDB.databases();
                for (const db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
            }
        } catch (e) {}

        // 4. Reset storage tapi amankan preferensi & versi deploy baru agar tidak loop refresh
        try {
            const savedLang = localStorage.getItem('user_lang');
            const savedThemeColor = localStorage.getItem('cf_theme_color');
            const savedThemeMode = localStorage.getItem('cf_theme_mode');

            sessionStorage.clear();
            localStorage.clear();

            if (savedLang) localStorage.setItem('user_lang', savedLang);
            if (savedThemeColor) localStorage.setItem('cf_theme_color', savedThemeColor);
            if (savedThemeMode) localStorage.setItem('cf_theme_mode', savedThemeMode);

            // Kunci versi baru di localStorage agar setelah reload tidak terdeteksi mismatch lagi
            if (newVer) localStorage.setItem(KEY_VER, newVer);
            if (newTs) localStorage.setItem(KEY_TS, String(newTs));

            // Simpan timestamp cooldown di kedua storage (localStorage + sessionStorage)
            localStorage.setItem(KEY_PURGE_AT, String(now));
            sessionStorage.setItem(KEY_PURGE_AT, String(now));
            sessionStorage.setItem(KEY_CHECKED, '1');
        } catch (e) {}

        const url = new URL(window.location.href);
        url.searchParams.set('nocache', String(now));
        window.location.replace(url.toString());
    }

    async function checkDeployedVersion() {
        try {
            if (sessionStorage.getItem(KEY_CHECKED)) return;

            let lastPurgeAt = 0;
            try {
                lastPurgeAt = Math.max(
                    Number(sessionStorage.getItem(KEY_PURGE_AT) || 0),
                    Number(localStorage.getItem(KEY_PURGE_AT) || 0)
                );
            } catch (e) {}

            if (lastPurgeAt && (Date.now() - lastPurgeAt < PURGE_COOLDOWN_MS)) return;

            window.__cutefishVersionPromise = window.__cutefishVersionPromise || fetch('/api/version')
                .then(r => r.ok ? r.json() : null)
                .catch(() => null);

            const data = await window.__cutefishVersionPromise;
            if (!data) return;
            window.__cutefishVersionData = data;

            const deployedVer = data.version ? String(data.version) : null;
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
                await purgeEverythingAndReload(deployedVer, deployedTs);
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
