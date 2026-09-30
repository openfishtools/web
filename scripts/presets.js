(function() {
    'use strict';

    const BADGE_ICONS = {
        'FishTools Studio': '/assets/icon/FishTools.png',
        'FTS': '/assets/icon/FishTools.png',
        'FishTools': '/assets/icon/FishTools.png',
        'cutefish': '/assets/icon/cutefish_icon_128x128.png',
        AE: '/assets/icon/Ae.png',
        AM: '/assets/icon/Am.png',
        Blurr: '/assets/icon/Blurr.png',
        CC: '/assets/icon/CC.png',
        FM: '/assets/icon/Fm.png',
        Node: '/assets/icon/Node.png'
    };

    function resolveBadgeIcon(sw) {
        if (!sw) return '';
        if (BADGE_ICONS[sw]) return BADGE_ICONS[sw];
        const s = String(sw).trim();
        if (s.startsWith('assets/') || s.startsWith('/assets/')) {
            return s.startsWith('/') ? s : '/' + s;
        }
        if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) {
            return s;
        }
        return '';
    }

    let allPresetsCache = [];
    let activePresetSoftware = 'All';
    let presetsFetched = false;
    let isPresetModalAnimating = false;
    let presetModalSourceRect = null;
    let presetModalSourceCard = null;
    let presetModalMediaRatio = null;

    const tiktokMediaCache = new Map();
    const tiktokThumbPending = new Map();
    const tiktokFailAt = new Map();
    const tiktokDeadUrls = new Set();
    let tiktokActiveFetches = 0;
    const tiktokFetchQueue = [];
    const THUMB_BATCH_SIZE = 4;
    const THUMB_BATCH_DELAY_MS = 1000;
    let thumbBatchTimer = null;

    const t = (key) => (window.getTranslation && window.getTranslation(key)) || key;

    const escapeHtml = (str) => String(str == null ? '' : str).replace(/[<>&"']/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[c]));

    const ensureProtocol = (url) => /^https?:\/\//i.test(String(url || '')) ? url : `https://${url}`;

    const isDirectVideoUrl = (url) => /\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(String(url || '').trim());
    const isTikTokLikeUrl = (url) => /tiktok\.com/i.test(String(url || ''));

    const TIKTOK_RETRY_MS = 45000;
    const TIKTOK_MAX_ATTEMPTS = 3;

    function tiktokFailed(key) {
        const t = tiktokFailAt.get(key);
        return !!(t && Date.now() - t < TIKTOK_RETRY_MS);
    }

    function mergeTikTokCache(url, patch) {
        const entry = Object.assign({ cover: '', play: '', hdplay: '' }, tiktokMediaCache.get(url) || {}, patch);
        tiktokMediaCache.set(url, entry);
        return entry;
    }

    function fetchTikTokThumb(url, attempt) {
        const key = `thumb:${url}`;
        return fetch(`/api/tiktok-thumb?url=${encodeURIComponent(url)}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(data => {
                const cover = data && typeof data.cover === 'string' && /^https?:\/\//i.test(data.cover) ? data.cover : '';
                if (!cover) return Promise.reject(new Error('No cover'));
                return mergeTikTokCache(url, { cover });
            })
            .catch(err => {
                if (attempt + 1 < TIKTOK_MAX_ATTEMPTS) {
                    return new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
                        .then(() => fetchTikTokThumb(url, attempt + 1));
                }
                tiktokFailAt.set(key, Date.now());
                return null;
            });
    }

    function fetchTikTokPlay(url, attempt) {
        const key = `play:${url}`;
        return fetch(`/api/tiktok-resolve?url=${encodeURIComponent(url)}`)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(data => {
                const play = data && typeof data.play === 'string' && /^https?:\/\//i.test(data.play) ? data.play : '';
                const hdplay = data && typeof data.hdplay === 'string' && /^https?:\/\//i.test(data.hdplay) ? data.hdplay : '';
                const cover = data && typeof data.cover === 'string' && /^https?:\/\//i.test(data.cover) ? data.cover : '';
                if (!play && !hdplay) return Promise.reject(new Error('No play url'));
                tiktokFailAt.delete(key);
                return mergeTikTokCache(url, { play: play || hdplay, hdplay, cover: cover || undefined });
            })
            .catch(err => {
                if (attempt + 1 < TIKTOK_MAX_ATTEMPTS) {
                    return new Promise(resolve => setTimeout(resolve, 600 * (attempt + 1)))
                        .then(() => fetchTikTokPlay(url, attempt + 1));
                }
                tiktokFailAt.set(key, Date.now());
                return null;
            });
    }

    function pumpTikTokQueue() {
        if (thumbBatchTimer) return;
        if (tiktokFetchQueue.length === 0) return;

        const batch = tiktokFetchQueue.splice(0, THUMB_BATCH_SIZE);
        tiktokActiveFetches += batch.length;
        batch.forEach(job => {
            job.runner()
                .then(job.resolve)
                .catch(() => {})
                .finally(() => {
                    tiktokActiveFetches--;
                });
        });

        thumbBatchTimer = setTimeout(() => {
            thumbBatchTimer = null;
            pumpTikTokQueue();
        }, THUMB_BATCH_DELAY_MS);
    }

    function runQueued(key, runner, priority = false) {
        if (tiktokThumbPending.has(key)) return tiktokThumbPending.get(key);
        const promise = new Promise(resolve => {
            if (priority) {
                resolve(runner());
                return;
            }
            tiktokFetchQueue.push({ key, resolve, runner });
        });
        tiktokThumbPending.set(key, promise);
        if (!priority) pumpTikTokQueue();
        return promise;
    }

    function resolveTikTokCover(url) {
        const cached = tiktokMediaCache.get(url);
        if (cached && cached.cover) return Promise.resolve(cached);
        const key = `thumb:${url}`;
        if (tiktokFailed(key)) return Promise.resolve(cached || null);
        return runQueued(key, () => fetchTikTokThumb(url, 0));
    }

    function resolveTikTokMedia(url) {
        const cached = tiktokMediaCache.get(url);
        if (cached && cached.play) return Promise.resolve(cached);
        const key = `play:${url}`;
        if (tiktokFailed(key)) return Promise.resolve(cached || null);
        return runQueued(key, () => fetchTikTokPlay(url, 0), true).then(res => res || cached || null);
    }

    function applyTikTokCover(url, cover) {
        document.querySelectorAll('[data-tiktok-url]').forEach(el => {
            if (el.dataset.tiktokUrl !== url) return;
            const img = document.createElement('img');
            img.src = cover;
            img.alt = el.closest('.preset-modal-media') ? '' : (el.dataset.tiktokAlt || '');
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            el.replaceWith(img);
        });
    }

    let presetModalMediaToken = 0;
    let currentPreviewTikTokUrl = '';
    let pendingModalRatio = null;

    function cleanupPresetModalMedia() {
        presetModalMediaToken++;
        if (currentPreviewTikTokUrl) {
            const entry = tiktokMediaCache.get(currentPreviewTikTokUrl);
            if (entry) {
                entry.play = '';
                entry.hdplay = '';
            }
            tiktokThumbPending.delete(`play:${currentPreviewTikTokUrl}`);
            currentPreviewTikTokUrl = '';
        }
        pendingModalRatio = null;
        presetModalMediaRatio = null;
        const media = document.getElementById('preset-modal-media');
        if (!media) return;
        media.querySelectorAll('video').forEach(v => {
            try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
        });
        media.innerHTML = '';
    }

    function attachPresetVideoSoundToggle(mediaEl) {
        if (!mediaEl) return;
        let btn = mediaEl.querySelector('.preset-video-sound-btn');
        const video = mediaEl.querySelector('video');
        if (!video) {
            if (btn) btn.remove();
            return;
        }
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'preset-video-sound-btn';
            btn.setAttribute('aria-label', 'Toggle sound');
            btn.innerHTML = '<span class="material-symbols-rounded">volume_off</span>';
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetVideo = mediaEl.querySelector('video');
                if (!targetVideo) return;
                targetVideo.muted = !targetVideo.muted;
                const icon = btn.querySelector('.material-symbols-rounded');
                if (icon) icon.textContent = targetVideo.muted ? 'volume_off' : 'volume_up';
                if (!targetVideo.muted) targetVideo.play().catch(() => {});
            });
            mediaEl.appendChild(btn);
        } else {
            const icon = btn.querySelector('.material-symbols-rounded');
            if (icon) icon.textContent = video.muted ? 'volume_off' : 'volume_up';
        }
    }

    function hydrateTikTokThumbEl(el) {
        const url = el.dataset ? el.dataset.tiktokUrl : null;
        if (!url || el.dataset.tiktokBusy) return;
        el.dataset.tiktokBusy = '1';
        resolveTikTokCover(url).then(media => {
            if (media && media.cover) {
                applyTikTokCover(url, media.cover);
                return;
            }
            replaceAllTikTokPlaceholders(url, presetMediaFailHtml('thumb'));
        });
    }

    function htmlToElement(html) {
        const tpl = document.createElement('template');
        tpl.innerHTML = html.trim();
        return tpl.content.firstElementChild;
    }

    function replaceAllTikTokPlaceholders(url, html) {
        const node = htmlToElement(html);
        document.querySelectorAll('[data-tiktok-url]').forEach(el => {
            if (el.dataset.tiktokUrl !== url) return;
            el.replaceWith(node.cloneNode(true));
        });
    }

    function presetMediaFailHtml(kind) {
        const isVideo = kind === 'video';
        return `<div class="preset-thumb-fail"><span class="material-symbols-rounded">${isVideo ? 'videocam_off' : 'image_not_supported'}</span><span class="preset-thumb-fail-text">${escapeHtml(t(isVideo ? 'preset_video_unavailable' : 'preset_thumbnail_unavailable'))}</span></div>`;
    }

    function hydrateTikTokThumbs(scope) {
        const root = scope || document;
        if (root.dataset && root.dataset.tiktokUrl !== undefined) {
            hydrateTikTokThumbEl(root);
            return;
        }
        root.querySelectorAll('[data-tiktok-url]').forEach(hydrateTikTokThumbEl);
    }

    let tiktokThumbObserver = null;

    function observeTikTokThumbs(scope) {
        if (!('IntersectionObserver' in window)) {
            hydrateTikTokThumbs(scope);
            return;
        }
        if (!tiktokThumbObserver) {
            tiktokThumbObserver = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    tiktokThumbObserver.unobserve(entry.target);
                    hydrateTikTokThumbEl(entry.target);
                });
            }, { rootMargin: '250px 0px' });
        }
        scope.querySelectorAll('[data-tiktok-url]').forEach(el => tiktokThumbObserver.observe(el));
    }

    const presetMediaHtml = (p) => {
        const m = p.media == null ? '' : String(p.media).trim();
        if (!m) {
            return '<div class="preset-thumb-placeholder"><span class="material-symbols-rounded">movie_filter</span></div>';
        }
        if (isDirectVideoUrl(m)) {
            return `<video src="${escapeHtml(m)}" muted playsinline preload="metadata" referrerpolicy="no-referrer"></video>`;
        }
        if (isTikTokLikeUrl(m)) {
            if (tiktokDeadUrls.has(m)) {
                return presetMediaFailHtml('video');
            }
            const cached = tiktokMediaCache.get(m);
            if (cached && cached.cover) {
                return `<img src="${escapeHtml(cached.cover)}" alt="${escapeHtml(p.name)}" loading="lazy" referrerpolicy="no-referrer">`;
            }
            return `<div class="preset-thumb-placeholder" data-tiktok-url="${escapeHtml(m)}" data-tiktok-alt="${escapeHtml(p.name)}"><span class="material-symbols-rounded">smart_display</span></div>`;
        }
        return `<img src="${escapeHtml(m)}" alt="${escapeHtml(p.name)}" loading="lazy" referrerpolicy="no-referrer">`;
    };

    function renderPresetCategories() {
        const container = document.getElementById('preset-categories');
        if (!container) return;

        const swSet = new Set();
        allPresetsCache.forEach(p => {
            const arr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
            arr.forEach(sw => swSet.add(sw));
        });

        const categories = ['All', ...swSet];
        container.innerHTML = categories.map(cat => {
            const label = cat === 'All' ? t('preset_category_all') : cat;
            const icon = resolveBadgeIcon(cat);
            const iconHtml = icon ? `<img src="${icon}" alt="${escapeHtml(cat)}" class="chip-icon">` : '';
            return `<div class="chip ${activePresetSoftware === cat ? 'active' : ''}" data-software="${escapeHtml(cat)}">${iconHtml}${escapeHtml(label)}</div>`;
        }).join('');

        container.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                activePresetSoftware = chip.dataset.software || 'All';
                renderPresets(activePresetSoftware);
            });
        });
    }

    function renderPresets(filterSoftware = 'All') {
        const grid = document.getElementById('preset-grid');
        if (!grid) return;

        if (!presetsFetched) return;

        renderPresetCategories();

        let filtered = allPresetsCache;
        if (filterSoftware !== 'All') {
            filtered = filtered.filter(p => {
                const arr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                return arr.includes(filterSoftware);
            });
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><span class="material-symbols-rounded empty-state-icon">search_off</span><p class="empty-state-text">${t('no_results')}</p></div>`;
            return;
        }

        grid.innerHTML = filtered.map(p => {
            const badges = (Array.isArray(p.software) ? p.software : [])
                .map(sw => {
                    const icon = resolveBadgeIcon(sw);
                    return icon ? `<span class="preset-badge"><img src="${icon}" alt="${escapeHtml(sw)}"></span>` : '';
                })
                .join('');
            return `
            <div class="preset-card" data-id="${p._id}">
                <div class="preset-thumb">
                    ${presetMediaHtml(p)}
                    <div class="preset-badges">${badges}</div>
                    <div class="explore-info"><div class="explore-info-title">${escapeHtml(p.name)}</div></div>
                </div>
            </div>`;
        }).join('');

        grid.querySelectorAll('.preset-card').forEach(card => {
            card.addEventListener('click', () => {
                const item = allPresetsCache.find(x => x._id === card.dataset.id);
                if (item) openPresetModal(item, card);
            });
        });

        observeTikTokThumbs(grid);
    }

    const PRESET_FX_CHILDREN = [
        '.preset-modal-overlay-ui',
        '.preset-modal-close-btn',
        '.preset-video-sound-btn'
    ];

    const clearPresetChildFx = (cardEl) => {
        PRESET_FX_CHILDREN.forEach(sel => {
            const el = cardEl.querySelector(sel);
            if (el) el.style.cssText = '';
        });
    };

    const fadePresetChromeOut = (cardEl) => {
        const uiEl = cardEl.querySelector('.preset-modal-overlay-ui');
        if (uiEl) {
            uiEl.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
            uiEl.style.opacity = '0';
            uiEl.style.transform = 'translateY(10px)';
        }
        const closeBtn = cardEl.querySelector('.preset-modal-close-btn');
        if (closeBtn) {
            closeBtn.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
            closeBtn.style.opacity = '0';
            closeBtn.style.transform = 'scale(0.6)';
        }
        const soundBtn = cardEl.querySelector('.preset-video-sound-btn');
        if (soundBtn) {
            soundBtn.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
            soundBtn.style.opacity = '0';
            soundBtn.style.transform = 'scale(0.6)';
        }
    };

    function getPresetModalGeometry(mediaRatio) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (vw <= 600) {
            return { targetW: vw, targetLeft: 0, targetH: vh, targetTop: 0, borderRadius: '0px' };
        }

        const maxW = Math.min(vw * 0.92, 620);
        const maxH = vh * 0.88;
        const r = (mediaRatio && mediaRatio > 0) ? mediaRatio : 0.8;

        let targetH = maxH;
        let targetW = targetH * r;
        if (targetW > maxW) {
            targetW = maxW;
            targetH = targetW / r;
        }
        if (targetH > maxH) {
            targetH = maxH;
            targetW = targetH * r;
        }

        const targetLeft = Math.round((vw - targetW) / 2);
        const targetTop = Math.round((vh - targetH) / 2);

        return { targetW, targetLeft, targetH, targetTop, borderRadius: '28px' };
    }

    function measureMediaRatio(mediaEl) {
        return new Promise((resolve) => {
            const el = mediaEl.querySelector('img, video');
            if (!el) return resolve(null);

            const done = () => {
                const w = el.naturalWidth || el.videoWidth || 0;
                const h = el.naturalHeight || el.videoHeight || 0;
                resolve(w > 0 && h > 0 ? w / h : null);
            };

            if (el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) return done();
            if (el.tagName === 'VIDEO' && el.readyState >= 1 && el.videoWidth > 0) return done();

            el.addEventListener('load', done, { once: true });
            el.addEventListener('loadeddata', done, { once: true });
            el.addEventListener('error', () => resolve(null), { once: true });
            setTimeout(() => resolve(null), 1500);
        });
    }

    function watchVideoRatio(video, token) {
        let attempts = 0;
        const attempt = () => {
            if (token !== presetModalMediaToken || !video.isConnected) return;
            if (attempts++ > 40) return;
            const w = video.videoWidth || 0;
            const h = video.videoHeight || 0;
            if (w > 0 && h > 0) {
                const r = w / h;
                if (!presetModalMediaRatio || Math.abs(presetModalMediaRatio - r) > 0.01) {
                    pendingModalRatio = r;
                    applyPendingModalRatio();
                }
                return;
            }
            setTimeout(attempt, 250);
        };
        attempt();
    }

    function applyPendingModalRatio() {
        if (!pendingModalRatio) return;
        const cardEl = document.getElementById('preset-modal-card');
        if (!cardEl || !cardEl.classList.contains('expanded')) return;
        if (isPresetModalAnimating) return;

        const r = pendingModalRatio;
        pendingModalRatio = null;
        presetModalMediaRatio = r;

        const geom = getPresetModalGeometry(r);
        cardEl.style.transition = 'left 0.3s cubic-bezier(0.2, 0, 0, 1), top 0.3s cubic-bezier(0.2, 0, 0, 1), width 0.3s cubic-bezier(0.2, 0, 0, 1), height 0.3s cubic-bezier(0.2, 0, 0, 1), border-radius 0.24s ease';
        cardEl.style.left = `${geom.targetLeft}px`;
        cardEl.style.top = `${geom.targetTop}px`;
        cardEl.style.width = `${geom.targetW}px`;
        cardEl.style.height = `${geom.targetH}px`;
        cardEl.style.borderRadius = geom.borderRadius;
    }

    const SOFTWARE_FULL_NAMES = {
        'FishTools Studio': 'FishTools Studio',
        'FTS': 'FishTools Studio',
        'FishTools': 'FishTools Studio',
        'AE': 'After Effects',
        'AM': 'Alight Motion',
        'Blurr': 'Blurr',
        'CC': 'CapCut',
        'FM': 'Funimate',
        'Node': 'Node Video'
    };

    const normalizeXmlUrl = (url) => {
        try {
            const u = new URL(url);
            if (u.hostname === 'github.com') {
                const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
                if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
            }
            if (u.hostname === 'pastebin.com' && !u.pathname.startsWith('/raw/')) {
                const m = u.pathname.match(/^\/([^/]+)$/);
                if (m) return `https://pastebin.com/raw${u.pathname}`;
            }
        } catch (e) {}
        return url;
    };

    const POPUP_IDS = ['sw-download-picker', 'sw-detail-picker', 'am-variant-picker'];
    const POPUP_EASE = 'var(--ease-spring-soft)';
    const FALLBACK_SOURCE_RECT = () => ({
        left: Math.round(window.innerWidth / 2 - 80),
        top: Math.round(window.innerHeight - 80),
        width: 160,
        height: 48
    });

    const getSwStackCard = () => document.querySelector('#sw-download-picker .preset-popup-card');

    function restorePreviewSynced() {
        document.body.classList.remove('preset-popup-active');
        const previewCard = document.getElementById('preset-modal-card');
        if (previewCard) {
            previewCard.style.transition = 'transform 0.34s var(--ease-spring-soft), filter 0.26s ease';
        }
    }

    const isPickerShown = (el) => !!el && el.classList.contains('show') && !el._closing;

    const anyOtherPickerActive = (excludeEl) => POPUP_IDS.some(id => {
        const el = document.getElementById(id);
        return el !== excludeEl && isPickerShown(el);
    });

    function setSwPickerStacked(stacked) {
        const swCard = getSwStackCard();
        if (!swCard || !!swCard._isStacked === stacked) return;
        swCard._isStacked = stacked;
        swCard.style.transition = `transform 0.44s ${POPUP_EASE}, opacity 0.35s ease, filter 0.35s ease`;
        void swCard.offsetHeight;
        if (stacked) {
            swCard.style.transform = 'translateY(-16px) scale(0.94)';
            swCard.style.opacity = '0.45';
            swCard.style.filter = 'brightness(0.7)';
            swCard.style.pointerEvents = 'none';
        } else {
            swCard.style.transform = '';
            swCard.style.opacity = '';
            swCard.style.filter = '';
            swCard.style.pointerEvents = '';
        }
    }

    function measureSourceRect(srcEl, inSwPicker) {
        const swCard = inSwPicker ? getSwStackCard() : null;
        if (swCard && srcEl && swCard.contains(srcEl)) {
            const prevTransition = swCard.style.transition;
            const prevTransform = swCard.style.transform;
            const prevOpacity = swCard.style.opacity;
            const prevFilter = swCard.style.filter;
            swCard.style.transition = 'none';
            swCard.style.transform = '';
            swCard.style.opacity = '';
            swCard.style.filter = '';
            void swCard.offsetHeight;
            const r = srcEl.getBoundingClientRect();
            swCard.style.transform = prevTransform;
            swCard.style.opacity = prevOpacity;
            swCard.style.filter = prevFilter;
            void swCard.offsetHeight;
            swCard.style.transition = prevTransition;
            void swCard.offsetHeight;
            return { left: r.left, top: r.top, width: r.width, height: r.height };
        }
        const r = (srcEl && srcEl.getClientRects().length > 0)
            ? srcEl.getBoundingClientRect()
            : FALLBACK_SOURCE_RECT();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function measureInRestoredModal(srcEl) {
        const previewCard = document.getElementById('preset-modal-card');
        if (!previewCard || !srcEl || srcEl.getClientRects().length === 0) return null;
        if (!document.body.classList.contains('preset-popup-active')) {
            const g = srcEl.getBoundingClientRect();
            return { left: g.left, top: g.top, width: g.width, height: g.height };
        }
        const prevTransition = previewCard.style.transition;
        previewCard.style.transition = 'none';
        document.body.classList.remove('preset-popup-active');
        void previewCard.offsetHeight;
        const r = srcEl.getBoundingClientRect();
        document.body.classList.add('preset-popup-active');
        void previewCard.offsetHeight;
        previewCard.style.transition = prevTransition;
        void previewCard.offsetHeight;
        document.body.classList.remove('preset-popup-active');
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    }

    function resolveCloseRect(pickerEl, wasChild) {
        const srcEl = pickerEl._sourceEl;
        if (!(srcEl && srcEl.isConnected && srcEl.getClientRects().length > 0)) {
            return pickerEl._sourceRect || FALLBACK_SOURCE_RECT();
        }
        if (wasChild) {
            const swCard = getSwStackCard();
            if (swCard && swCard.contains(srcEl)) {
                return measureSourceRect(srcEl, true);
            }
        }
        const restored = measureInRestoredModal(srcEl);
        if (restored) return restored;
        const g = srcEl.getBoundingClientRect();
        return { left: g.left, top: g.top, width: g.width, height: g.height };
    }

    function getPresetPopupGeometry(cardEl) {
        const isMobile = window.innerWidth <= 600;
        const targetW = isMobile ? window.innerWidth : Math.min(window.innerWidth * 0.92, 440);
        const targetLeft = isMobile ? 0 : Math.max(16, Math.round((window.innerWidth - targetW) / 2));
        const borderRadius = isMobile ? '28px 28px 0 0' : '28px';

        const prevWidth = cardEl.style.width;
        const prevHeight = cardEl.style.height;
        const prevTransition = cardEl.style.transition;
        const prevVisibility = cardEl.style.visibility;
        const prevDisplay = cardEl.style.display;

        cardEl.style.transition = 'none';
        cardEl.style.visibility = 'hidden';
        cardEl.style.display = 'flex';
        cardEl.style.width = `${targetW}px`;
        cardEl.style.height = 'auto';
        cardEl.style.maxHeight = 'none';
        cardEl.style.padding = isMobile ? '24px 20px calc(24px + env(safe-area-inset-bottom, 0px)) 20px' : '24px';
        void cardEl.offsetHeight;

        const naturalH = cardEl.scrollHeight || cardEl.offsetHeight || 260;

        cardEl.style.transition = prevTransition;
        cardEl.style.visibility = prevVisibility;
        cardEl.style.display = prevDisplay;
        cardEl.style.width = prevWidth;
        cardEl.style.height = prevHeight;
        void cardEl.offsetHeight;

        const targetH = Math.min(naturalH, window.innerHeight * 0.86);
        const targetTop = isMobile ? Math.round(window.innerHeight - targetH) : Math.max(16, Math.round((window.innerHeight - targetH) / 2));

        return { targetW, targetLeft, targetH, targetTop, borderRadius, isMobile };
    }

    function buildMorphFace(cardEl, srcBtn) {
        let face = cardEl.querySelector('.preset-morph-face');
        if (!face) {
            face = document.createElement('div');
            cardEl.appendChild(face);
        }
        face.className = 'preset-morph-face';
        if (srcBtn && srcBtn.getClientRects().length > 0 && srcBtn.classList.contains('preset-option-btn')) {
            face.classList.add('row-face');
            face.innerHTML = srcBtn.innerHTML;
        } else {
            face.classList.add('btn-face');
            face.innerHTML = '<span class="material-symbols-rounded">download</span><span>Download</span>';
        }
        return face;
    }

    function hideMorphFace(cardEl) {
        const face = cardEl.querySelector('.preset-morph-face');
        if (face) {
            face.style.transition = 'none';
            face.style.opacity = '0';
        }
    }

    function openPresetPopup(pickerEl, sourceEl = null) {
        if (!pickerEl || pickerEl._animating) return;

        const card = pickerEl.querySelector('.preset-popup-card');
        if (!card) {
            pickerEl.classList.add('show');
            return;
        }

        pickerEl._animating = true;
        delete pickerEl._closing;
        clearTimeout(pickerEl._cleanupT);
        clearTimeout(pickerEl._revealT);
        cancelAnimationFrame(pickerEl._openRaf || 0);
        pickerEl._openSettled = false;

        const isChild = pickerEl.classList.contains('transparent-bg');
        const srcBtn = sourceEl || document.getElementById('preset-modal-download-btn');
        const sRect = measureSourceRect(srcBtn, isChild);
        pickerEl._sourceRect = sRect;
        pickerEl._sourceEl = srcBtn;

        clearTimeout(pickerEl._revealT);
        if (srcBtn && srcBtn.getClientRects().length > 0) {
            srcBtn.style.transition = 'opacity 0.14s ease';
            srcBtn.style.opacity = '0';
            srcBtn.style.pointerEvents = 'none';
            pickerEl._hidSource = true;
        } else {
            pickerEl._hidSource = false;
        }

        if (isChild) {
            setSwPickerStacked(true);
        }

        const btnRadius = sRect.height / 2;
        const geom = getPresetPopupGeometry(card);
        pickerEl._targetGeom = geom;

        const header = card.querySelector('.preset-popup-header');
        const desc = card.querySelector('.preset-popup-desc');
        const body = card.querySelector('.preset-popup-body');

        card.style.transition = 'none';
        card.style.transform = 'none';
        card.style.left = `${Math.round(sRect.left)}px`;
        card.style.top = `${Math.round(sRect.top)}px`;
        card.style.width = `${Math.round(sRect.width)}px`;
        card.style.height = `${Math.round(sRect.height)}px`;
        card.style.borderRadius = `${btnRadius}px`;
        card.style.opacity = '1';
        card.style.visibility = 'visible';
        card.style.pointerEvents = 'auto';
        card.classList.add('expanded');

        hideMorphFace(card);

        [header, desc, body].forEach(el => {
            if (el) {
                el.style.transition = 'none';
                el.style.opacity = '0';
            }
        });

        pickerEl.style.transition = 'none';
        pickerEl.style.pointerEvents = 'auto';
        pickerEl.classList.add('show');

        void card.offsetHeight;
        void pickerEl.offsetHeight;

        pickerEl._openRaf = requestAnimationFrame(() => {
            if (!isChild) {
                document.body.classList.add('preset-popup-active');
            }

            card.style.transition = `left 0.44s ${POPUP_EASE}, top 0.44s ${POPUP_EASE}, width 0.44s ${POPUP_EASE}, height 0.44s ${POPUP_EASE}, border-radius 0.44s ${POPUP_EASE}`;
            card.style.left = `${geom.targetLeft}px`;
            card.style.top = `${geom.targetTop}px`;
            card.style.width = `${geom.targetW}px`;
            card.style.height = `${geom.targetH}px`;
            card.style.borderRadius = geom.borderRadius;

            if (header) {
                header.style.transition = 'opacity 0.28s ease 0.16s';
                header.style.opacity = '1';
            }
            if (desc) {
                desc.style.transition = 'opacity 0.28s ease 0.18s';
                desc.style.opacity = '1';
            }
            if (body) {
                body.style.transition = 'opacity 0.28s ease 0.20s';
                body.style.opacity = '1';
            }

            pickerEl._openSettled = true;
            pickerEl._cleanupT = setTimeout(() => {
                pickerEl._animating = false;
            }, 470);
        });
    }

    function closePresetPopup(pickerEl, callback) {
        if (!pickerEl) {
            if (callback) callback();
            return;
        }
        if (pickerEl._closing) {
            if (callback) callback();
            return;
        }

        pickerEl._closing = true;
        pickerEl._animating = false;

        const card = pickerEl.querySelector('.preset-popup-card');
        const header = card ? card.querySelector('.preset-popup-header') : null;
        const desc = card ? card.querySelector('.preset-popup-desc') : null;
        const body = card ? card.querySelector('.preset-popup-body') : null;
        const srcEl = pickerEl._sourceEl;

        const revealSource = () => {
            if (!srcEl) return;
            srcEl.style.transition = 'opacity 0.2s ease';
            srcEl.style.opacity = '';
        };

        const finish = () => {
            clearTimeout(pickerEl._revealT);
            if (srcEl) {
                srcEl.style.transition = '';
                srcEl.style.opacity = '';
                srcEl.style.pointerEvents = '';
            }
            pickerEl.classList.remove('show');
            pickerEl.classList.remove('transparent-bg');
            pickerEl.style.cssText = '';
            if (card) {
                card.classList.remove('expanded');
                card.style.cssText = '';
            }
            [header, desc, body].forEach(el => {
                if (el) el.style.cssText = '';
            });
            const face = card ? card.querySelector('.preset-morph-face') : null;
            if (face) {
                face.style.transition = 'none';
                face.style.opacity = '0';
            }
            delete pickerEl._closing;
            if (!anyOtherPickerActive(null)) {
                document.body.classList.remove('preset-popup-active');
            }
            if (callback) callback();
        };

        if (!card || !card.classList.contains('expanded')) {
            cancelAnimationFrame(pickerEl._openRaf || 0);
            finish();
            return;
        }

        cancelAnimationFrame(pickerEl._openRaf || 0);
        const pendingGeom = pickerEl._targetGeom;
        if (!pickerEl._openSettled && pendingGeom) {
            card.style.transition = 'none';
            card.style.left = `${pendingGeom.targetLeft}px`;
            card.style.top = `${pendingGeom.targetTop}px`;
            card.style.width = `${pendingGeom.targetW}px`;
            card.style.height = `${pendingGeom.targetH}px`;
            card.style.borderRadius = pendingGeom.borderRadius;
            void card.offsetHeight;
        }
        pickerEl._openSettled = true;

        const wasChild = pickerEl.classList.contains('transparent-bg');
        const sRect = resolveCloseRect(pickerEl, wasChild);

        if (wasChild) {
            setSwPickerStacked(false);
        }

        if (!anyOtherPickerActive(pickerEl)) {
            restorePreviewSynced();
        }

        [header, desc, body].forEach(el => {
            if (el) {
                el.style.transition = 'opacity 0.16s ease';
                el.style.opacity = '0';
            }
        });

        const face = buildMorphFace(card, srcEl);
        face.style.transition = 'none';
        face.style.opacity = '0';
        void face.offsetHeight;
        face.style.transition = 'opacity 0.18s ease 0.1s';
        face.style.opacity = '1';

        const btnRadius = sRect.height / 2;
        card.style.transition = `left 0.34s ${POPUP_EASE}, top 0.34s ${POPUP_EASE}, width 0.34s ${POPUP_EASE}, height 0.34s ${POPUP_EASE}, border-radius 0.34s ${POPUP_EASE}, opacity 0.12s ease 0.24s, background-color 0.18s ease 0.16s, border-color 0.18s ease 0.16s`;
        card.style.left = `${Math.round(sRect.left)}px`;
        card.style.top = `${Math.round(sRect.top)}px`;
        card.style.width = `${Math.round(sRect.width)}px`;
        card.style.height = `${Math.round(sRect.height)}px`;
        card.style.borderRadius = `${btnRadius}px`;
        card.style.backgroundColor = 'transparent';
        card.style.borderColor = 'transparent';

        pickerEl._revealT = setTimeout(revealSource, 250);
        pickerEl._cleanupT = setTimeout(finish, 380);
    }

    function closeAllPresetPickers() {
        POPUP_IDS
            .map(id => document.getElementById(id))
            .filter(isPickerShown)
            .reverse()
            .forEach(el => closePresetPopup(el));
    }

    function openAmVariantPicker(presetData, showBackButton = false, sourceBtn = null) {
        const picker = document.getElementById('am-variant-picker');
        const optionsContainer = document.getElementById('am-variant-options');
        const backBtn = document.getElementById('back-am-variant');
        if (!picker || !optionsContainer) return;

        if (backBtn) {
            const iconSpan = backBtn.querySelector('.material-symbols-rounded');
            if (iconSpan) {
                iconSpan.textContent = showBackButton ? 'arrow_back' : 'close';
            }
            backBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePresetPopup(picker);
            };
        }

        picker.classList.toggle('transparent-bg', showBackButton);

        let html = '';

        if (presetData.amPremiumUrl) {
            html += `
                <button type="button" class="preset-option-btn" data-url="${escapeHtml(presetData.amPremiumUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion Premium">
                    <span>${escapeHtml(t('preset_am_premium') || 'Alight Motion Premium')}</span>
                    <span class="material-symbols-rounded">open_in_new</span>
                </button>
            `;
        }

        if (presetData.am5MbUrl) {
            html += `
                <button type="button" class="preset-option-btn" data-url="${escapeHtml(presetData.am5MbUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion 5MB">
                    <span>${escapeHtml(t('preset_am_5mb') || 'Alight Motion 5MB')}</span>
                    <span class="material-symbols-rounded">open_in_new</span>
                </button>
            `;
        }

        if (presetData.amXmlUrl) {
            html += `
                <button type="button" class="preset-option-btn am-xml-btn" data-url="${escapeHtml(presetData.amXmlUrl)}">
                    <span class="material-symbols-rounded">code</span>
                    <span>${escapeHtml(t('preset_xml') || 'XML')}</span>
                    <span class="material-symbols-rounded">download</span>
                </button>
            `;
        }

        if (Array.isArray(presetData.amXmlExtras) && presetData.amXmlExtras.length > 0) {
            html += `
                <div class="preset-extra-section">
                    <div class="preset-section-label">
                        ${escapeHtml(t('preset_additional_files') || 'Additional Files:')}
                    </div>
                    <div class="preset-extra-list">
            `;
            presetData.amXmlExtras.forEach(extra => {
                html += `
                    <button type="button" class="preset-option-btn preset-extra-btn" data-url="${escapeHtml(extra.url)}">
                        <span>${escapeHtml(extra.label)}</span>
                        <span class="material-symbols-rounded">download</span>
                    </button>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        optionsContainer.innerHTML = html;

        optionsContainer.querySelectorAll('.preset-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) {
                    if (btn.classList.contains('am-xml-btn')) {
                        const rawUrl = normalizeXmlUrl(url);
                        const proxyUrl = `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
                        if (window.showToast) window.showToast(t('preset_download_xml_downloading') || 'Downloading XML...');
                        fetch(proxyUrl)
                            .then(r => r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`)))
                            .then(blob => {
                                const xmlBlob = new Blob([blob], { type: 'application/xml' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(xmlBlob);
                                a.download = (presetData.name || 'preset') + '.xml';
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
                            })
                            .catch(() => {
                                const a = document.createElement('a');
                                a.href = rawUrl;
                                a.download = (presetData.name || 'preset') + '.xml';
                                a.target = '_blank';
                                a.rel = 'noopener noreferrer';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            });
                    } else {
                        window.open(ensureProtocol(url), '_blank', 'noopener');
                    }
                }
                if (!btn.classList.contains('preset-extra-btn')) {
                    closeAllPresetPickers();
                }
            });
        });

        openPresetPopup(picker, sourceBtn);
    }

    function openSwDetailPicker(entry, presetData, showBackButton = false, sourceBtn = null) {
        const picker = document.getElementById('sw-detail-picker');
        const titleText = document.getElementById('sw-detail-title-text');
        const iconEl = document.getElementById('sw-detail-icon');
        const downloadBtn = document.getElementById('sw-detail-download-btn');
        const pluginSection = document.getElementById('sw-detail-plugin-section');
        const pluginsContainer = document.getElementById('sw-detail-plugins');
        const backBtn = document.getElementById('back-sw-detail');

        if (!picker || !titleText || !downloadBtn) return;

        if (backBtn) {
            const iconSpan = backBtn.querySelector('.material-symbols-rounded');
            if (iconSpan) {
                iconSpan.textContent = showBackButton ? 'arrow_back' : 'close';
            }
            backBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                closePresetPopup(picker);
            };
        }

        picker.classList.toggle('transparent-bg', showBackButton);

        const swLabel = SOFTWARE_FULL_NAMES[entry.sw] || entry.sw;
        titleText.textContent = swLabel;

        const iconSrc = resolveBadgeIcon(entry.icon || entry.sw);
        if (iconSrc && iconEl) {
            iconEl.src = iconSrc;
            iconEl.alt = swLabel;
            iconEl.classList.remove('hidden');
        } else if (iconEl) {
            iconEl.classList.add('hidden');
        }

        downloadBtn.onclick = () => {
            if (entry.url) {
                window.open(ensureProtocol(entry.url), '_blank', 'noopener');
            }
            closeAllPresetPickers();
        };

        if (entry.sw === 'AE' && presetData.plugin) {
            const plugins = String(presetData.plugin).split(',').map(p => p.trim()).filter(Boolean);
            if (plugins.length > 0 && pluginsContainer && pluginSection) {
                pluginsContainer.innerHTML = plugins.map(pName => `
                    <div class="preset-plugin-badge">
                        <span class="material-symbols-rounded">extension</span>
                        <span>${escapeHtml(pName)}</span>
                    </div>
                `).join('');
                pluginSection.classList.remove('hidden');
            } else if (pluginSection) {
                pluginSection.classList.add('hidden');
            }
        } else if (pluginSection) {
            pluginSection.classList.add('hidden');
        }

        openPresetPopup(picker, sourceBtn);
    }

    function openSwDownloadPicker(urls, presetName, presetData) {
        const picker = document.getElementById('sw-download-picker');
        const optionsContainer = document.getElementById('sw-download-options');
        if (!picker || !optionsContainer) return;

        optionsContainer.innerHTML = urls.map(entry => {
            const icon = resolveBadgeIcon(entry.icon || entry.sw);
            const label = SOFTWARE_FULL_NAMES[entry.sw] || entry.sw;
            return `
                <button type="button" class="preset-option-btn" data-sw="${escapeHtml(entry.sw)}" data-url="${escapeHtml(entry.url || '')}">
                    ${icon ? `<img src="${icon}" alt="${escapeHtml(label)}">` : `<span class="material-symbols-rounded">apps</span>`}
                    <span>${escapeHtml(label)}</span>
                    <span class="material-symbols-rounded">chevron_right</span>
                </button>`;
        }).join('');

        optionsContainer.querySelectorAll('.preset-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sw = btn.dataset.sw;
                const url = btn.dataset.url;
                if (sw === 'AM') {
                    openAmVariantPicker(presetData, true, btn);
                } else {
                    const isFishTools = ['FishTools Studio', 'FTS', 'FishTools', 'OpenFishTools'].includes(sw);
                    if (isFishTools && url) {
                        window.open(ensureProtocol(url), '_blank', 'noopener');
                        closeAllPresetPickers();
                    } else {
                        openSwDetailPicker({ sw, url }, presetData, true, btn);
                    }
                }
            });
        });

        openPresetPopup(picker);
    }

    function handlePresetDownloadClick(preset) {
        const softwareArr = Array.isArray(preset.software) ? preset.software : (preset.software ? [preset.software] : []);
        let urls = Array.isArray(preset.urls) ? preset.urls.filter(u => {
            if (u.sw === 'AM') {
                return !!(preset.amPremiumUrl || preset.am5MbUrl || preset.amXmlUrl);
            }
            return !!u.url;
        }) : [];

        if (softwareArr.includes('AM') && !urls.some(u => u.sw === 'AM')) {
            if (preset.amPremiumUrl || preset.am5MbUrl || preset.amXmlUrl) {
                urls.push({ sw: 'AM', url: preset.amPremiumUrl || preset.am5MbUrl || preset.amXmlUrl });
            }
        }

        if (softwareArr.length === 1 && softwareArr.includes('AM')) {
            openAmVariantPicker(preset, false);
        } else if (urls.length > 1) {
            openSwDownloadPicker(urls, preset.name, preset);
        } else if (urls.length === 1) {
            if (urls[0].sw === 'AM') {
                openAmVariantPicker(preset, false);
            } else {
                const isFishTools = ['FishTools Studio', 'FTS', 'FishTools', 'OpenFishTools'].includes(urls[0].sw);
                if (isFishTools && urls[0].url) {
                    window.open(ensureProtocol(urls[0].url), '_blank', 'noopener');
                } else {
                    openSwDetailPicker(urls[0], preset, false);
                }
            }
        } else if (preset.url) {
            const hasAe = softwareArr.includes('AE');
            const hasFts = softwareArr.some(s => ['FishTools Studio', 'FTS', 'FishTools', 'OpenFishTools'].includes(s));
            if (hasFts) {
                window.open(ensureProtocol(preset.url), '_blank', 'noopener');
            } else if (hasAe || preset.plugin) {
                const sw = hasAe ? 'AE' : softwareArr[0];
                openSwDetailPicker({ sw, url: preset.url }, preset, false);
            } else {
                window.open(ensureProtocol(preset.url), '_blank', 'noopener');
            }
        }
    }

    function previewStageHtml(coverUrl, name) {
        const imgHtml = coverUrl
            ? `<img class="preset-preview-thumb" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(name || '')}" referrerpolicy="no-referrer">`
            : '<div class="preset-thumb-placeholder"><span class="material-symbols-rounded">smart_display</span></div>';
        return `<div class="preset-preview-stage">${imgHtml}</div>`;
    }

    function fillPresetModal(preset) {
        cleanupPresetModalMedia();
        const token = presetModalMediaToken;
        const modalMedia = document.getElementById('preset-modal-media');
        const mediaUrl = preset.media == null ? '' : String(preset.media).trim();

        if (isTikTokLikeUrl(mediaUrl) && !tiktokDeadUrls.has(mediaUrl)) {
            currentPreviewTikTokUrl = mediaUrl;
            const cached = tiktokMediaCache.get(mediaUrl);
            modalMedia.innerHTML = previewStageHtml(cached && cached.cover ? cached.cover : '', preset.name);
            if (!cached || !cached.cover) {
                resolveTikTokCover(mediaUrl).then(cv => {
                    if (token !== presetModalMediaToken) return;
                    if (!cv || !cv.cover) return;
                    const img = modalMedia.querySelector('.preset-preview-thumb');
                    if (img && !img.src) img.src = cv.cover;
                });
            }
        } else {
            currentPreviewTikTokUrl = '';
            modalMedia.innerHTML = presetMediaHtml(preset);
        }

        modalMedia.querySelectorAll('video').forEach(v => {
            v.muted = true;
            v.loop = true;
            v.play().catch(() => {});
        });
        attachPresetVideoSoundToggle(modalMedia);

        measureMediaRatio(modalMedia).then(r => {
            if (token !== presetModalMediaToken || !r) return;
            pendingModalRatio = r;
            applyPendingModalRatio();
        });

        if (currentPreviewTikTokUrl) {
            resolveTikTokMedia(mediaUrl).then(media => {
                if (!media || !media.play) return;
                if (token !== presetModalMediaToken) return;
                if (modalMedia.querySelector('video')) return;

                const video = document.createElement('video');
                video.src = media.play;
                video.muted = true;
                video.loop = true;
                video.autoplay = true;
                video.playsInline = true;
                video.preload = 'auto';
                video.setAttribute('playsinline', '');
                video.className = 'preset-preview-video';
                modalMedia.appendChild(video);
                video.play().catch(() => {});

                const revealVideo = () => {
                    if (token !== presetModalMediaToken) return;
                    video.classList.add('is-ready');
                    attachPresetVideoSoundToggle(modalMedia);
                    const stage = modalMedia.querySelector('.preset-preview-stage');
                    if (stage) {
                        stage.classList.add('is-done');
                        setTimeout(() => stage.remove(), 600);
                    }
                };
                if (video.readyState >= 3) revealVideo();
                else video.addEventListener('canplay', revealVideo, { once: true });

                watchVideoRatio(video, token);
            });
        }

        const badges = (Array.isArray(preset.software) ? preset.software : [])
            .map(sw => {
                const icon = resolveBadgeIcon(sw);
                return icon ? `<span class="preset-badge"><img src="${icon}" alt="${escapeHtml(sw)}"></span>` : '';
            })
            .join('');
        document.getElementById('preset-modal-badges').innerHTML = badges;

        document.getElementById('preset-modal-name').textContent = preset.name || '';

        const metaParts = [];
        if (preset.type) metaParts.push(escapeHtml(preset.type));
        if (preset.version) metaParts.push(escapeHtml(String(preset.version).replace(/^v/i, '')));
        if (preset.size) metaParts.push(escapeHtml(preset.size));
        document.getElementById('preset-modal-meta').innerHTML = metaParts
            .map(x => `<span>${x}</span>`)
            .join('<span class="meta-dot">&#8226;</span>');

        const softwareArr = Array.isArray(preset.software) ? preset.software : (preset.software ? [preset.software] : []);
        const hasUrls = Array.isArray(preset.urls) && preset.urls.length > 0;
        const hasAm = !!(preset.amPremiumUrl || preset.am5MbUrl || preset.amXmlUrl);
        const canDownload = hasUrls || hasAm || !!preset.url;

        const btn = document.getElementById('preset-modal-download-btn');
        if (canDownload) {
            btn.disabled = false;
            btn.onclick = () => handlePresetDownloadClick(preset);
        } else {
            btn.disabled = true;
            btn.onclick = null;
        }
    }

    let presetCloseTimer = null;
    let currentOpenPreset = null;
    let presetModalPushedHistory = false;

    function getPresetIdentifier(p) {
        if (!p) return null;
        if (p.presetId != null && p.presetId !== '' && !isNaN(Number(p.presetId))) {
            return Number(p.presetId);
        }
        const idx = allPresetsCache.findIndex(x => x._id === p._id);
        if (idx !== -1) return idx + 1;
        return p._id || null;
    }

    function forceFinishPresetModalClose() {
        if (presetCloseTimer) {
            clearTimeout(presetCloseTimer);
            presetCloseTimer = null;
        }
        currentOpenPreset = null;
        const backdrop = document.getElementById('preset-modal-backdrop');
        const cardEl = document.getElementById('preset-modal-card');
        if (!backdrop || !cardEl) return;
        if (!cardEl.classList.contains('expanded')) return;
        backdrop.classList.remove('visible');
        backdrop.style.opacity = '';
        document.body.classList.remove('preset-modal-open');
        document.body.classList.remove('preset-popup-active');
        cardEl.classList.remove('expanded');
        clearPresetChildFx(cardEl);
        cardEl.style.cssText = '';
        cleanupPresetModalMedia();
        if (presetModalSourceCard) {
            presetModalSourceCard.classList.remove('preset-source-hidden');
            presetModalSourceCard = null;
        }
        isPresetModalAnimating = false;
    }

    async function openPresetModal(preset, sourceCard, fromPopState = false) {
        const backdrop = document.getElementById('preset-modal-backdrop');
        const cardEl = document.getElementById('preset-modal-card');
        const mediaEl = document.getElementById('preset-modal-media');
        if (!backdrop || !cardEl || !mediaEl) return;

        forceFinishPresetModalClose();
        if (isPresetModalAnimating) return;

        currentOpenPreset = preset;
        const pIdent = getPresetIdentifier(preset);
        if (pIdent != null && !fromPopState) {
            const targetPath = `/${pIdent}`;
            if (window.location.pathname === targetPath) {
                history.replaceState({ presetModalOpen: true, presetId: pIdent }, '', targetPath);
                presetModalPushedHistory = false;
            } else {
                history.pushState({ presetModalOpen: true, presetId: pIdent }, '', targetPath);
                presetModalPushedHistory = true;
            }
        }

        fillPresetModal(preset);
        isPresetModalAnimating = true;

        presetModalSourceCard = sourceCard;
        if (sourceCard) {
            sourceCard.classList.add('preset-source-hidden');
        }

        const sourceRect = (sourceCard && sourceCard.getClientRects().length > 0)
            ? sourceCard.getBoundingClientRect()
            : null;
        presetModalSourceRect = sourceRect ? { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height } : null;

        const uiEl = cardEl.querySelector('.preset-modal-overlay-ui');
        const closeBtn = cardEl.querySelector('#preset-modal-close-btn');

        backdrop.style.transition = 'none';
        backdrop.style.opacity = '0';
        backdrop.classList.add('visible');
        document.body.classList.add('preset-modal-open');

        const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

        uiEl.style.transition = 'none';
        uiEl.style.opacity = '0';
        uiEl.style.transform = 'translateY(18px)';

        closeBtn.style.transition = 'none';
        closeBtn.style.opacity = '0';
        closeBtn.style.transform = 'scale(0.6)';

        const ratio = await Promise.race([
            measureMediaRatio(mediaEl),
            new Promise(r => setTimeout(() => r(null), 120))
        ]);
        {
            presetModalMediaRatio = ratio;
            const geom = getPresetModalGeometry(ratio);

            if (sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
                const sx = geom.targetW > 0 ? sourceRect.width / geom.targetW : 1;
                const sy = geom.targetH > 0 ? sourceRect.height / geom.targetH : 1;
                const dx = sourceRect.left - geom.targetLeft;
                const dy = sourceRect.top - geom.targetTop;

                cardEl.style.transition = 'none';
                cardEl.style.willChange = 'transform';
                cardEl.style.transformOrigin = '0 0';
                cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            } else {
                cardEl.style.transition = 'none';
                cardEl.style.willChange = 'transform, opacity';
                cardEl.style.transformOrigin = 'center center';
                cardEl.style.transform = 'translate(0px, 0px) scale(0.92)';
            }

            cardEl.style.left = `${geom.targetLeft}px`;
            cardEl.style.top = `${geom.targetTop}px`;
            cardEl.style.width = `${geom.targetW}px`;
            cardEl.style.height = `${geom.targetH}px`;
            cardEl.style.borderRadius = geom.borderRadius;
            cardEl.classList.add('expanded');

            void cardEl.offsetHeight;

            backdrop.style.transition = 'opacity 0.28s ease';
            backdrop.style.opacity = '1';

            const morphDur = 0.36;
            cardEl.style.transition = `transform ${morphDur}s ${EASE}, border-radius 0.28s ease`;
            cardEl.style.transform = 'translate(0px, 0px) scale(1, 1)';
            cardEl.style.borderRadius = geom.borderRadius;

            const contentDelay = 0.26;
            const contentDur = 0.22;

            uiEl.style.transition = `opacity ${contentDur}s ease ${contentDelay}s, transform ${contentDur}s ${EASE} ${contentDelay}s`;
            uiEl.style.opacity = '1';
            uiEl.style.transform = 'translateY(0)';

            closeBtn.style.transition = `opacity ${contentDur}s ease ${contentDelay}s, transform ${contentDur}s cubic-bezier(0.34, 1.4, 0.64, 1) ${contentDelay}s`;
            closeBtn.style.opacity = '1';
            closeBtn.style.transform = 'scale(1)';

            setTimeout(() => {
                clearPresetChildFx(cardEl);
                cardEl.style.willChange = '';
                cardEl.style.transformOrigin = '';
                cardEl.style.transform = '';
                cardEl.style.transition = 'transform 0.44s var(--ease-spring-soft), filter 0.35s ease';
                isPresetModalAnimating = false;
                applyPendingModalRatio();
            }, Math.round((contentDelay + contentDur) * 1000) + 80);
        }
    }

    function closePresetModal(instant = false, fromPopState = false) {
        closeAllPresetPickers();
        const backdrop = document.getElementById('preset-modal-backdrop');
        const cardEl = document.getElementById('preset-modal-card');
        if (!backdrop || !cardEl || !cardEl.classList.contains('expanded')) {
            currentOpenPreset = null;
            return;
        }

        currentOpenPreset = null;

        if (!fromPopState && !instant) {
            if (presetModalPushedHistory) {
                presetModalPushedHistory = false;
                history.back();
            } else {
                history.replaceState(null, '', '/#preset');
            }
        } else if (instant) {
            presetModalPushedHistory = false;
        }

        const restoreCard = () => {
            if (presetModalSourceCard) {
                presetModalSourceCard.classList.remove('preset-source-hidden');
                presetModalSourceCard = null;
            }
        };

        if (instant) {
            if (presetCloseTimer) {
                clearTimeout(presetCloseTimer);
                presetCloseTimer = null;
            }
            clearPresetChildFx(cardEl);
            backdrop.classList.remove('visible');
            backdrop.style.opacity = '';
            document.body.classList.remove('preset-modal-open');
            document.body.classList.remove('preset-popup-active');
            cardEl.classList.remove('expanded');
            cardEl.style.cssText = '';
            cleanupPresetModalMedia();
            restoreCard();
            return;
        }

        if (isPresetModalAnimating) return;
        isPresetModalAnimating = true;

        document.body.classList.remove('preset-modal-open');
        document.body.classList.remove('preset-popup-active');

        const rect = presetModalSourceRect;
        const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

        fadePresetChromeOut(cardEl);

        if (rect && rect.width > 0 && rect.height > 0) {
            const cur = cardEl.getBoundingClientRect();
            const sx = cur.width > 0 ? rect.width / cur.width : 1;
            const sy = cur.height > 0 ? rect.height / cur.height : 1;
            const dx = rect.left - cur.left;
            const dy = rect.top - cur.top;

            cardEl.style.willChange = 'transform';
            cardEl.style.transformOrigin = '0 0';
            cardEl.style.transition = `transform 0.28s ${EASE}, border-radius 0.22s ease`;
            cardEl.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
            cardEl.style.borderRadius = '14px';
        } else {
            cardEl.style.willChange = 'transform, opacity';
            cardEl.style.transition = 'transform 0.24s ease, opacity 0.22s ease';
            cardEl.style.transform = 'scale(0.92)';
            cardEl.style.opacity = '0';
        }

        backdrop.style.transition = 'opacity 0.22s ease';
        backdrop.style.opacity = '0';

        presetCloseTimer = setTimeout(() => {
            presetCloseTimer = null;
            backdrop.classList.remove('visible');
            backdrop.style.opacity = '';
            cardEl.classList.remove('expanded');
            clearPresetChildFx(cardEl);
            cardEl.style.cssText = '';
            cleanupPresetModalMedia();
            restoreCard();
            isPresetModalAnimating = false;
        }, rect ? 300 : 220);
    }

    let presetDeepLinkToken = 0;

    function handlePendingPresetDeepLink() {
        const num = window.pendingPresetIndex;
        if (!num || num < 1) return;
        window.pendingPresetIndex = null;
        const item = allPresetsCache.find(p => Number(p.presetId) === num)
            || allPresetsCache.find(p => String(p._id) === String(num));
        if (!item) return;

        const myToken = ++presetDeepLinkToken;
        const alive = () => myToken === presetDeepLinkToken;

        const tryOpen = (attempt = 0) => {
            if (!alive()) return;
            const card = document.querySelector(`.preset-card[data-id="${item._id}"]`);
            if (!card || card.getClientRects().length === 0) {
                if (attempt < 24) return setTimeout(() => tryOpen(attempt + 1), 250);
                return;
            }

            setTimeout(() => {
                if (!alive()) return;
                const scroller = document.getElementById('content-scroller');
                const rect = card.getBoundingClientRect();
                const vh = window.innerHeight || document.documentElement.clientHeight;
                const fullyVisible = rect.top >= 0 && rect.bottom <= vh;
                if (scroller && !fullyVisible) {
                    const targetTop = Math.max(0, scroller.scrollTop + rect.top - vh * 0.35);
                    scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
                }
                setTimeout(() => {
                    if (!alive()) return;
                    const freshCard = document.querySelector(`.preset-card[data-id="${item._id}"]`);
                    if (freshCard && freshCard.getClientRects().length > 0) {
                        openPresetModal(item, freshCard);
                    }
                }, 800);
            }, 800);
        };

        requestAnimationFrame(() => tryOpen());
    }

    function initPresetPage() {
        const grid = document.getElementById('preset-grid');
        if (!grid) return;

        document.getElementById('preset-modal-close-btn')?.addEventListener('click', () => closePresetModal());
        document.getElementById('preset-modal-backdrop')?.addEventListener('click', () => closePresetModal());

        const closeSwBtn = document.getElementById('close-sw-download');
        if (closeSwBtn) {
            closeSwBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeAllPresetPickers();
            });
        }

        POPUP_IDS.forEach(id => {
            const picker = document.getElementById(id);
            if (!picker) return;
            picker.addEventListener('click', (e) => {
                if (e.target === picker) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (picker.classList.contains('transparent-bg')) {
                        closePresetPopup(picker);
                    } else {
                        closeAllPresetPickers();
                    }
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const anyOpen = document.querySelector('.preset-popup-overlay.show');
                if (anyOpen) {
                    closeAllPresetPickers();
                } else {
                    closePresetModal();
                }
            }
        });

        window.addEventListener('hashchange', () => {
            presetDeepLinkToken++;
            closeAllPresetPickers();
            closePresetModal(true);
            const curH = (location.hash || '').toLowerCase();
            if (curH === '#preset' || curH === '#presets') {
                loadPresetsData();
                const grid = document.getElementById('preset-grid');
                if (grid) observeTikTokThumbs(grid);
            }
        });

        window.addEventListener('popstate', () => {
            const cardEl = document.getElementById('preset-modal-card');
            const isExpanded = cardEl && cardEl.classList.contains('expanded');

            const match = window.location.pathname.match(/^\/(?:preset\/)?(\d+)\/?$/);
            if (match) {
                const id = parseInt(match[1], 10);
                if (isExpanded && currentOpenPreset && getPresetIdentifier(currentOpenPreset) === id) {
                    return;
                }
                if (!presetsFetched) {
                    window.pendingPresetIndex = id;
                    loadPresetsData();
                    return;
                }
                const item = allPresetsCache.find(p => Number(p.presetId) === id)
                    || allPresetsCache.find(p => String(p._id) === String(id))
                    || allPresetsCache[id - 1];
                if (item) {
                    const card = document.querySelector(`.preset-card[data-id="${item._id}"]`);
                    openPresetModal(item, card, true);
                    return;
                }
            }

            if (isExpanded) {
                closePresetModal(false, true);
            }
        });

        window.addEventListener('resize', () => {
            const cardEl = document.getElementById('preset-modal-card');
            if (!cardEl || !cardEl.classList.contains('expanded') || isPresetModalAnimating) return;
            const geom = getPresetModalGeometry(presetModalMediaRatio);
            cardEl.style.transition = 'left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease, border-radius 0.2s ease';
            cardEl.style.left = `${geom.targetLeft}px`;
            cardEl.style.top = `${geom.targetTop}px`;
            cardEl.style.width = `${geom.targetW}px`;
            cardEl.style.height = `${geom.targetH}px`;
            cardEl.style.borderRadius = geom.borderRadius;
        });

        let presetsFetching = false;
        function loadPresetsData() {
            if (presetsFetched || presetsFetching) return;
            presetsFetching = true;
            fetch('/api/presets')
                .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
                .then(data => {
                    if (Array.isArray(data)) allPresetsCache = data.filter(p => !p.hidden);
                    presetsFetched = true;
                    presetsFetching = false;
                    renderPresets(activePresetSoftware);
                    handlePendingPresetDeepLink();
                })
                .catch(err => {
                    console.warn('[Presets] Failed to load:', err);
                    presetsFetched = true;
                    presetsFetching = false;
                    renderPresets(activePresetSoftware);
                });
        }

        window.loadPresetsIfNeeded = loadPresetsData;

        const rawHash = (location.hash || '').toLowerCase();
        const isPresetRoute = rawHash === '#preset' || rawHash === '#presets' || !!window.pendingPresetIndex;
        if (isPresetRoute) {
            loadPresetsData();
        }
    }

    initPresetPage();
})();
