document.addEventListener('DOMContentLoaded', () => {
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';

    const inputUrl = document.getElementById('tool-tiktok-stats-input');
    const btnAnalyse = document.getElementById('btn-analyse-tiktok');
    const statusText = document.getElementById('tool-tiktok-stats-status');
    const resultsContainer = document.getElementById('tiktok-stats-results');

    const statsCover = document.getElementById('stats-video-cover');
    const statsCreatorName = document.getElementById('stats-creator-name');
    const statsCreatorHandle = document.getElementById('stats-creator-handle');
    const statsCaption = document.getElementById('stats-caption');

    const statsUploadDate = document.getElementById('stats-upload-date');
    const statsRegion = document.getElementById('stats-region');
    const statsShadowban = document.getElementById('stats-shadowban');

    const statsResolution = document.getElementById('stats-resolution');
    const statsFps = document.getElementById('stats-fps');
    const statsBitrate = document.getElementById('stats-bitrate');
    const statsDuration = document.getElementById('stats-duration');
    const statsSize = document.getElementById('stats-size');
    const statsMethod = document.getElementById('stats-method');

    const statsViews = document.getElementById('stats-views');
    const statsLikes = document.getElementById('stats-likes');
    const statsComments = document.getElementById('stats-comments');
    const statsShares = document.getElementById('stats-shares');
    const statsSaves = document.getElementById('stats-saves');
    const statsEngagement = document.getElementById('stats-engagement');

    let isRunning = false;
    let lastAnalysedUrl = '';
    let lastAnalysedTime = 0;
    let lastMetadata = null;
    let lastVideoMeta = null;
    const cacheMap = new Map();

    const COUNTRY_NAMES_ID = {
        'ID': 'Indonesia',
        'MY': 'Malaysia',
        'SG': 'Singapura',
        'US': 'Amerika Serikat',
        'TH': 'Thailand',
        'VN': 'Vietnam',
        'PH': 'Filipina',
        'JP': 'Jepang',
        'KR': 'Korea Selatan',
        'GB': 'Inggris',
        'AU': 'Australia',
        'BR': 'Brasil',
        'DE': 'Jerman',
        'FR': 'Prancis',
        'IN': 'India',
        'RU': 'Rusia',
        'CA': 'Kanada',
        'MX': 'Meksiko',
        'IT': 'Italia',
        'ES': 'Spanyol',
        'NL': 'Belanda',
        'TR': 'Turki',
        'SA': 'Arab Saudi',
        'AE': 'Uni Emirat Arab',
        'CN': 'Tiongkok',
        'TW': 'Taiwan',
        'HK': 'Hong Kong'
    };

    const COUNTRY_NAMES_EN = {
        'ID': 'Indonesia',
        'MY': 'Malaysia',
        'SG': 'Singapore',
        'US': 'United States',
        'TH': 'Thailand',
        'VN': 'Vietnam',
        'PH': 'Philippines',
        'JP': 'Japan',
        'KR': 'South Korea',
        'GB': 'United Kingdom',
        'AU': 'Australia',
        'BR': 'Brazil',
        'DE': 'Germany',
        'FR': 'France',
        'IN': 'India',
        'RU': 'Russia',
        'CA': 'Canada',
        'MX': 'Mexico',
        'IT': 'Italy',
        'ES': 'Spain',
        'NL': 'Netherlands',
        'TR': 'Turkey',
        'SA': 'Saudi Arabia',
        'AE': 'United Arab Emirates',
        'CN': 'China',
        'TW': 'Taiwan',
        'HK': 'Hong Kong'
    };

    function formatRegion(code) {
        if (!code) return '—';
        const upper = code.toUpperCase();
        const isId = (window.getCurrentLanguage && window.getCurrentLanguage() === 'id');
        const map = isId ? COUNTRY_NAMES_ID : COUNTRY_NAMES_EN;
        return map[upper] || upper;
    }

    function formatUploadDate(epoch) {
        if (!epoch || isNaN(epoch)) return '—';
        try {
            const date = new Date(epoch * 1000);
            const isId = (window.getCurrentLanguage && window.getCurrentLanguage() === 'id');
            const locale = isId ? 'id-ID' : 'en-US';
            return date.toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '—';
        }
    }

    function formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '—';
        try {
            return new Intl.NumberFormat().format(num);
        } catch {
            return String(num);
        }
    }

    function isTikTokUrl(raw) {
        if (!raw || typeof raw !== 'string') return false;
        let u = raw.trim();
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = 'https://' + u;
        }
        try {
            const parsed = new URL(u);
            const host = parsed.hostname.toLowerCase();
            const validHosts = ['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'tikwm.com'];
            return validHosts.some(h => host === h || host.endsWith('.' + h));
        } catch {
            return false;
        }
    }

    function setInitialSkeletons() {
        if (statsCover) statsCover.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120" fill="%232c322b"/>';
        if (statsCreatorName) statsCreatorName.innerHTML = '<span class="stats-skeleton stats-skeleton-text"></span>';
        if (statsCreatorHandle) statsCreatorHandle.innerHTML = '<span class="stats-skeleton" style="width: 70px;"></span>';
        if (statsCaption) statsCaption.innerHTML = '<span class="stats-skeleton" style="width: 100%;"></span>';

        const skeletonItems = [
            statsUploadDate, statsRegion, statsShadowban,
            statsResolution, statsFps, statsBitrate, statsDuration, statsSize, statsMethod,
            statsViews, statsLikes, statsComments, statsShares, statsSaves, statsEngagement
        ];

        skeletonItems.forEach(el => {
            if (el) el.innerHTML = '<span class="stats-skeleton"></span>';
        });
    }

    function renderDynamicFields() {
        if (!lastMetadata) return;
        if (statsUploadDate) statsUploadDate.textContent = formatUploadDate(lastMetadata.create_time);
        if (statsRegion) statsRegion.textContent = formatRegion(lastMetadata.region);

        if (statsShadowban) {
            const isShadowbanned = !!lastMetadata.is_nff_or_nr;
            if (isShadowbanned) {
                const label = (window.getTranslation && window.getTranslation('stats_restricted')) || 'Dibatasi';
                statsShadowban.innerHTML = `<span class="stats-badge-warn"><span class="material-symbols-rounded font-16">warning</span>${label}</span>`;
            } else {
                const label = (window.getTranslation && window.getTranslation('stats_safe')) || 'Aman';
                statsShadowban.innerHTML = `<span class="stats-badge-safe"><span class="material-symbols-rounded font-16">check_circle</span>${label}</span>`;
            }
        }
    }

    window.addEventListener('languageChanged', renderDynamicFields);

    btnAnalyse.addEventListener('click', () => {
        let rawInput = inputUrl.value.trim();
        if (!rawInput) {
            const msg = (window.getTranslation && window.getTranslation('stats_err_enter_url')) || 'Please enter a valid TikTok video URL.';
            showStatus(msg, "var(--md-sys-color-error)");
            return;
        }

        if (!isTikTokUrl(rawInput)) {
            const msg = (window.getTranslation && window.getTranslation('stats_err_invalid_url')) || 'URL is not a valid TikTok link.';
            showStatus(msg, "var(--md-sys-color-error)");
            return;
        }

        let url = rawInput;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        const now = Date.now();
        if (url === lastAnalysedUrl && (now - lastAnalysedTime) < 2500 && cacheMap.has(url)) {
            return;
        }

        analyseTikTokVideo(url);
    });

    inputUrl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAnalyse.click();
        }
    });

    function showStatus(message, color = "var(--md-sys-color-primary)") {
        if (statusText) {
            statusText.textContent = message;
            statusText.style.color = color;
        }
    }

    async function analyseTikTokVideo(pageUrl) {
        if (isRunning) return;
        isRunning = true;

        btnAnalyse.disabled = true;
        setInitialSkeletons();
        resultsContainer.classList.remove('hidden');

        const initialStatus = (window.getTranslation && window.getTranslation('status_processing')) || 'Fetching video details...';
        showStatus(initialStatus);

        try {
            let metadata = cacheMap.get(pageUrl);
            if (!metadata) {
                const response = await fetch(`${API_URL}/tiktok-resolve?url=${encodeURIComponent(pageUrl)}&nocache=1`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || errorData.details || `Unable to resolve TikTok video URL (${response.status}).`);
                }
                metadata = await response.json();
                if (metadata && (metadata.play || metadata.hdplay)) {
                    cacheMap.set(pageUrl, metadata);
                }
            }

            const streamUrl = metadata ? (metadata.play || metadata.hdplay) : null;
            if (!metadata || !streamUrl) {
                throw new Error("Could not extract stream URL for this video.");
            }

            lastAnalysedUrl = pageUrl;
            lastAnalysedTime = Date.now();
            lastMetadata = metadata;

            if (statsCover) statsCover.src = metadata.cover || '';
            if (statsCreatorName) statsCreatorName.textContent = metadata.author_nickname || 'Creator';
            if (statsCreatorHandle) statsCreatorHandle.textContent = metadata.author_unique_id ? `@${metadata.author_unique_id}` : '@username';
            if (statsCaption) statsCaption.textContent = metadata.title || '—';

            renderDynamicFields();

            const duration = metadata.duration || 0;
            const size = metadata.size || 0;

            if (statsDuration) statsDuration.textContent = duration ? `${duration}s` : '—';
            if (statsSize) statsSize.textContent = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : '—';

            const playCount = metadata.play_count || 0;
            const diggCount = metadata.digg_count || 0;
            const commentCount = metadata.comment_count || 0;
            const shareCount = metadata.share_count || 0;
            const collectCount = metadata.collect_count || 0;

            if (statsViews) statsViews.textContent = formatNumber(playCount);
            if (statsLikes) statsLikes.textContent = formatNumber(diggCount);
            if (statsComments) statsComments.textContent = formatNumber(commentCount);
            if (statsShares) statsShares.textContent = formatNumber(shareCount);
            if (statsSaves) statsSaves.textContent = formatNumber(collectCount);

            if (statsEngagement) {
                if (playCount > 0) {
                    const totalEngage = diggCount + commentCount + shareCount + collectCount;
                    const engRate = ((totalEngage / playCount) * 100).toFixed(2);
                    statsEngagement.textContent = `${engRate}%`;
                } else {
                    statsEngagement.textContent = '—';
                }
            }

            const analysingStreamStatus = (window.getTranslation && window.getTranslation('stats_status_analysing_video')) || 'Analysing Video Metadata (FPS & Resolution)...';
            showStatus(analysingStreamStatus);

            const videoMeta = await analyseVideoMetadataFromUrl(streamUrl);
            lastVideoMeta = videoMeta;

            if (statsFps) {
                if (videoMeta && videoMeta.fps && !isNaN(videoMeta.fps)) {
                    statsFps.textContent = `${videoMeta.fps} fps`;
                } else {
                    statsFps.textContent = '—';
                }
            }

            if (statsResolution) {
                if (videoMeta && videoMeta.width && videoMeta.height) {
                    statsResolution.textContent = `${videoMeta.width} x ${videoMeta.height}`;
                } else if (metadata.w && metadata.h) {
                    statsResolution.textContent = `${metadata.w} x ${metadata.h}`;
                } else {
                    statsResolution.textContent = '—';
                }
            }

            if (statsBitrate) {
                if (size && duration) {
                    const bitrateKbps = (size * 8) / (duration * 1000);
                    if (bitrateKbps >= 1000) {
                        statsBitrate.textContent = `${(bitrateKbps / 1000).toFixed(2)} Mbps`;
                    } else {
                        statsBitrate.textContent = `${Math.round(bitrateKbps)} kbps`;
                    }
                } else {
                    statsBitrate.textContent = '—';
                }
            }

            showStatus("");
            displayMethod(videoMeta && videoMeta.comment ? videoMeta.comment.trim() : '');

        } catch (err) {
            console.error(err);
            const failMsg = (window.getTranslation && window.getTranslation('stats_err_failed')) || 'Analysis failed.';
            showStatus(err.message || failMsg, "var(--md-sys-color-error)");
        } finally {
            isRunning = false;
            setTimeout(() => {
                btnAnalyse.disabled = false;
            }, 600);
        }
    }

    function displayMethod(comment) {
        if (!statsMethod) return;
        if (!comment) {
            statsMethod.textContent = 'Unknown';
            return;
        }
        if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?$/.test(comment)) {
            statsMethod.innerHTML = '';
            const a = document.createElement('a');
            a.href = 'https://' + comment;
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'stats-method-link';
            a.textContent = comment;
            statsMethod.appendChild(a);
        } else {
            statsMethod.textContent = comment;
        }
    }

    async function analyseVideoMetadataFromUrl(videoUrl) {
        if (!videoUrl || !videoUrl.startsWith('http')) return null;
        try {
            const response = await fetch(`${API_URL}/tiktok-fps?url=${encodeURIComponent(videoUrl)}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            return null;
        }
    }
});
