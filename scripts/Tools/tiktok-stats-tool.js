(function() {
    'use strict';

    const API_URL = '/api';

    const COUNTRY_NAMES_ID = {
        'ID': 'Indonesia', 'MY': 'Malaysia', 'SG': 'Singapura', 'US': 'Amerika Serikat',
        'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Filipina', 'JP': 'Jepang',
        'KR': 'Korea Selatan', 'GB': 'Inggris', 'AU': 'Australia', 'BR': 'Brasil',
        'DE': 'Jerman', 'FR': 'Prancis', 'IN': 'India', 'RU': 'Rusia',
        'CA': 'Kanada', 'MX': 'Meksiko', 'IT': 'Italia', 'ES': 'Spanyol',
        'NL': 'Belanda', 'TR': 'Turki', 'SA': 'Arab Saudi', 'AE': 'Uni Emirat Arab',
        'CN': 'Tiongkok', 'TW': 'Taiwan', 'HK': 'Hong Kong'
    };

    const COUNTRY_NAMES_EN = {
        'ID': 'Indonesia', 'MY': 'Malaysia', 'SG': 'Singapore', 'US': 'United States',
        'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Philippines', 'JP': 'Japan',
        'KR': 'South Korea', 'GB': 'United Kingdom', 'AU': 'Australia', 'BR': 'Brazil',
        'DE': 'Germany', 'FR': 'France', 'IN': 'India', 'RU': 'Russia',
        'CA': 'Canada', 'MX': 'Mexico', 'IT': 'Italy', 'ES': 'Spain',
        'NL': 'Netherlands', 'TR': 'Turkey', 'SA': 'Saudi Arabia', 'AE': 'United Arab Emirates',
        'CN': 'China', 'TW': 'Taiwan', 'HK': 'Hong Kong'
    };

    let isRunning = false;
    let lastAnalysedUrl = '';
    let lastAnalysedTime = 0;
    let lastMetadata = null;
    const cacheMap = new Map();

    function t(key) {
        return (window.getTranslation && window.getTranslation(key)) || key;
    }

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
        const statsCover = document.getElementById('stats-video-cover');
        const statsCreatorName = document.getElementById('stats-creator-name');
        const statsCreatorHandle = document.getElementById('stats-creator-handle');
        const statsCaption = document.getElementById('stats-caption');

        if (statsCover) statsCover.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="120" fill="%232c322b"/>';
        if (statsCreatorName) statsCreatorName.innerHTML = '<span class="stats-skeleton stats-skeleton-text"></span>';
        if (statsCreatorHandle) statsCreatorHandle.innerHTML = '<span class="stats-skeleton" style="width: 70px;"></span>';
        if (statsCaption) statsCaption.innerHTML = '<span class="stats-skeleton" style="width: 100%;"></span>';

        const skeletonIds = [
            'stats-upload-date', 'stats-region', 'stats-shadowban',
            'stats-resolution', 'stats-fps', 'stats-bitrate', 'stats-duration', 'stats-size', 'stats-method',
            'stats-views', 'stats-likes', 'stats-comments', 'stats-shares', 'stats-saves', 'stats-engagement'
        ];

        skeletonIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '<span class="stats-skeleton"></span>';
        });
    }

    function renderDynamicFields() {
        if (!lastMetadata) return;
        const statsUploadDate = document.getElementById('stats-upload-date');
        const statsRegion = document.getElementById('stats-region');
        const statsShadowban = document.getElementById('stats-shadowban');

        if (statsUploadDate) statsUploadDate.textContent = formatUploadDate(lastMetadata.create_time);
        if (statsRegion) statsRegion.textContent = formatRegion(lastMetadata.region);

        if (statsShadowban) {
            const isShadowbanned = !!lastMetadata.is_nff_or_nr;
            if (isShadowbanned) {
                statsShadowban.innerHTML = `<span class="stats-badge-warn"><span class="material-symbols-rounded">warning</span>${t('stats_restricted')}</span>`;
            } else {
                statsShadowban.innerHTML = `<span class="stats-badge-safe"><span class="material-symbols-rounded">check_circle</span>${t('stats_safe')}</span>`;
            }
        }
    }

    window.addEventListener('languageChanged', renderDynamicFields);

    function setButtonState(state, text) {
        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        if (!processBtn) return;

        if (state === 'processing') {
            processBtn.disabled = true;
            processBtn.dataset.state = 'processing';
            if (processLabel) processLabel.textContent = text || t('stats_status_analysing_video') || "Analysing...";
        } else if (state === 'error') {
            processBtn.disabled = false;
            processBtn.dataset.state = 'error';
            if (processLabel) processLabel.textContent = text || t('stats_err_failed') || "Failed";
            setTimeout(() => {
                setButtonState('ready');
            }, 3500);
        } else {
            processBtn.disabled = false;
            processBtn.dataset.state = 'ready';
            if (processLabel) processLabel.textContent = text || t('tool_stats_btn') || "Analyse";
        }
    }

    function displayMethod(comment) {
        const statsMethod = document.getElementById('stats-method');
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

    async function analyseTikTokVideo(pageUrl) {
        if (isRunning) return;
        isRunning = true;

        setButtonState('processing', t('status_processing') || 'Fetching details...');

        setInitialSkeletons();
        const resultsContainer = document.getElementById('tiktok-stats-results');
        if (resultsContainer) {
            resultsContainer.classList.remove('hidden');
            if (typeof window.updateOpenModalsLayout === 'function') {
                window.updateOpenModalsLayout(true);
            }
        }

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

            const statsCover = document.getElementById('stats-video-cover');
            const statsCreatorName = document.getElementById('stats-creator-name');
            const statsCreatorHandle = document.getElementById('stats-creator-handle');
            const statsCaption = document.getElementById('stats-caption');

            if (statsCover) statsCover.src = metadata.cover || '';
            if (statsCreatorName) statsCreatorName.textContent = metadata.author_nickname || 'Creator';
            if (statsCreatorHandle) statsCreatorHandle.textContent = metadata.author_unique_id ? `@${metadata.author_unique_id}` : '@username';
            if (statsCaption) statsCaption.textContent = metadata.title || '—';

            renderDynamicFields();

            const duration = metadata.duration || 0;
            const size = metadata.size || 0;

            const statsDuration = document.getElementById('stats-duration');
            const statsSize = document.getElementById('stats-size');
            if (statsDuration) statsDuration.textContent = duration ? `${duration}s` : '—';
            if (statsSize) statsSize.textContent = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : '—';

            const playCount = metadata.play_count || 0;
            const diggCount = metadata.digg_count || 0;
            const commentCount = metadata.comment_count || 0;
            const shareCount = metadata.share_count || 0;
            const collectCount = metadata.collect_count || 0;

            const statsViews = document.getElementById('stats-views');
            const statsLikes = document.getElementById('stats-likes');
            const statsComments = document.getElementById('stats-comments');
            const statsShares = document.getElementById('stats-shares');
            const statsSaves = document.getElementById('stats-saves');
            const statsEngagement = document.getElementById('stats-engagement');

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

            setButtonState('processing', t('stats_status_analysing_video') || 'Analysing bitstream...');

            const videoMeta = await analyseVideoMetadataFromUrl(streamUrl);

            const statsFps = document.getElementById('stats-fps');
            const statsResolution = document.getElementById('stats-resolution');
            const statsBitrate = document.getElementById('stats-bitrate');

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

            displayMethod(videoMeta && videoMeta.comment ? videoMeta.comment.trim() : '');
            setButtonState('ready', t('tool_stats_btn') || 'Analyse');

        } catch (err) {
            console.error(err);
            const failMsg = err.message || t('stats_err_failed') || 'Analysis failed.';
            setButtonState('error', failMsg);
        } finally {
            isRunning = false;
        }
    }

    const toolDefinition = {
        id: 'tool-tiktok-stats',
        _id: 'tool-tiktok-stats',
        title: 'TikTok Statistics',
        desc: 'Metadata & Stream Analyser',
        version: 'v1.1.4',
        icon: 'query_stats',
        category: ['TikTok', 'Analytics', 'Tools'],
        inputType: 'url',
        hideDropZone: true,
        hideProgress: true,

        initModal: function(ctx) {
            const { optContainer, processBtn, processLabel } = ctx;
            if (!optContainer) return;

            if (processLabel) processLabel.textContent = t('tool_stats_btn') || 'Analyse';

            optContainer.innerHTML = `
                <div id="tiktok-stats-results" class="stats-results-container hidden">
                    <div class="stats-preview-container">
                        <div class="stats-video-cover-wrapper">
                            <img id="stats-video-cover" src="" alt="Cover" class="stats-video-cover">
                        </div>
                        <div class="stats-preview-info">
                            <div id="stats-creator-name" class="stats-creator-name">Creator</div>
                            <div id="stats-creator-handle" class="stats-creator-handle">@username</div>
                            <div id="stats-caption" class="stats-caption">Caption goes here...</div>
                        </div>
                    </div>

                    <div class="stats-details-card">
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">calendar_month</span><span>${t('stats_upload_date')}</span></span>
                            <strong id="stats-upload-date">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">public</span><span>${t('stats_region')}</span></span>
                            <strong id="stats-region">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">security</span><span>${t('stats_shadowban')}</span></span>
                            <div id="stats-shadowban">—</div>
                        </div>

                        <hr class="stats-section-divider">

                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">aspect_ratio</span><span>${t('stats_resolution')}</span></span>
                            <strong id="stats-resolution">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">speed</span><span>${t('stats_fps')}</span></span>
                            <strong id="stats-fps">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">equalizer</span><span>${t('stats_bitrate')}</span></span>
                            <strong id="stats-bitrate">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">schedule</span><span>${t('stats_duration')}</span></span>
                            <strong id="stats-duration">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">save</span><span>${t('stats_size')}</span></span>
                            <strong id="stats-size">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">build</span><span>${t('stats_method')}</span></span>
                            <strong id="stats-method">—</strong>
                        </div>

                        <hr class="stats-section-divider">

                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">visibility</span><span>${t('stats_views')}</span></span>
                            <strong id="stats-views">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">favorite</span><span>${t('stats_likes')}</span></span>
                            <strong id="stats-likes">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">chat_bubble</span><span>${t('stats_comments')}</span></span>
                            <strong id="stats-comments">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">share</span><span>${t('stats_shares')}</span></span>
                            <strong id="stats-shares">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">bookmark</span><span>${t('stats_saves')}</span></span>
                            <strong id="stats-saves">—</strong>
                        </div>
                        <div class="stats-detail-row">
                            <span class="stats-detail-label"><span class="material-symbols-rounded">trending_up</span><span>${t('stats_engagement')}</span></span>
                            <strong id="stats-engagement">—</strong>
                        </div>
                    </div>
                </div>

                <div class="tool-input-group">
                    <label class="tool-input-label" for="tool-tiktok-stats-input">${t('tool_stats_url')}</label>
                    <div class="tool-input-wrapper">
                        <span class="material-symbols-rounded tool-input-icon">link</span>
                        <input type="text" id="tool-tiktok-stats-input" class="tool-input-text" placeholder="https://www.tiktok.com/@username/video/..." autocomplete="off">
                        <button type="button" class="tool-input-clear-btn hidden" id="tool-tiktok-stats-clear" title="Clear">
                            <span class="material-symbols-rounded">close</span>
                        </button>
                    </div>
                </div>
            `;

            const inputUrl = document.getElementById('tool-tiktok-stats-input');
            const clearBtn = document.getElementById('tool-tiktok-stats-clear');

            if (inputUrl && clearBtn) {
                inputUrl.addEventListener('input', () => {
                    if (inputUrl.value.trim().length > 0) {
                        clearBtn.classList.remove('hidden');
                    } else {
                        clearBtn.classList.add('hidden');
                    }
                });

                clearBtn.addEventListener('click', () => {
                    inputUrl.value = '';
                    clearBtn.classList.add('hidden');
                    inputUrl.focus();
                });

                inputUrl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (processBtn) processBtn.click();
                    }
                });
            }
        },

        onProcess: function() {
            const inputUrl = document.getElementById('tool-tiktok-stats-input');
            if (!inputUrl) return;

            let rawInput = inputUrl.value.trim();
            if (!rawInput) {
                showStatus(t('stats_err_enter_url') || 'Please enter a valid TikTok video URL.', "var(--md-sys-color-error)");
                return;
            }

            if (!isTikTokUrl(rawInput)) {
                showStatus(t('stats_err_invalid_url') || 'URL is not a valid TikTok link.', "var(--md-sys-color-error)");
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
        }
    };

    if (window.AppTools && typeof window.AppTools.register === 'function') {
        window.AppTools.register(toolDefinition);
    } else {
        window._pendingTools = window._pendingTools || [];
        window._pendingTools.push(toolDefinition);
    }
})();
