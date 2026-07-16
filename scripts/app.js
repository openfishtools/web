document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const API_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:5000/api' : '/api';
    let globalMuted = false;

    const ensureProtocol = (url) => {
        if (!url || url === '#') return '#';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
        return `https://${url}`;
    };

    const formatIconUrl = (url) => {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('assets/') || url.startsWith('/')) {
            return url;
        }
        if (url.includes('.')) {
            return `https://${url}`;
        }
        return url;
    };

    // Local storage icon cache to prevent overloading Supabase Storage
    const getCachedIcon = (rawUrl) => {
        if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
        const url = formatIconUrl(rawUrl);
        if (url.startsWith('data:') || url.startsWith('assets/') || url.startsWith('blob:')) return url;
        
        const cacheKey = `icon_cache_${url}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) return cached;

        // Fetch cross-origin and cache as base64 in background
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    try {
                        localStorage.setItem(cacheKey, reader.result);
                    } catch (e) {
                        // Handle localStorage full quota limit gracefully
                        console.warn('Storage quota limit reached for icon cache:', e);
                    }
                };
                reader.readAsDataURL(blob);
            })
            .catch(err => console.debug('Icon caching skipped/cors issue:', err));

        return url;
    };

    const thumbUrl = (url, width = 128) => {
        return getCachedIcon(url);
    };

    const isTikTokLikeUrl = (s) => {
        if (!s || typeof s !== 'string') return false;
        const u = s.toLowerCase();
        return u.includes('tiktok.com') || u.includes('tikwm.com');
    };

    const getTikTokId = (url) => {
        if (!url) return null;
        const match = url.match(/\/video\/(\d+)/);
        return match ? match[1] : null;
    };

    const isDirectVideoUrl = (s) => {
        if (!s || typeof s !== 'string') return false;
        return /\.(mp4|webm)(\?|#|$)/i.test(s) || /tiktokcdn\.com\/.+\/video\//i.test(s);
    };

    let lastClickedId = null;
    let lastClickedRect = null;

    /* ═══════════════════════════════════════════════════════
       AM XML INTERACTIVE PREVIEW ENGINE
    ═══════════════════════════════════════════════════════ */

    // Per-slide parsed XML state cache
    const amXmlCache = new Map();
    const AM_XML_CACHE_MAX = 20;

    // Cubic bezier evaluator (ported from AM XML PREVIEW.html)
    const amCubicBezier = (p1x, p1y, p2x, p2y, t) => {
        const bezier = (t, p0, p1, p2, p3) =>
            (1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3;
        let lo = 0, hi = 1, mid;
        for (let i = 0; i < 20; i++) {
            mid = (lo + hi) / 2;
            const x = bezier(mid, 0, p1x, p2x, 1);
            if (Math.abs(x - t) < 0.0001) break;
            if (x < t) lo = mid; else hi = mid;
        }
        return bezier(mid, 0, p1y, p2y, 1);
    };

    const amParseEasing = (eStr) => {
        if (!eStr || !eStr.startsWith('cubicBezier')) return null;
        const parts = eStr.split(/\s+/);
        if (parts.length < 5) return null;
        return [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])];
    };

    const amInterpolateKf = (keyframes, t) => {
        if (!keyframes.length) return '';
        if (keyframes.length === 1) return keyframes[0].value;
        const sorted = [...keyframes].sort((a, b) => a.time - b.time);
        if (t <= sorted[0].time) return sorted[0].value;
        if (t >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
        for (let i = 0; i < sorted.length - 1; i++) {
            const kfA = sorted[i], kfB = sorted[i + 1];
            if (t >= kfA.time && t <= kfB.time) {
                const range = kfB.time - kfA.time;
                let factor = range === 0 ? 0 : (t - kfA.time) / range;
                const easing = amParseEasing(kfB.easing);
                if (easing) factor = amCubicBezier(easing[0], easing[1], easing[2], easing[3], factor);
                const sv = kfA.value.split(',').map(Number);
                const ev = kfB.value.split(',').map(Number);
                if (sv.every(v => !isNaN(v)) && ev.every(v => !isNaN(v)) && sv.length === ev.length)
                    return sv.map((v, idx) => v + (ev[idx] - v) * factor).join(',');
                return factor < 0.5 ? kfA.value : kfB.value;
            }
        }
        return sorted[0].value;
    };

    const amGetLayerTransform = (layer, elapsedMs, allLayers, visited = new Set()) => {
        if (visited.has(layer.id)) return { posX: layer.sceneW / 2, posY: layer.sceneH / 2, scaleX: 1, scaleY: 1, rot: 0 };
        visited.add(layer.id);
        const SCENE_W = layer.sceneW, SCENE_H = layer.sceneH;
        const layerDur = (layer.endTime - layer.startTime) || 1;
        const layerProgress = (elapsedMs - layer.startTime) / layerDur;
        let posX = layer.parentId ? 0 : SCENE_W / 2;
        let posY = layer.parentId ? 0 : SCENE_H / 2;
        let scaleX = 1, scaleY = 1, rot = 0;
        if (layer.keyframes.location.length) {
            const lv = amInterpolateKf(layer.keyframes.location, layerProgress).split(',').map(Number);
            if (lv.length >= 2 && !isNaN(lv[0])) { posX = lv[0]; posY = lv[1]; }
        }
        if (layer.keyframes.scale.length) {
            const sv = amInterpolateKf(layer.keyframes.scale, layerProgress).split(',').map(Number);
            if (!isNaN(sv[0])) { scaleX = sv[0]; scaleY = sv[1] !== undefined && !isNaN(sv[1]) ? sv[1] : sv[0]; }
        }
        if (layer.keyframes.rotation.length) {
            const r = Number(amInterpolateKf(layer.keyframes.rotation, layerProgress));
            if (!isNaN(r)) rot = r;
        }
        // Oscillate effects
        if (layer.oscillates && layer.oscillates.length && elapsedMs >= layer.startTime) {
            const t_sec = (elapsedMs - layer.startTime) / 1000;
            layer.oscillates.forEach(eff => {
                const mag = Number(amInterpolateKf(eff.magKeyframes, layerProgress)) || 0;
                const disp = mag * Math.sin(2 * Math.PI * eff.freq * t_sec);
                const rad = (eff.angle + 90) * Math.PI / 180;
                posX += disp * Math.cos(rad);
                posY += disp * Math.sin(rad);
            });
        }
        if (layer.parentId) {
            const parentLayer = allLayers.find(l => l.id === layer.parentId);
            if (parentLayer) {
                const pt = amGetLayerTransform(parentLayer, elapsedMs, allLayers, visited);
                const rad = pt.rot * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const sx = posX * pt.scaleX, sy = posY * pt.scaleY;
                posX = pt.posX + (sx * cos - sy * sin);
                posY = pt.posY + (sx * sin + sy * cos);
                scaleX *= pt.scaleX; scaleY *= pt.scaleY; rot += pt.rot;
            }
        }
        return { posX, posY, scaleX, scaleY, rot };
    };

    const amSanitizeXmlText = (text) => {
        if (!text || typeof text !== 'string') return '';
        const trimmed = text.trim();
        const head = trimmed.slice(0, 20).toLowerCase();
        if (head.startsWith('<scene') || head.startsWith('<?xml')) return trimmed;
        const sceneMatch = trimmed.match(/<scene[\s>/]/i);
        if (sceneMatch) return trimmed.slice(sceneMatch.index);
        const xmlIdx = trimmed.indexOf('<?xml');
        if (xmlIdx !== -1) return trimmed.slice(xmlIdx);
        return trimmed;
    };

    const parseAmXml = (xmlText) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(amSanitizeXmlText(xmlText), 'text/xml');
        const scene = xmlDoc.documentElement.tagName.toLowerCase() === 'scene'
            ? xmlDoc.documentElement
            : xmlDoc.querySelector('scene');
        if (!scene) throw new Error('Scene not found.');

        const durationMs = Number(scene.getAttribute('totalTime')) || 3000;
        const fps = Number(scene.getAttribute('fps')) || 30;
        const sceneW = Number(scene.getAttribute('width')) || 1080;
        const sceneH = Number(scene.getAttribute('height')) || 1920;
        const title = scene.getAttribute('title') || 'Untitled';

        const beats = [];
        scene.querySelectorAll(':scope > bookmark').forEach(bm => {
            const t = Number(bm.getAttribute('t'));
            if (!isNaN(t)) beats.push(t);
        });

        const CHIP_COLORS = ['#6FBF8B','#5FB0A6','#8FBF6F','#4E9E7A','#79C9A4'];
        const layerNodes = Array.from(scene.children).filter(n =>
            ['audio','shape','embedscene','nullobj'].includes(n.tagName.toLowerCase())
        ).reverse();

        const layers = layerNodes.map((node, idx) => {
            const tag = node.tagName.toLowerCase();
            const id = node.getAttribute('id') || `layer-${idx}`;
            const label = node.getAttribute('label') || node.getAttribute('title') || (tag === 'audio' ? '🎵 Audio' : `${tag} ${id}`);
            const startTime = Number(node.getAttribute('startTime')) || 0;
            const endTime = Number(node.getAttribute('endTime')) || Number(node.getAttribute('outTime')) || durationMs;
            const shapeType = node.getAttribute('s') || '';

            let width = sceneW, height = sceneH;
            const sizeProp = node.querySelector(':scope > property[name="size"]');
            if (sizeProp) {
                const val = sizeProp.getAttribute('value');
                if (val) {
                    const sz = val.split(',').map(Number);
                    const mult = tag === 'shape' ? 2 : 1;
                    if (!isNaN(sz[0]) && sz[0] > 0) width = sz[0] * mult;
                    if (!isNaN(sz[1]) && sz[1] > 0) height = sz[1] * mult;
                }
            } else if (tag === 'audio') { width = sceneW; height = 0; }

            const keyframes = { location: [], scale: [], rotation: [] };
            const transform = node.querySelector(':scope > transform');
            if (transform) {
                ['location','scale','rotation'].forEach(type => {
                    const prop = transform.querySelector(type);
                    if (prop) {
                        const staticVal = prop.getAttribute('value');
                        if (staticVal) {
                            keyframes[type].push({ time: 0, value: staticVal, easing: null });
                            keyframes[type].push({ time: 999999, value: staticVal, easing: null });
                        }
                        prop.querySelectorAll('kf').forEach(kf => {
                            keyframes[type].push({
                                time: Number(kf.getAttribute('t')) || 0,
                                value: kf.getAttribute('v') || '',
                                easing: kf.getAttribute('e') || null
                            });
                        });
                    }
                });
            }

            const parentId = node.getAttribute('parent') || null;
            const oscillates = [];
            Array.from(node.children).forEach(child => {
                if (child.tagName.toLowerCase() === 'effect' && child.getAttribute('id') === 'com.alightcreative.effects.oscillate') {
                    let angle = 0, freq = 1;
                    const magKeyframes = [];
                    const angleProp = Array.from(child.children).find(p => p.tagName.toLowerCase() === 'property' && p.getAttribute('name') === 'angle');
                    if (angleProp) angle = Number(angleProp.getAttribute('value')) || 0;
                    const freqProp = Array.from(child.children).find(p => p.tagName.toLowerCase() === 'property' && p.getAttribute('name') === 'freq');
                    if (freqProp) freq = Number(freqProp.getAttribute('value')) || 0;
                    const magProp = Array.from(child.children).find(p => p.tagName.toLowerCase() === 'property' && p.getAttribute('name') === 'mag');
                    if (magProp) {
                        const val = magProp.getAttribute('value');
                        if (val !== null) {
                            magKeyframes.push({ time: 0, value: val, easing: null });
                            magKeyframes.push({ time: 999999, value: val, easing: null });
                        }
                        magProp.querySelectorAll('kf').forEach(kf => {
                            magKeyframes.push({ time: Number(kf.getAttribute('t')) || 0, value: kf.getAttribute('v') || '', easing: kf.getAttribute('e') || null });
                        });
                    }
                    oscillates.push({ angle, freq, magKeyframes });
                }
            });

            return { id, label, startTime, endTime, type: tag, shapeType, size: { width, height }, color: CHIP_COLORS[idx % CHIP_COLORS.length], keyframes, parentId, oscillates, sceneW, sceneH };
        });

        return { layers, beats, durationMs, fps, sceneW, sceneH, title };
    };

    const amDrawRuler = (canvas, durationMs, pxPerMs = 0.2) => {
        if (!canvas) return;
        const width = durationMs * pxPerMs;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = 22 * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = '22px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, 22);
        ctx.strokeStyle = '#3A4530';
        ctx.fillStyle = '#B6C0A8';
        ctx.font = 'bold 8px "Segoe UI", sans-serif';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, 21.5); ctx.lineTo(width, 21.5); ctx.stroke();
        for (let ms = 0; ms <= durationMs; ms += 100) {
            const x = ms * pxPerMs;
            let th = 3;
            if (ms % 5000 === 0) { th = 13; const s = ms / 1000; ctx.fillText(String(s).padStart(2,'0') + ':00', x + 3, 12); }
            else if (ms % 1000 === 0) th = 8;
            else if (ms % 500 === 0) th = 5;
            ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, 22 - th); ctx.stroke();
        }
    };

    const amFormatTimecode = (ms, fps) => {
        const totalFrames = Math.floor(ms / 1000 * fps);
        const frames = totalFrames % fps;
        const totalSec = Math.floor(ms / 1000);
        const sec = totalSec % 60;
        const min = Math.floor(totalSec / 60) % 60;
        const pad = n => String(n).padStart(2, '0');
        return pad(min) + ':' + pad(sec) + ':' + pad(frames);
    };

    const amResetVideoFrame = (slide) => {
        const container = slide?.querySelector('.post-media-container');
        const video = container?.querySelector('video');
        if (container) container.classList.remove('am-xml-active');
        if (video) {
            video.style.clipPath = '';
            video.style.transition = '';
            video.style.top = '';
            video.style.left = '';
            video.style.width = '';
            video.style.height = '';
            video.style.borderRadius = '';
        }
    };

    const amApplyVideoFrame = (slide, animate = false) => {
        const container = slide?.querySelector('.post-media-container');
        const canvas = slide?.querySelector('.am-xml-canvas');
        const video = container?.querySelector('video');
        if (!container || !canvas || !video) return;

        const overlay = slide.querySelector('.am-xml-overlay');
        const wasEntering = overlay?.classList.contains('entering');
        const wasExitingDown = overlay?.classList.contains('exiting-down');
        const wasExitingUp = overlay?.classList.contains('exiting-up');

        // Temporarily remove classes that alter canvas size to measure target position
        if (overlay) {
            overlay.classList.remove('entering', 'exiting-down', 'exiting-up');
        }

        container.classList.add('am-xml-active');
        const cRect = container.getBoundingClientRect();
        const kRect = canvas.getBoundingClientRect();

        // Restore classes
        if (overlay) {
            if (wasEntering) overlay.classList.add('entering');
            if (wasExitingDown) overlay.classList.add('exiting-down');
            if (wasExitingUp) overlay.classList.add('exiting-up');
        }

        const top = Math.max(0, kRect.top - cRect.top);
        const left = Math.max(0, kRect.left - cRect.left);
        const radius = 12;

        video.style.transition = animate ? 'top 0.55s cubic-bezier(0.22, 1, 0.36, 1), left 0.55s cubic-bezier(0.22, 1, 0.36, 1), width 0.55s cubic-bezier(0.22, 1, 0.36, 1), height 0.55s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.55s cubic-bezier(0.22, 1, 0.36, 1)' : '';
        video.style.position = 'absolute';
        video.style.top = `${top}px`;
        video.style.left = `${left}px`;
        video.style.width = `${kRect.width}px`;
        video.style.height = `${kRect.height}px`;
        video.style.borderRadius = `${radius}px`;
        video.style.clipPath = '';
    };

    // Build the entire AM XML overlay DOM inside a slide
    const buildAmXmlOverlay = (slide, parsed) => {
        const { layers, beats, durationMs, fps, sceneW, sceneH, title } = parsed;
        const PX_PER_MS = 0.2;

        const overlay = slide.querySelector('.am-xml-overlay');
        if (!overlay) return;

        overlay.innerHTML = `
        <div class="am-xml-topbar">
            <span class="am-xml-title">${title || slide.dataset.name || 'Preview'}</span>
        </div>
        <div class="am-xml-editor">
        <div class="am-xml-preview-area">
            <div class="am-xml-canvas" id="am-canvas-${slide.dataset.id}"></div>
        </div>
        <div class="am-xml-transport">
            <button class="am-xml-icon-btn am-xml-prev-btn" aria-label="Previous">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM20 6L10 12l10 6V6z"/></svg>
            </button>
            <button class="am-xml-icon-btn am-xml-play-btn" aria-label="Play">
                <svg class="am-xml-icon-play" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <svg class="am-xml-icon-pause" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
            </button>
            <button class="am-xml-icon-btn am-xml-next-btn" aria-label="Next">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM4 6l10 6-10 6V6z"/></svg>
            </button>
        </div>
        <div class="am-xml-timeline">
            <div class="am-xml-timeline-body">
                <div class="am-xml-rail">
                    <div class="am-xml-rail-spacer"></div>
                </div>
                <div class="am-xml-track-viewport">
                    <div class="am-xml-playhead">
                        <div class="am-xml-timecode">00:00:00</div>
                    </div>
                    <div class="am-xml-ruler-strip">
                        <canvas class="am-xml-ruler-canvas"></canvas>
                    </div>
                    <div class="am-xml-scroll-area">
                        <div class="am-xml-track-content"></div>
                    </div>
                </div>
            </div>
        </div>
        </div>`;

        // ── Wiring ──────────────────────────────────
        const previewCanvas = overlay.querySelector('.am-xml-canvas');
        const railEl = overlay.querySelector('.am-xml-rail');
        const trackViewport = overlay.querySelector('.am-xml-track-viewport');
        const scrollArea = overlay.querySelector('.am-xml-scroll-area');
        const trackContent = overlay.querySelector('.am-xml-track-content');
        const rulerCanvas = overlay.querySelector('.am-xml-ruler-canvas');
        const rulerStrip = overlay.querySelector('.am-xml-ruler-strip');
        const playhead = overlay.querySelector('.am-xml-playhead');
        const timecodeEl = overlay.querySelector('.am-xml-timecode');
        const playBtn = overlay.querySelector('.am-xml-play-btn');
        const prevBtn = overlay.querySelector('.am-xml-prev-btn');
        const nextBtn = overlay.querySelector('.am-xml-next-btn');
        const iconPlay = overlay.querySelector('.am-xml-icon-play');
        const iconPause = overlay.querySelector('.am-xml-icon-pause');

        const totalWidth = durationMs * PX_PER_MS;
        trackContent.style.width = `${totalWidth}px`;
        if (rulerStrip) rulerStrip.style.width = `${totalWidth}px`;

        // Draw ruler
        amDrawRuler(rulerCanvas, durationMs, PX_PER_MS);

        // Beat marks
        beats.forEach(beat => {
            const bm = document.createElement('div');
            bm.className = 'am-xml-beat-mark';
            bm.style.left = `${beat * PX_PER_MS}px`;
            trackContent.appendChild(bm);
        });

        // Layer rows (rail + chips)
        layers.forEach(layer => {
            const railRow = document.createElement('div');
            railRow.className = 'am-xml-rail-row';
            const isAudio = layer.type === 'audio';
            railRow.innerHTML = isAudio
                ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="opacity:.4"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>`
                : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>`;
            railEl.appendChild(railRow);

            const chipW = (layer.endTime - layer.startTime) * PX_PER_MS;
            const chipL = layer.startTime * PX_PER_MS;
            const row = document.createElement('div');
            row.className = 'am-xml-chip-row';
            row.dataset.id = layer.id;
            const chip = document.createElement('div');
            chip.className = 'am-xml-layer-chip' + (isAudio ? ' audio-chip' : '');
            chip.style.width = `${chipW}px`;
            chip.style.marginLeft = `${chipL}px`;
            if (!isAudio) chip.style.background = layer.color;
            chip.textContent = layer.label;

            // Render keyframe diamonds inside the chip
            if (layer.keyframes) {
                const uniqueKfTimes = new Set();
                ['location', 'scale', 'rotation'].forEach(type => {
                    const list = layer.keyframes[type] || [];
                    // Skip if it only contains the static default full-duration keyframes
                    if (list.length === 2 && list[1].time === 999999) return;

                    list.forEach(kf => {
                        if (kf.time === 999999) return;
                        // kf.time is a progress value between 0 and 1
                        if (kf.time >= 0 && kf.time <= 1) {
                            uniqueKfTimes.add(kf.time);
                        }
                    });
                });

                uniqueKfTimes.forEach(time => {
                    const kfLeft = time * chipW;
                    const kfIcon = document.createElement('div');
                    kfIcon.className = 'am-xml-kf-icon';
                    kfIcon.style.left = `${kfLeft}px`;
                    chip.appendChild(kfIcon);
                });
            }

            row.appendChild(chip);
            trackContent.appendChild(row);
        });

        // Wireframe elements in canvas
        layers.forEach((layer, idx) => {
            if (layer.type === 'audio' || layer.type === 'nullobj') return;
            const div = document.createElement('div');
            div.className = 'am-xml-wireframe';
            div.id = `am-wf-${slide.dataset.id}-${layer.id}`;
            div.style.color = layer.color;
            div.style.display = 'none';
            div.style.position = 'absolute';
            div.style.zIndex = layers.length - idx;
            const lowerShape = layer.shapeType.toLowerCase();
            const isCircle = lowerShape.includes('circle') || lowerShape.includes('oval') || lowerShape.includes('ellipse');
            const isEmbed = layer.type === 'embedscene';
            let outlineHtml = '';
            if (isCircle) {
                outlineHtml = `<svg class="am-xml-oval-outline" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="49" ry="49" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
            } else if (isEmbed) {
                outlineHtml = `<div class="am-xml-embed-outline"></div>`;
            } else {
                outlineHtml = `<div class="am-xml-rect-outline"></div>`;
            }

            const handlesHtml = `
                <div class="am-xml-handle handle-tl"></div>
                <div class="am-xml-handle handle-tc"></div>
                <div class="am-xml-handle handle-tr"></div>
                <div class="am-xml-handle handle-rc"></div>
                <div class="am-xml-handle handle-br"></div>
                <div class="am-xml-handle handle-bc"></div>
                <div class="am-xml-handle handle-bl"></div>
                <div class="am-xml-handle handle-lc"></div>
            `;
            div.innerHTML = outlineHtml + handlesHtml;
            previewCanvas.appendChild(div);
        });

        // ── Playhead x position ──
        const getPlayheadX = () => {
            const vpRect = trackViewport.getBoundingClientRect();
            const oRect = overlay.getBoundingClientRect();
            return (oRect.left + oRect.width / 2) - vpRect.left;
        };

        // ── Render frame ──
        const amRender = (elapsedMs) => {
            const playheadX = getPlayheadX();
            if (playhead) playhead.style.left = `${playheadX}px`;
            const shift = playheadX - (elapsedMs * PX_PER_MS);
            trackContent.style.transform = `translateX(${shift}px)`;
            if (rulerStrip) rulerStrip.style.transform = `translateX(${shift}px)`;
            timecodeEl.textContent = amFormatTimecode(elapsedMs, fps);

            const isOnBeat = beats.some(b => Math.abs(elapsedMs - b) < 25);
            playhead.classList.toggle('at-beat', isOnBeat);
            timecodeEl.classList.toggle('at-beat', isOnBeat);

            layers.forEach(layer => {
                if (layer.type === 'audio' || layer.type === 'nullobj') return;
                const wf = document.getElementById(`am-wf-${slide.dataset.id}-${layer.id}`);
                if (!wf) return;
                if (elapsedMs >= layer.startTime && elapsedMs <= layer.endTime) {
                    wf.style.display = 'flex';
                    const t = amGetLayerTransform(layer, elapsedMs, layers);
                    const pctX = (t.posX / sceneW) * 100;
                    const pctY = (t.posY / sceneH) * 100;
                    const sizeW = ((layer.size.width * Math.abs(t.scaleX)) / sceneW) * 100;
                    const sizeH = ((layer.size.height * Math.abs(t.scaleY)) / sceneH) * 100;
                    wf.style.width = `${sizeW}%`;
                    wf.style.height = `${sizeH}%`;
                    wf.style.left = `${pctX}%`;
                    wf.style.top = `${pctY}%`;
                    const fx = t.scaleX < 0 ? -1 : 1, fy = t.scaleY < 0 ? -1 : 1;
                    wf.style.transform = `translate(-50%,-50%) scale(${fx},${fy}) rotate(${t.rot}deg)`;
                } else {
                    wf.style.display = 'none';
                }
            });
        };

        // ── State ──
        let xmlPlaying = false;
        let xmlScrubbing = false;
        let scrubStartX = 0, scrubStartY = 0, scrubStartElapsed = 0, scrubStartScrollTop = 0;

        const setPlayIcons = (playing) => {
            iconPlay.style.display = playing ? 'none' : '';
            iconPause.style.display = playing ? '' : 'none';
        };

        // ── Sync loop with video ──
        const video = slide.querySelector('video') || slide.querySelector('.tiktok-media-host video');
        let lastVideoTime = -1;
        let syncRafId = null;

        const syncLoop = () => {
            if (!video) return;
            let vtMs = video.currentTime * 1000;
            if (vtMs >= durationMs || video.ended) {
                video.currentTime = 0;
                vtMs = 0;
            }
            // Detect loop: video.currentTime reset to near 0 from something > 0
            if (lastVideoTime > 200 && vtMs < 50) {
                // looped
            }
            lastVideoTime = vtMs;
            const elapsed = vtMs % (durationMs || 1);
            amRender(elapsed);
            xmlPlaying = !video.paused;
            setPlayIcons(xmlPlaying);
            syncRafId = requestAnimationFrame(syncLoop);
        };

        const startSync = () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            syncLoop();
        };

        const stopSync = () => {
            if (syncRafId) cancelAnimationFrame(syncRafId);
            syncRafId = null;
        };

        overlay._startSync = startSync;
        overlay._stopSync = stopSync;
        overlay._amRender = amRender;
        overlay._scrollArea = scrollArea;
        overlay._video = video;

        // ── Play / Pause buttons ──
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!video) return;
            if (video.paused) {
                video.play().catch(() => {});
                startSync();
            } else {
                video.pause();
                // keep sync running at 1 frame so UI stays updated
            }
        });

        // Prev / Next beat buttons
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!video) return;
            const cur = video.currentTime * 1000;
            const prevBeats = beats.filter(b => b < cur - 5);
            const target = prevBeats.length ? prevBeats[prevBeats.length - 1] : 0;
            video.currentTime = target / 1000;
            amRender(target);
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!video) return;
            const cur = video.currentTime * 1000;
            const nextBeats = beats.filter(b => b > cur + 5);
            const target = nextBeats.length ? nextBeats[0] : durationMs;
            video.currentTime = target / 1000;
            amRender(target);
        });

        const frameObserver = new ResizeObserver(() => {
            if (overlay.dataset.shown === 'true' && !overlay.classList.contains('entering')) {
                amApplyVideoFrame(slide, false);
            }
        });
        frameObserver.observe(overlay);
        overlay._frameObserver = frameObserver;

        // ── Scrubbing ──
        trackViewport.addEventListener('pointerdown', (e) => {
            if (!video) return;
            if (!video.paused) {
                video.pause();
            }
            xmlScrubbing = true;
            scrubStartX = e.clientX;
            scrubStartY = e.clientY;
            scrubStartElapsed = video.currentTime * 1000;
            scrubStartScrollTop = scrollArea ? scrollArea.scrollTop : 0;
            trackViewport.setPointerCapture(e.pointerId);
            e.stopPropagation();
        });

        trackViewport.addEventListener('pointermove', (e) => {
            if (!xmlScrubbing) return;
            e.preventDefault();
            e.stopPropagation();
            const deltaX = e.clientX - scrubStartX;
            let newElapsed = scrubStartElapsed - (deltaX / PX_PER_MS);
            newElapsed = Math.min(Math.max(newElapsed, 0), durationMs);
            if (video) video.currentTime = newElapsed / 1000;
            amRender(newElapsed);
            // vertical scroll of layers
            if (scrollArea) {
                const dy = e.clientY - scrubStartY;
                scrollArea.scrollTop = scrubStartScrollTop - dy;
                railEl.scrollTop = scrollArea.scrollTop;
            }
        });

        trackViewport.addEventListener('pointerup', (e) => {
            if (!xmlScrubbing) return;
            xmlScrubbing = false;
            try { trackViewport.releasePointerCapture(e.pointerId); } catch (_) {}
        });

        trackViewport.addEventListener('pointercancel', () => { xmlScrubbing = false; });

        // Sync rail scroll with scroll area
        scrollArea.addEventListener('scroll', () => {
            railEl.scrollTop = scrollArea.scrollTop;
        }, { passive: true });

        // ── Scroll behavior: in-frame area ──
        const feed = slide.closest('.tiktok-feed');
        const editorEl = overlay.querySelector('.am-xml-editor');

        const navigateSlide = (direction) => {
            stopSync();
            const exitClass = direction === 'down' ? 'exiting-down' : 'exiting-up';
            overlay.classList.remove('visible','entering');
            overlay.classList.add(exitClass);
            const exitVideo = slide.querySelector('.post-media-container video');
            if (exitVideo) {
                exitVideo.style.transition = 'top 0.2s cubic-bezier(0.4, 0, 1, 1), left 0.2s cubic-bezier(0.4, 0, 1, 1), width 0.2s cubic-bezier(0.4, 0, 1, 1), height 0.2s cubic-bezier(0.4, 0, 1, 1), border-radius 0.2s cubic-bezier(0.4, 0, 1, 1)';
                exitVideo.style.top = '0px';
                exitVideo.style.left = '0px';
                exitVideo.style.width = '100%';
                exitVideo.style.height = '100%';
                exitVideo.style.borderRadius = '0px';
            }
            setTimeout(() => {
                overlay.classList.remove(exitClass);
                overlay.dataset.shown = '';
                amResetVideoFrame(slide);
                if (feed) {
                    const slides = Array.from(feed.querySelectorAll('.tiktok-slide'));
                    const currentIndex = slides.indexOf(slide);
                    if (currentIndex !== -1) {
                        const targetIndex = direction === 'down' ? currentIndex + 1 : currentIndex - 1;
                        if (targetIndex >= 0 && targetIndex < slides.length) {
                            slides[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                }
            }, 200);
        };

        // Stop propagation of wheel and touch inside scroll area
        scrollArea.addEventListener('wheel', (e) => {
            e.stopPropagation();
        }, { passive: true });
        scrollArea.addEventListener('touchmove', (e) => {
            e.stopPropagation();
        }, { passive: true });

        // Start sync immediately if video is already playing
        if (video && !video.paused) startSync();
        else if (video) {
            const onPlay = () => startSync();
            video.addEventListener('play', onPlay);
            video.addEventListener('pause', () => setPlayIcons(false));
        }
    };

    // Trigger XML overlay: fetch → parse → build → animate in
    const triggerAmXmlPreview = async (slide) => {
        const xmlUrl = slide.dataset.amXmlUrl;
        if (!xmlUrl) return;
        const id = slide.dataset.id;
        const overlay = slide.querySelector('.am-xml-overlay');
        if (!overlay) return;
        if (overlay.dataset.shown === 'true') return; // already shown

        // Show loading badge
        const badge = slide.querySelector('.am-xml-loading-badge');
        if (badge) badge.classList.add('show');

        let parsed = amXmlCache.get(id);
        if (!parsed) {
            try {
                const proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(xmlUrl)}`;
                const resp = await fetch(proxyUrl);
                if (!resp.ok) throw new Error('fetch failed');
                const text = await resp.text();
                parsed = parseAmXml(text);
                if (amXmlCache.size >= AM_XML_CACHE_MAX) {
                    const firstKey = amXmlCache.keys().next().value;
                    amXmlCache.delete(firstKey);
                }
                amXmlCache.set(id, parsed);
            } catch (err) {
                console.warn('[AM XML] Failed to load XML:', err);
                if (badge) {
                    badge.querySelector('span:last-child').textContent = 'Skipping XML Preview';
                    const spin = badge.querySelector('.spin');
                    if (spin) { spin.textContent = 'warning'; spin.classList.remove('spin'); }
                    badge.classList.add('show', 'badge-warn');
                    setTimeout(() => badge.classList.remove('show', 'badge-warn'), 3000);
                }
                return;
            }
        }

        if (badge) badge.classList.remove('show');

        // Build DOM if not yet built
        if (!overlay.dataset.built) {
            buildAmXmlOverlay(slide, parsed);
            overlay.dataset.built = 'true';
        }

        const mediaContainer = slide.querySelector('.post-media-container');
        const video = mediaContainer?.querySelector('video');
        if (mediaContainer) mediaContainer.classList.add('am-xml-active');
        if (video) {
            video.style.transition = '';
            video.style.position = 'absolute';
            video.style.top = '0px';
            video.style.left = '0px';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.borderRadius = '0px';
            video.style.clipPath = '';
        }

        overlay.dataset.shown = 'true';
        overlay.classList.remove('exiting-down','exiting-up');
        overlay.classList.add('visible','entering');
        void overlay.offsetWidth;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.remove('entering');
                amApplyVideoFrame(slide, true);
            });
        });

        setTimeout(() => {
            amApplyVideoFrame(slide, false);
        }, 600);

        if (overlay._startSync) overlay._startSync();
    };

    /* END AM XML ENGINE */

    const showExplore = () => {
        amXmlCache.clear();
        const presetFeedView = document.getElementById('preset-feed-view');
        if (presetFeedView) {
            presetFeedView.querySelectorAll('.tiktok-slide').forEach(slide => {
                resetAmXmlSlide(slide);
                unloadSlideVideo(slide);
            });
            presetFeedView.querySelectorAll('.tiktok-media-host').forEach(host => {
                const v = host.querySelector('video');
                if (v) {
                    v.pause();
                    v.src = '';
                    try { v.load(); } catch(e){}
                }
                const iframe = host.querySelector('iframe');
                if (iframe) iframe.src = '';
                host.innerHTML = '<div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div>';
                delete host.dataset.tiktokState;
            });
            const feedContainer = document.getElementById('preset-feed');
            if (feedContainer && feedContainer._scrollVideoIo) {
                feedContainer._scrollVideoIo.disconnect();
                feedContainer._scrollVideoIo = null;
            }
        }

        const presetExploreView = document.getElementById('preset-explore-view');
        
        history.pushState(null, null, '/#preset');

        if (presetFeedView && !presetFeedView.classList.contains('hidden')) {
            presetFeedView.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 1, 1), opacity 0.12s ease';
            presetFeedView.style.transform = 'translateY(6%)';
            presetFeedView.style.opacity = '0';

            if (presetExploreView) {
                presetExploreView.classList.remove('hidden');
                presetExploreView.style.opacity = '0';
                presetExploreView.style.transition = 'opacity 0.1s ease';
                requestAnimationFrame(() => {
                    presetExploreView.style.opacity = '1';
                });
            }

            setTimeout(() => {
                presetFeedView.classList.add('hidden');
                presetFeedView.style.transform = '';
                presetFeedView.style.transition = '';
                presetFeedView.style.opacity = '';
            }, 150);
        } else {
            if (presetFeedView) {
                presetFeedView.classList.add('hidden');
                presetFeedView.style.opacity = '0';
            }
            if (presetExploreView) {
                presetExploreView.classList.remove('hidden');
                presetExploreView.style.opacity = '1';
            }
        }
    };

    const showFeed = async (targetId, clickedEl = null) => {
        const exploreView = document.getElementById('preset-explore-view');
        const feedView = document.getElementById('preset-feed-view');
        const feedContainer = document.getElementById('preset-feed');

        if (!feedView || !feedContainer) return;

        history.pushState(null, null, `/${targetId}`);

        lastClickedId = targetId;
        lastClickedRect = clickedEl ? clickedEl.getBoundingClientRect() : null;

        // Reset transition styles
        feedView.style.transition = 'none';
        feedView.style.transform = 'translateY(6%)';
        feedView.style.opacity = '0';
        feedView.style.display = 'block';
        feedView.classList.remove('hidden');

        if (exploreView) {
            exploreView.style.transition = 'opacity 0.15s ease';
            exploreView.style.opacity = '0';
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                feedView.style.transition = 'transform 0.15s cubic-bezier(0, 0, 0.2, 1), opacity 0.12s ease';
                feedView.style.transform = 'translateY(0)';
                feedView.style.opacity = '1';
            });
        });

        setTimeout(() => {
            if (exploreView) exploreView.classList.add('hidden');
            feedView.style.transform = '';
            feedView.style.transition = '';
            feedView.style.opacity = '';
        }, 150);

        if (feedContainer) {
            hydrateTikTokHosts(feedContainer, 'video');
            setupTikTokInteractions(feedContainer);
            updateScrollingTitles(feedContainer);
        }

        const targetPost = document.querySelector(`.preset-post[data-id="${targetId}"]`);
        if (targetPost) {
            targetPost.scrollIntoView({ behavior: 'auto', block: 'start' });
            const video = targetPost.querySelector('video') || targetPost.querySelector('.tiktok-media-host video');
            if (video) {
                video.muted = globalMuted;
                const onPlay = () => {
                    if (targetPost.dataset.amXmlUrl) triggerAmXmlPreview(targetPost);
                    video.removeEventListener('playing', onPlay);
                };
                video.addEventListener('playing', onPlay);
                video.play().catch((err) => {
                    console.warn('Autoplay blocked in showFeed, retrying muted:', err);
                    video.muted = true;
                    video.play().catch(e => console.error('Final play attempt failed:', e));
                });
                if (video.readyState >= 2 && !video.paused && targetPost.dataset.amXmlUrl) {
                    triggerAmXmlPreview(targetPost);
                }
            } else if (targetPost.dataset.amXmlUrl) {
                let checkAttempts = 0;
                const checkInterval = setInterval(() => {
                    checkAttempts++;
                    const loadedVideo = targetPost.querySelector('video');
                    if (loadedVideo) {
                        clearInterval(checkInterval);
                        if (!loadedVideo.paused) {
                            triggerAmXmlPreview(targetPost);
                        } else {
                            loadedVideo.addEventListener('playing', () => triggerAmXmlPreview(targetPost), { once: true });
                        }
                    }
                    if (checkAttempts > 30) clearInterval(checkInterval);
                }, 100);
            }
        }
    };
    
    const setupTikTokInteractions = (root) => {
        const containers = root.querySelectorAll('.post-media-container');
        containers.forEach(container => {
            if (container.dataset.interactionsSet) return;
            container.dataset.interactionsSet = 'true';

            // Check if this slide has AM XML — if so, skip native tap handling
            const slide = container.closest('.tiktok-slide');
            const hasAmXml = !!(slide && slide.dataset.amXmlUrl);
            
            const muteBtn = container.querySelector('.video-mute-btn');
            if (muteBtn) {
                muteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const video = container.querySelector('video') || container.querySelector('.tiktok-media-host video');
                    if (video) {
                        video.muted = !video.muted;
                        globalMuted = video.muted;
                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                        if (icon) icon.textContent = video.muted ? 'volume_off' : 'volume_up';
                    }
                });
            }

            // For AM XML slides: single tap does nothing (pause handled in XML UI)
            // double tap does nothing (like disabled while XML preview is active)
            if (hasAmXml) return;

            let lastTap = 0;
            let tapTimeout;
            
            container.addEventListener('click', (e) => {
                const now = Date.now();
                const DOUBLE_TAP_DELAY = 300;
                
                if (now - lastTap < DOUBLE_TAP_DELAY) {
                    // Double Tap
                    clearTimeout(tapTimeout);
                    handleDoubleTap(container, e);
                    lastTap = 0;
                } else {
                    // Single Tap potential
                    lastTap = now;
                    tapTimeout = setTimeout(() => {
                        handleSingleTap(container);
                    }, DOUBLE_TAP_DELAY);
                }
            });
        });
    };

    const handleSingleTap = (container) => {
        const video = container.querySelector('video') || container.querySelector('.tiktok-media-host video');
        const pauseIcon = container.querySelector('.overlay-pause');
        
        if (!video) return;
        
        if (video.paused) {
            video.play();
            if (pauseIcon) {
                pauseIcon.textContent = 'play_arrow';
                pauseIcon.classList.remove('animate-pause');
                requestAnimationFrame(() => pauseIcon.classList.add('animate-pause'));
            }
        } else {
            video.pause();
            if (pauseIcon) {
                pauseIcon.textContent = 'pause';
                pauseIcon.classList.remove('animate-pause');
                requestAnimationFrame(() => pauseIcon.classList.add('animate-pause'));
            }
        }
    };

    const handleDoubleTap = (container, e) => {
        const slide = container.closest('.tiktok-slide');
        const id = slide?.dataset.id;
        const likeBtn = slide?.querySelector('[data-action="like"]');
        
        // Show heart animation
        const heart = document.createElement('span');
        heart.className = 'material-symbols-rounded overlay-heart animate-heart';
        heart.textContent = 'favorite';
        
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        heart.style.left = `${x - 40}px`;
        heart.style.top = `${y - 40}px`;

        if (likeBtn) {
            const btnRect = likeBtn.getBoundingClientRect();
            const targetX = btnRect.left - rect.left + btnRect.width / 2;
            const targetY = btnRect.top - rect.top + btnRect.height / 2;
            
            const flyX = targetX - x;
            const flyY = targetY - y;
            
            heart.style.setProperty('--fly-x', `${flyX}px`);
            heart.style.setProperty('--fly-y', `${flyY}px`);
        }
        
        container.appendChild(heart);
        setTimeout(() => heart.remove(), 800);
        
        if (id && likeBtn) {
            handleLike(id, likeBtn, true); // true = onlyLike
        }
    };

    const updateScrollingTitles = (root) => {
        if (!root) return;
        setTimeout(() => {
            const titles = root.querySelectorAll('.tiktok-title');
            const tags = root.querySelectorAll('.plugin-tag-v2');
            requestAnimationFrame(() => {
                titles.forEach(title => {
                    const wrapper = title.parentElement;
                    if (!wrapper) return;
                    title.classList.remove('scroll');
                    if (title.scrollWidth > wrapper.clientWidth + 1) {
                        const dist = (title.scrollWidth - wrapper.clientWidth) + 30;
                        title.style.setProperty('--scroll-dist', `${dist}px`);
                        title.classList.add('scroll');
                    }
                });
                tags.forEach(tag => {
                    const wrapper = tag.parentElement;
                    if (!wrapper) return;
                    tag.classList.remove('scroll');
                    if (tag.scrollWidth > wrapper.clientWidth + 1) {
                        const dist = (tag.scrollWidth - wrapper.clientWidth) + 30;
                        tag.style.setProperty('--scroll-dist', `${dist}px`);
                        tag.classList.add('scroll');
                    }
                });
            });
        }, 500);
    };

    const escapeHtmlAttr = (s) => String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');

    const normalizeClientIp = (raw) => {
        if (raw == null) return '';
        let ip = String(raw).trim();
        if (!ip) return '';
        const lower = ip.toLowerCase();
        if (lower.startsWith('::ffff:')) ip = ip.slice(7);
        if (lower === '::1' || ip === '::1') ip = '127.0.0.1';
        return ip;
    };

    const presetMediaInnerHtml = (media, name) => {
        const label = escapeHtmlAttr(name || 'Preset');
        const m = media == null ? '' : String(media).trim();
        if (!m) {
            return '<div class="media-placeholder" aria-hidden="true"></div>';
        }
        if (isDirectVideoUrl(m)) {
            // Remove controls, keep autoplay and loop
            return `<video src="${escapeHtmlAttr(m)}" muted loop playsinline autoplay crossorigin="anonymous" referrerpolicy="no-referrer"></video>`;
        }
        if (isTikTokLikeUrl(m)) {
            return `<div class="tiktok-media-host" data-tiktok-url="${escapeHtmlAttr(m)}" role="group" aria-label="${label}"><div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div></div>`;
        }
        return `<img src="${escapeHtmlAttr(m)}" alt="${label}" referrerpolicy="no-referrer">`;
    };

    const hydrateTikTokHosts = async (root, mode = 'video') => {
        if (!root || !('IntersectionObserver' in window)) return;
        const hosts = root.querySelectorAll('.tiktok-media-host:not([data-tiktok-state])');
        if (!hosts.length) return;

        if (root._hydrateIo) {
            root._hydrateIo.disconnect();
            root._hydrateIo = null;
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach(async (en) => {
                const el = en.target;
                if (!en.isIntersecting || el.dataset.tiktokState) return;
                
                const src = el.dataset.tiktokUrl;
                if (!src) return;
                
                 el.dataset.tiktokState = 'loading';
                
                const resolveWithRetry = async (retryCount = 0, bypassCache = false) => {
                    try {
                        const url = `${API_URL}/tiktok-resolve?url=${encodeURIComponent(src)}${bypassCache ? '&nocache=1' : ''}`;
                        const r = await fetch(url);
                        if (r.status === 404 && retryCount < 3) {
                            await new Promise(res => setTimeout(res, 1000));
                            return resolveWithRetry(retryCount + 1);
                        }
                        
                        const j = await r.json().catch(() => ({}));
                        
                        if (!r.ok || (!j.play && !j.is_fallback)) {
                            el.dataset.tiktokState = 'error';
                            el.innerHTML = '<div class="tiktok-media-error"><span class="material-symbols-rounded">broken_image</span><span>Video unavailable</span></div>';
                        } else {
                            el.innerHTML = '';
                            if ((mode === 'image' || j.is_fallback) && j.cover) {
                                const img = document.createElement('img');
                                img.src = j.cover;
                                img.alt = j.title || 'Preset';
                                img.setAttribute('referrerpolicy', 'no-referrer');
                                el.appendChild(img);
                                if (mode === 'video') {
                                    const videoId = j.id || getTikTokId(src);
                                    if (videoId) {
                                        el.innerHTML = `<iframe src="https://www.tiktok.com/embed/${videoId}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
                                    } else {
                                        const link = document.createElement('a');
                                        link.href = src;
                                        link.target = '_blank';
                                        link.className = 'tiktok-fallback-link';
                                        link.innerHTML = '<span class="material-symbols-rounded">open_in_new</span><span>View on TikTok</span>';
                                        el.appendChild(link);
                                    }
                                }
                            } else {
                                const v = document.createElement('video');
                                v.src = j.play;
                                v.muted = globalMuted;
                                v.loop = true;
                                v.playsInline = true;
                                v.autoplay = true;
                                v.setAttribute('playsinline', '');
                                v.setAttribute('crossorigin', 'anonymous');
                                v.setAttribute('referrerpolicy', 'no-referrer');
                                if (!globalMuted) v.volume = 1;
                                el.appendChild(v);
 
                                const slide = el.closest('.tiktok-slide');
                                const muteBtn = slide?.querySelector('.video-mute-btn');
                                if (muteBtn) {
                                    const icon = muteBtn.querySelector('.material-symbols-rounded');
                                    if (icon) icon.textContent = v.muted ? 'volume_off' : 'volume_up';
                                }

                                if (slide && slide.dataset.amXmlUrl) {
                                    const onPlay = () => {
                                        triggerAmXmlPreview(slide);
                                        v.removeEventListener('playing', onPlay);
                                    };
                                    v.addEventListener('playing', onPlay);
                                    if (!v.paused) {
                                        triggerAmXmlPreview(slide);
                                    }
                                }

                                v.onerror = () => {
                                    if (retryCount < 1) {
                                        el.innerHTML = '';
                                        el.dataset.tiktokState = 'loading';
                                        resolveWithRetry(retryCount + 1, true);
                                    } else {
                                        const videoId = j.id || getTikTokId(src);
                                        if (videoId) {
                                            el.innerHTML = `<iframe src="https://www.tiktok.com/embed/${videoId}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="no-referrer"></iframe>`;
                                            el.dataset.tiktokState = 'ready';
                                        } else if (j.cover) {
                                            el.innerHTML = '';
                                            const img = document.createElement('img');
                                            img.src = j.cover;
                                            img.alt = j.title || 'Preset';
                                            img.setAttribute('referrerpolicy', 'no-referrer');
                                            el.appendChild(img);
                                            el.dataset.tiktokState = 'ready';
                                        } else {
                                            el.innerHTML = '<div class="tiktok-media-error"><span class="material-symbols-rounded">broken_image</span><span>Video unavailable</span></div>';
                                            el.dataset.tiktokState = 'error';
                                        }
                                    }
                                };
 
                                v.play().catch((err) => {
                                    v.muted = true;
                                    if (muteBtn) {
                                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                                        if (icon) icon.textContent = 'volume_off';
                                    }
                                    v.play().catch(e => {});
                                });
                            }
                            el.dataset.tiktokState = 'ready';
                        }
                    } catch (err) {
                        if (retryCount < 3) {
                            await new Promise(res => setTimeout(res, 1000));
                            return resolveWithRetry(retryCount + 1);
                        }
                        el.dataset.tiktokState = 'error';
                    }
                };

                await resolveWithRetry();
                io.unobserve(el);
            });
        }, { threshold: 0.1 });

        hosts.forEach(h => io.observe(h));
        root._hydrateIo = io;
    };

    const disconnectScrollVideoIo = (attachEl) => {
        if (attachEl && attachEl._scrollVideoIo) {
            attachEl._scrollVideoIo.disconnect();
            attachEl._scrollVideoIo = null;
        }
    };

    const resetAmXmlSlide = (slide) => {
        if (!slide) return;
        const overlay = slide.querySelector('.am-xml-overlay');
        if (overlay) {
            if (typeof overlay._stopSync === 'function') overlay._stopSync();
            if (overlay._frameObserver) {
                try { overlay._frameObserver.disconnect(); } catch (_) {}
                overlay._frameObserver = null;
            }
            overlay.classList.remove('visible', 'entering', 'exiting-up', 'exiting-down');
            overlay.dataset.shown = '';
            delete overlay.dataset.built;
            overlay.innerHTML = '';
            overlay._startSync = null;
            overlay._stopSync = null;
            overlay._amRender = null;
            overlay._scrollArea = null;
            overlay._video = null;
        }
        const badge = slide.querySelector('.am-xml-loading-badge');
        if (badge) badge.classList.remove('show', 'badge-warn');
        amResetVideoFrame(slide);
    };

    const unloadSlideVideo = (slide) => {
        if (!slide) return;
        slide.querySelectorAll('video').forEach(v => {
            try {
                v.pause();
                if (v.src) v.dataset.originalSrc = v.src;
                v.removeAttribute('src');
                v.load();
            } catch (_) {}
        });
        const host = slide.querySelector('.tiktok-media-host');
        if (host) {
            host.removeAttribute('data-tiktok-state');
            host.innerHTML = '<div class="tiktok-media-skeleton"><span class="material-symbols-rounded tiktok-skel-icon">smart_display</span></div>';
        }
        const pauseIcon = slide.querySelector('.overlay-pause');
        if (pauseIcon) pauseIcon.textContent = 'pause';
    };

    const ensureSlideVideoLoaded = (slide) => {
        if (!slide) return;
        const host = slide.querySelector('.tiktok-media-host');
        if (host && !host.dataset.tiktokState) {
            hydrateTikTokHosts(slide, 'video');
            return;
        }
        slide.querySelectorAll('video').forEach(v => {
            if (!v.getAttribute('src') && v.dataset.originalSrc) {
                v.src = v.dataset.originalSrc;
                try { v.load(); } catch (_) {}
            }
        });
    };

    const setupScrollLinkedVideoPlayback = (scrollRoot, slideSelector, attachEl) => {
        if (!scrollRoot) return;
        const tag = attachEl || scrollRoot;
        disconnectScrollVideoIo(tag);

        let lastBestSlide = null;

        const playVisible = () => {
            const slides = scrollRoot.querySelectorAll(slideSelector);
            const rootRect = scrollRoot.getBoundingClientRect();
            const rootCenter = rootRect.top + rootRect.height / 2;

            let bestSlide = null, bestDist = Infinity;
            for (let i = 0; i < slides.length; i++) {
                const r = slides[i].getBoundingClientRect();
                const dist = Math.abs((r.top + r.height / 2) - rootCenter);
                if (dist < bestDist) { bestDist = dist; bestSlide = slides[i]; }
            }

            if (bestSlide === lastBestSlide) return;
            lastBestSlide = bestSlide;

            for (let i = 0; i < slides.length; i++) {
                const s = slides[i];
                if (s === bestSlide) continue;
                if (s.dataset.id) resetAmXmlSlide(s);
                unloadSlideVideo(s);
            }

            scrollRoot.querySelectorAll(`${slideSelector} video`).forEach(v => {
                if (!v.paused) v.pause();
            });

            if (bestSlide) {
                const slideId = bestSlide.dataset.id;
                if (slideId) {
                    lastClickedId = slideId;
                    history.replaceState(null, null, `/${slideId}`);
                }

                const host = bestSlide.querySelector('.tiktok-media-host');
                if (host && !host.dataset.tiktokState) {
                    ensureSlideVideoLoaded(bestSlide);
                    return;
                }
                ensureSlideVideoLoaded(bestSlide);

                const v = (host && host.querySelector('video')) || bestSlide.querySelector('video');
                if (v && v.paused) {
                    v.muted = globalMuted;
                    if (!globalMuted) v.volume = 1;
                    v.play().catch(() => { 
                        v.muted = true;
                        const muteBtn = bestSlide.querySelector('.video-mute-btn');
                        if (muteBtn) {
                            const icon = muteBtn.querySelector('.material-symbols-rounded');
                            if (icon) icon.textContent = 'volume_off';
                        }
                        v.play().catch(() => {});
                    });
                    
                    const muteBtn = bestSlide.querySelector('.video-mute-btn');
                    if (muteBtn) {
                        const icon = muteBtn.querySelector('.material-symbols-rounded');
                        if (icon) icon.textContent = v.muted ? 'volume_off' : 'volume_up';
                    }

                    if (bestSlide.dataset.amXmlUrl) {
                        scrollRoot.querySelectorAll(`${slideSelector} .am-xml-overlay`).forEach(ov => {
                            if (ov !== bestSlide.querySelector('.am-xml-overlay') && ov._stopSync) ov._stopSync();
                        });
                        if (v.readyState >= 2) {
                            triggerAmXmlPreview(bestSlide);
                        } else {
                            const onPlay = () => {
                                triggerAmXmlPreview(bestSlide);
                                v.removeEventListener('playing', onPlay);
                            };
                            v.addEventListener('playing', onPlay);
                        }
                    }
                }
            }
        };

        let scrollTimer = null;
        const onScroll = () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(playVisible, 150);
        };

        scrollRoot.addEventListener('scroll', onScroll, { passive: true });
        tag._scrollVideoIo = {
            disconnect: () => {
                scrollRoot.removeEventListener('scroll', onScroll);
                clearTimeout(scrollTimer);
                lastBestSlide = null;
            }
        };
    };

    const renderContacts = async () => {
        const grid = document.getElementById('contact-grid');
        if (!grid) return;
        try {
            grid.innerHTML = Array(6).fill('<div class="skeleton-social-card"><div class="skeleton-social-icon"></div><div class="skeleton-social-name"></div></div>').join('');
            const res = await fetch(`${API_URL}/contacts`);
            const contacts = await res.json();
            if (contacts.length === 0) {
                grid.innerHTML = '<div class="empty-state">No contact links found.</div>';
                return;
            }
            grid.innerHTML = contacts.map(c => {
                const iconHtml = (c.icon && (c.icon.startsWith('http') || c.icon.includes('/')))
                    ? `<img src="${thumbUrl(c.icon, 96)}" class="social-icon-img" alt="${c.name}" loading="lazy">`
                    : (c.icon && c.icon.startsWith('bi-'))
                        ? `<span class="brand-icon ${c.icon} social-icon"></span>`
                        : (c.icon && c.icon.startsWith('ms-'))
                            ? `<span class="material-symbols-rounded social-icon">${c.icon.substring(3)}</span>`
                            : `<span class="material-symbols-rounded social-icon">${c.icon || 'public'}</span>`;
                
                return `
                <a href="${ensureProtocol(c.url)}" class="card social-card" target="_blank">
                    <div class="flex align-center gap-16">
                        ${iconHtml}
                        <h3 class="social-name">${c.name}</h3>
                    </div>
                </a>
                `;
            }).join('');
        } catch (err) {
            console.error('Render contacts failed:', err);
            grid.innerHTML = '<div class="error-state">Failed to load contacts.</div>';
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            // Stop any playing video and clear state if switching away from the feed
            const feedView = document.getElementById('preset-feed-view');
            const feedContainer = document.getElementById('preset-feed');
            if (feedView && !feedView.classList.contains('hidden')) {
                if (targetTab !== 'preset') {
                    showExplore();
                } else {
                    feedView.querySelectorAll('video').forEach(v => {
                        v.pause();
                        v.src = '';
                        try { v.load(); } catch(e){}
                    });
                }
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetTab) {
                    section.classList.add('active');
                    if (targetTab === 'preset') {
                        showExplore();
                    }
                }
            });
            if (targetTab === 'social') {
                renderSocials();
            } else if (targetTab === 'preset') {
                renderPresets();
            } else if (targetTab === 'resource') {
                renderResources();
            } else if (targetTab === 'contact') {
                renderContacts();
            }
            if (history.pushState) {
                history.pushState(null, null, `#${targetTab}`);
            }
        });
    });
    const path = window.location.pathname.substring(1);
    
    let targetTab = '';
    let targetSubId = null;
    
    if (/^[a-f0-9]{24}$/i.test(path)) {
        targetTab = 'preset';
        targetSubId = path;
    }
    
    const downloadModal = document.getElementById('download-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const modalBadgeContainer = document.getElementById('modal-badge-container');
    const modalFileSize = document.getElementById('modal-file-size');
    const modalFileType = document.getElementById('modal-file-type');
    const modalMinVersion = document.getElementById('modal-min-version');
    const modalTitle = document.getElementById('modal-title');
    const presetExploreView = document.getElementById('preset-explore-view');
    const presetFeedView = document.getElementById('preset-feed-view');
    const backToExploreBtn = document.getElementById('back-to-explore');
    if (backToExploreBtn) {
        backToExploreBtn.addEventListener('click', showExplore);
    }
    const presetExploreGrid = document.getElementById('preset-explore-grid');
    const presetFeed = document.getElementById('preset-feed');

    if (presetFeed) {
        presetFeed.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const slide = btn.closest('.tiktok-slide');
            const id = slide?.dataset.id;

            if (action === 'download' && id) {
                try {
                    const res = await fetch(`${API_URL}/presets/${id}`);
                    const data = await res.json();
                    const softwareArr = Array.isArray(data.software) ? data.software : (data.software ? [data.software] : []);
                    let urls = Array.isArray(data.urls) ? data.urls.filter(u => {
                        if (u.sw === 'AM') {
                            return !!(data.amPremiumUrl || data.am5MbUrl || data.amXmlUrl);
                        }
                        return !!u.url;
                    }) : [];
                    
                    if (softwareArr.includes('AM') && !urls.some(u => u.sw === 'AM')) {
                        if (data.amPremiumUrl || data.am5MbUrl || data.amXmlUrl) {
                            urls.push({ sw: 'AM', url: data.amPremiumUrl || data.am5MbUrl || data.amXmlUrl });
                        }
                    }
                    
                    if (softwareArr.length === 1 && softwareArr.includes('AM')) {
                        openAmVariantPicker(data, false);
                    } else if (urls.length > 1) {
                        openSwDownloadPicker(urls, data.name, data);
                    } else if (urls.length === 1) {
                        if (urls[0].sw === 'AM') {
                            openAmVariantPicker(data, false);
                        } else {
                            openSwDetailPicker(urls[0], data, false);
                        }
                    } else if (data.url) {
                        const hasAe = softwareArr.includes('AE');
                        if (hasAe || data.plugin) {
                            openSwDetailPicker({ sw: 'AE', url: data.url }, data, false);
                        } else {
                            window.open(ensureProtocol(data.url), '_blank');
                        }
                    }
                } catch (err) {
                    console.error('Download error:', err);
                }
            } else if (action === 'like' && id) {
                handleLike(id, btn);
            } else if (action === 'source' && id) {
                const res = await fetch(`${API_URL}/presets/${id}`);
                const data = await res.json();
                if (data.media) window.open(data.media, '_blank');
            }
        });
    }

    const SOFTWARE_FULL_NAMES = {
        'AE': 'After Effects',
        'AM': 'Alight Motion',
        'Blurr': 'Blurr',
        'CC': 'Capcut',
        'FM': 'Funimate',
        'Node': 'Node Video'
    };

    const openAmVariantPicker = (presetData, showBackButton = false) => {
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
                e.stopPropagation();
                picker.classList.remove('show');
                picker.classList.remove('transparent-bg');
                if (showBackButton) {
                    document.querySelector('#sw-download-picker .mini-popup')?.classList.remove('stacked');
                }
            };
        }

        if (showBackButton) {
            picker.classList.add('transparent-bg');
            document.querySelector('#sw-download-picker .mini-popup')?.classList.add('stacked');
        } else {
            picker.classList.remove('transparent-bg');
        }

        let html = '';
        
        if (presetData.amPremiumUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn" data-url="${escapeHtmlAttr(presetData.amPremiumUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion Premium">
                    <span>Alight Motion Premium</span>
                </button>
            `;
        }
        
        if (presetData.am5MbUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn" data-url="${escapeHtmlAttr(presetData.am5MbUrl)}">
                    <img src="assets/icon/Am.png" alt="Alight Motion 5MB">
                    <span>Alight Motion 5MB</span>
                </button>
            `;
        }

        if (presetData.amXmlUrl) {
            html += `
                <button class="sw-download-option-btn am-option-btn am-xml-btn" data-url="${escapeHtmlAttr(presetData.amXmlUrl)}">
                    <span class="material-symbols-rounded" style="font-size: 22px;">code</span>
                    <span>XML</span>
                </button>
            `;
        }

        if (Array.isArray(presetData.amXmlExtras) && presetData.amXmlExtras.length > 0) {
            html += `
                <div class="am-extra-section" style="margin-top: 16px; border-top: 1px dashed var(--md-sys-color-outline-variant); padding-top: 12px; width: 100%;">
                    <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--md-sys-color-on-surface); text-align: left; padding-left: 8px;">
                        Additional Files:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
            `;
            presetData.amXmlExtras.forEach(extra => {
                html += `
                    <button class="sw-download-option-btn am-extra-btn" data-url="${escapeHtmlAttr(extra.url)}" style="border: 1px dashed var(--md-sys-color-outline); padding: 8px 12px; font-size: 12px; border-radius: 8px; box-shadow: none;">
                        <span style="flex-grow: 1; text-align: left;">${escapeHtmlAttr(extra.label)}</span>
                        <span class="material-symbols-rounded" style="font-size: 18px; color: var(--md-sys-color-on-surface-variant);">download</span>
                    </button>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        }

        optionsContainer.innerHTML = html;

        optionsContainer.querySelectorAll('.sw-download-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) {
                    if (btn.classList.contains('am-xml-btn')) {
                        // Direct XML download via proxy
                        const proxyUrl = `${API_URL}/proxy?url=${encodeURIComponent(url)}`;
                        fetch(proxyUrl)
                            .then(r => r.ok ? r.blob() : Promise.reject())
                            .then(blob => {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = (presetData.name || 'preset') + '.xml';
                                a.click();
                                URL.revokeObjectURL(a.href);
                            })
                            .catch(() => window.open(ensureProtocol(url), '_blank'));
                    } else {
                        window.open(ensureProtocol(url), '_blank');
                    }
                }
                if (!btn.classList.contains('am-extra-btn')) {
                    picker.classList.remove('show');
                    picker.classList.remove('transparent-bg');
                    document.querySelector('#sw-download-picker .mini-popup')?.classList.remove('stacked');
                    document.getElementById('sw-download-picker')?.classList.remove('show');
                }
            });
        });

        picker.classList.add('show');
    };

    const openSwDownloadPicker = (urls, presetName, presetData) => {
        const picker = document.getElementById('sw-download-picker');
        const optionsContainer = document.getElementById('sw-download-options');
        if (!picker || !optionsContainer) return;
        const badgeIcons = {
            'AE': 'assets/icon/Ae.png',
            'AM': 'assets/icon/Am.png',
            'Blurr': 'assets/icon/Blurr.png',
            'CC': 'assets/icon/CC.png',
            'FM': 'assets/icon/Fm.png',
            'Node': 'assets/icon/Node.png'
        };
        optionsContainer.innerHTML = urls.map(entry => {
            const icon = badgeIcons[entry.sw];
            const label = SOFTWARE_FULL_NAMES[entry.sw] || entry.sw;
            return `
                <button class="sw-download-option-btn" data-sw="${escapeHtmlAttr(entry.sw)}" data-url="${escapeHtmlAttr(entry.url || '')}">
                    ${icon ? `<img src="${icon}" alt="${label}">` : `<span class="material-symbols-rounded">apps</span>`}
                    <span>${label}</span>
                </button>`;
        }).join('');
        optionsContainer.querySelectorAll('.sw-download-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const sw = btn.dataset.sw;
                const url = btn.dataset.url;
                if (sw === 'AM') {
                    openAmVariantPicker(presetData, true);
                    // Do not close sw-download-picker, let it stay open in stacked mode
                } else {
                    openSwDetailPicker({ sw, url }, presetData, true);
                    // Do not close sw-download-picker, let it stay open in stacked mode
                }
            });
        });
        picker.classList.add('show');
    };

    const openSwDetailPicker = (entry, presetData, showBackButton = false) => {
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
                e.stopPropagation();
                picker.classList.remove('show');
                picker.classList.remove('transparent-bg');
                if (showBackButton) {
                    document.querySelector('#sw-download-picker .mini-popup')?.classList.remove('stacked');
                }
            };
        }

        if (showBackButton) {
            picker.classList.add('transparent-bg');
            document.querySelector('#sw-download-picker .mini-popup')?.classList.add('stacked');
        } else {
            picker.classList.remove('transparent-bg');
        }
        
        const badgeIcons = {
            'AE': 'assets/icon/Ae.png',
            'AM': 'assets/icon/Am.png',
            'Blurr': 'assets/icon/Blurr.png',
            'CC': 'assets/icon/CC.png',
            'FM': 'assets/icon/Fm.png',
            'Node': 'assets/icon/Node.png'
        };
        
        const swLabel = SOFTWARE_FULL_NAMES[entry.sw] || entry.sw;
        titleText.textContent = swLabel;
        
        const iconSrc = badgeIcons[entry.sw];
        if (iconSrc && iconEl) {
            iconEl.src = iconSrc;
            iconEl.alt = swLabel;
            iconEl.style.display = 'block';
        } else if (iconEl) {
            iconEl.style.display = 'none';
        }
        
        downloadBtn.onclick = () => {
            if (entry.url) {
                window.open(ensureProtocol(entry.url), '_blank');
            }
            picker.classList.remove('show');
            picker.classList.remove('transparent-bg');
            document.querySelector('#sw-download-picker .mini-popup')?.classList.remove('stacked');
            document.getElementById('sw-download-picker')?.classList.remove('show');
        };
        
        if (entry.sw === 'AE' && presetData.plugin) {
            const plugins = presetData.plugin.split(',').map(p => p.trim()).filter(Boolean);
            if (plugins.length > 0) {
                pluginsContainer.innerHTML = plugins.map(pName => `
                    <div class="plugin-badge-item">
                        <span class="material-symbols-rounded">extension</span>
                        <span>${escapeHtmlAttr(pName)}</span>
                    </div>
                `).join('');
                pluginSection.style.display = 'flex';
            } else {
                pluginSection.style.display = 'none';
            }
        } else {
            pluginSection.style.display = 'none';
        }
        
        picker.classList.add('show');
    };

    const closeSwDownloadBtn = document.getElementById('close-sw-download');
    if (closeSwDownloadBtn) {
        closeSwDownloadBtn.addEventListener('click', () => {
            document.getElementById('sw-download-picker')?.classList.remove('show');
        });
    }

    document.getElementById('sw-download-picker')?.addEventListener('click', (e) => {
        if (e.target.id === 'sw-download-picker') {
            e.target.classList.remove('show');
        }
    });

    document.getElementById('sw-detail-picker')?.addEventListener('click', (e) => {
        if (e.target.id === 'sw-detail-picker') {
            document.getElementById('back-sw-detail')?.click();
        }
    });

    document.getElementById('am-variant-picker')?.addEventListener('click', (e) => {
        if (e.target.id === 'am-variant-picker') {
            document.getElementById('back-am-variant')?.click();
        }
    });



    const handleLike = async (id, btn, onlyLike = false) => {
        const isLiked = btn.classList.contains('liked');
        if (onlyLike && isLiked) return;

        const label = btn.querySelector('.action-label');
        const icon = btn.querySelector('.material-symbols-rounded');
        const currentCount = label ? parseInt(label.textContent) || 0 : 0;

        if (isLiked) {
            btn.classList.remove('liked');
            if (icon) icon.textContent = 'favorite_border';
            if (label) label.textContent = Math.max(0, currentCount - 1);
        } else {
            btn.classList.add('liked');
            if (icon) icon.textContent = 'favorite';
            if (label) label.textContent = currentCount + 1;
            btn.classList.add('like-pop');
            setTimeout(() => btn.classList.remove('like-pop'), 400);
        }

        try {
            const res = await fetch(`${API_URL}/presets/${id}/like`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && label) {
                label.textContent = data.likes;
                if (data.liked) {
                    btn.classList.add('liked');
                    if (icon) icon.textContent = 'favorite';
                } else {
                    btn.classList.remove('liked');
                    if (icon) icon.textContent = 'favorite_border';
                }
            }
        } catch (err) {
            console.error('Like error:', err);
        }
    };

    const openDownloadModal = (res) => {
        if (!downloadModal) return;
        modalTitle.textContent = res.name;
        modalFileSize.textContent = res.size || 'N/A';
        modalFileType.textContent = res.type || 'Preset';
        modalMinVersion.textContent = res.version || 'v1.0';
        
        const swName = document.getElementById('modal-software-name');
        if (swName) swName.textContent = '@cutefishaep';

        const pluginsRow = document.getElementById('modal-plugins-row');
        const pluginsText = document.getElementById('modal-plugins-text');
        if (pluginsRow && pluginsText) {
            if (res.plugin) {
                pluginsText.textContent = res.plugin;
                pluginsRow.classList.remove('hidden');
            } else {
                pluginsRow.classList.add('hidden');
            }
        }

        const softwareStyles = {
            'AE': { label: 'Ae', color: '#9999ff', dark: '#00005b' },
            'AM': { label: 'Am', color: '#00ffcc', dark: '#002211' },
            'Blurr': { label: 'Bl', color: '#00ff88', dark: '#002211' },
            'CC': { label: 'Cc', color: '#ffffff', dark: '#000000' },
            'FM': { label: 'Fm', color: '#ff00ff', dark: '#330033' },
            'Node': { label: 'Nv', color: '#00ffff', dark: '#001122' }
        };

        const swKey = res.software || 'AE';
        const style = softwareStyles[swKey] || { label: '??', color: '#888', dark: '#222' };

        const modalIconContainer = document.querySelector('.app-icon-large');
        if (modalIconContainer) {
            modalIconContainer.style.setProperty('--brand-color', style.color);
            modalIconContainer.style.setProperty('--brand-color-dark', style.dark);
        }

        modalBadgeContainer.innerHTML = `
            <div class="sw-icon-content">
                <span class="sw-icon-text" style="color: ${style.color};">${style.label}</span>
            </div>
        `;
        
        const downloadBtn = downloadModal.querySelector('.download-confirm-btn');
        if (downloadBtn) {
            downloadBtn.onclick = () => window.open(res.url || '#', '_blank');
        }
        downloadModal.classList.add('show');
    };

    if (presetExploreGrid) {
        presetExploreGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.explore-item');
            if (item) {
                const id = item.dataset.id;
                showFeed(id, item);
            }
        });
    }

    const badgeIcons = {
        'AE': 'assets/icon/Ae.png',
        'AM': 'assets/icon/Am.png',
        'Blurr': 'assets/icon/Blurr.png',
        'CC': 'assets/icon/CC.png',
        'FM': 'assets/icon/Fm.png',
        'Node': 'assets/icon/Node.png'
    };

    const renderSocials = async () => {
        const container = document.getElementById('social-grid');
        if (!container || container.getAttribute('data-loaded') === 'true') return;

        // Show skeleton loading state
        container.innerHTML = Array(6).fill(0).map(() => `
            <div class="skeleton-social-card">
                <div class="skeleton-social-icon"></div>
                <div class="skeleton-social-name"></div>
            </div>
        `).join('');

        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        if (!Array.isArray(socials)) {
            console.warn('[Socials] API returned non-array:', socials);
            container.innerHTML = '';
            return;
        }
        if (socials.length > 0) {
            container.innerHTML = socials.map(s => {
                const iconHtml = (s.icon && (s.icon.startsWith('http') || s.icon.includes('/')))
                    ? `<img src="${thumbUrl(s.icon, 96)}" class="social-icon-img" alt="${s.name}" loading="lazy">`
                    : (s.icon && s.icon.startsWith('bi-'))
                        ? `<span class="brand-icon ${s.icon} social-icon"></span>`
                        : (s.icon && s.icon.startsWith('ms-'))
                            ? `<span class="material-symbols-rounded social-icon">${s.icon.substring(3)}</span>`
                            : `<span class="material-symbols-rounded social-icon">${s.icon || 'public'}</span>`;
                
                return `
                <a href="${ensureProtocol(s.url)}" class="card social-card" target="_blank">
                    <div class="flex align-center gap-16">
                        ${iconHtml}
                        <h3 class="social-name">${s.name}</h3>
                    </div>
                </a>
                `;
            }).join('');
            container.setAttribute('data-loaded', 'true');
        }
    };

    const renderPresetCategories = (presets) => {
        const categoryContainer = document.getElementById('preset-categories');
        if (!categoryContainer) return;
        
        const activeCategory = categoryContainer.querySelector('.chip.active')?.dataset.software || 'All';
        const allSw = new Set();
        presets.forEach(p => {
            const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
            swArr.forEach(sw => allSw.add(sw));
        });
        const categories = ['All', ...allSw];
        
        categoryContainer.innerHTML = categories.map(cat => {
            if (cat === 'All') return `<div class="chip ${activeCategory === 'All' ? 'active' : ''}" data-software="All">${window.getTranslation('preset_category_all')}</div>`;
            
            const localBadgeIcons = {
                'AE': 'assets/icon/Ae.png',
                'AM': 'assets/icon/Am.png',
                'Blurr': 'assets/icon/Blurr.png',
                'CC': 'assets/icon/CC.png',
                'FM': 'assets/icon/Fm.png',
                'Node': 'assets/icon/Node.png'
            };
            const icon = localBadgeIcons[cat];
            const iconHtml = icon ? `<img src="${icon}" alt="${cat}" class="chip-icon">` : '';
            return `<div class="chip ${activeCategory === cat ? 'active' : ''}" data-software="${cat}">${iconHtml}${cat}</div>`;
        }).join('');
    };

    const renderPresets = async (filterSoftware = 'All') => {
        const exploreGrid = document.getElementById('preset-explore-grid');
        if (!exploreGrid) return;
        
        exploreGrid.innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join('');
        
        const res = await fetch(`${API_URL}/presets`);
        const allPresets = await res.json();
        if (!Array.isArray(allPresets)) {
            console.warn('[Presets] API returned non-array:', allPresets);
            exploreGrid.innerHTML = `<div class="empty-state">Failed to load presets. Is the server running?</div>`;
            return;
        }
        
        renderPresetCategories(allPresets);
        
        const presets = filterSoftware === 'All'
            ? allPresets
            : allPresets.filter(p => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                return swArr.includes(filterSoftware);
            });
        const feedContainer = document.getElementById('preset-feed');
        if (exploreGrid) disconnectScrollVideoIo(exploreGrid);
        if (feedContainer) disconnectScrollVideoIo(feedContainer);
        
        if (presets.length === 0) {
            exploreGrid.innerHTML = `<div class="empty-state">No presets found for ${filterSoftware}</div>`;
        } else {
            exploreGrid.innerHTML = presets.map(p => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                const badgesHtml = swArr.map(sw => {
                    const icon = badgeIcons[sw];
                    return icon ? `<div class="explore-badge-multi"><img src="${icon}" alt="${sw}"></div>` : '';
                }).join('');
                return `
                <div class="explore-item" data-id="${p._id}">
                    ${presetMediaInnerHtml(p.media, p.name)}
                    <div class="explore-badges">${badgesHtml}</div>
                    <div class="explore-info">
                        <div class="explore-info-title">${escapeHtmlAttr(p.name)}</div>
                        <div class="explore-info-row">
                            <span class="material-symbols-rounded" style="${p.liked ? 'color: #ff3b5c; font-variation-settings: \'FILL\' 1;' : ''}">favorite</span>
                            <span>${p.likes || 0}</span>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            exploreGrid.setAttribute('data-loaded', 'true');
        }
        if (feedContainer) {
            const dsa = escapeHtmlAttr;
            feedContainer.innerHTML = presets.map((p) => {
                const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                const swIconsHtml = swArr.map(sw => {
                    const icon = badgeIcons[sw];
                    return icon ? `<img src="${icon}" class="tiktok-title-icon" alt="${sw}">` : '';
                }).join('');
                // Check if this preset has AM XML
                const swArr2 = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
                const hasAmXml = swArr2.includes('AM') && !!p.amXmlUrl;
                const xmlAttr = hasAmXml ? `data-am-xml-url="${dsa(p.amXmlUrl)}"` : '';

                return `
                <article class="tiktok-slide preset-post"
                    data-id="${p._id}"
                    data-name="${dsa(p.name)}"
                    data-size="${dsa(p.size)}"
                    data-type="${dsa(p.type)}"
                    data-version="${dsa(p.version)}"
                    data-software="${dsa(Array.isArray(p.software) ? p.software.join(',') : (p.software || ''))}"
                    ${xmlAttr}>
                    <div class="tiktok-slide-media post-media-container">
                        ${presetMediaInnerHtml(p.media, p.name)}
                        <div class="tiktok-slide-gradient" aria-hidden="true"></div>
                        <button type="button" class="video-mute-btn" aria-label="Toggle mute" style="position: absolute; top: max(12px, env(safe-area-inset-top, 12px)); right: 12px; z-index: 160; background: rgba(0, 0, 0, 0.45); border: none; width: 44px; height: 44px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent;">
                            <span class="material-symbols-rounded" style="font-size: 24px;">volume_off</span>
                        </button>
                        ${!hasAmXml ? `<div class="video-interaction-overlay"><span class="material-symbols-rounded overlay-pause">pause</span></div>` : ''}
                    </div>
                    ${hasAmXml ? `<div class="am-xml-loading-badge">
                        <span class="material-symbols-rounded spin" style="font-size:16px">sync</span>
                        <span class="am-xml-badge-text">Loading AM Preview...</span>
                    </div>` : ''}
                    ${hasAmXml ? '<div class="am-xml-overlay"></div>' : ''}
                    <div class="tiktok-slide-ui">
                        <div class="tiktok-rail">
                            <button type="button" class="tiktok-rail-btn action-btn ${p.liked ? 'liked' : ''}" data-action="like">
                                <span class="material-symbols-rounded">${p.liked ? 'favorite' : 'favorite_border'}</span>
                                <span class="action-label">${p.likes || 0}</span>
                            </button>
                            <button type="button" class="tiktok-rail-btn action-btn" data-action="source">
                                <span class="material-symbols-rounded">open_in_new</span>
                                <span class="action-label">Source</span>
                            </button>
                        </div>
                        <div class="tiktok-bottom">
                            <div class="tiktok-info">
                                <div class="tiktok-title-row">
                                    <div class="tiktok-title-icons">${swIconsHtml}</div>
                                    <div class="tiktok-title-wrapper">
                                        <h3 class="tiktok-title">${dsa(p.name)}</h3>
                                    </div>
                                </div>
                                <div class="tiktok-meta">
                                    <div class="meta-item">
                                        <span>${dsa(p.size || 'N/A')}</span>
                                    </div>
                                    <span class="meta-dot">•</span>
                                    <div class="meta-item">
                                        <span>${dsa(p.version || 'v1.0')}</span>
                                    </div>
                                </div>
                            </div>
                            <button type="button" class="tiktok-download-btn-full" data-action="download">
                                Download
                            </button>
                        </div>
                    </div>
                </article>
            `;
            }).join('');
        }
        await hydrateTikTokHosts(exploreGrid, 'image');
        await hydrateTikTokHosts(feedContainer, 'video');
        if (feedContainer) {
            setupScrollLinkedVideoPlayback(feedContainer, '.tiktok-slide', feedContainer);
            setupTikTokInteractions(feedContainer);
            updateScrollingTitles(feedContainer);
        }
        if (filterSoftware === 'All') {
            exploreGrid.setAttribute('data-loaded', 'true');
            if (targetSubId) {
                const presetExists = allPresets.some(p => p._id === targetSubId);
                if (presetExists) {
                    showFeed(targetSubId);
                }
            }
        }
    };
    const OS_SVG = { WIN: 'assets/svg/windows.svg', MAC: 'assets/svg/apple.svg', ANDROID: 'assets/svg/android.svg' };
    const OS_LABEL = { WIN: 'Windows', MAC: 'macOS', ANDROID: 'Android' };

    const renderResourceCategories = (resources) => {
        const categoryContainer = document.getElementById('resource-categories');
        if (!categoryContainer) return;

        const activeCategory = categoryContainer.querySelector('.chip.active')?.dataset.category || 'All';
        const catSet = new Set();
        resources.forEach(r => {
            const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
            cats.forEach(c => catSet.add(c));
        });

        // Sort: "Made By Cutefish" first, then alphabetical
        const sorted = [...catSet].sort((a, b) => {
            if (a === 'Made By Cutefish') return -1;
            if (b === 'Made By Cutefish') return 1;
            return a.localeCompare(b);
        });
        const categories = ['All', ...sorted];

        categoryContainer.innerHTML = categories.map(cat => `
            <div class="chip ${activeCategory === cat ? 'active' : ''}" data-category="${cat}">${cat}</div>
        `).join('');
    };

    let allResources = [];
    const renderResources = async (query = '', filterCategory = 'All') => {
        const container = document.getElementById('resource-grid');
        if (!container) return;

        container.innerHTML = Array(4).fill(0).map(() => `
            <div class="skeleton-resource-card">
                <div class="skeleton-resource-card-icon"></div>
                <div class="skeleton-resource-card-info">
                    <div class="skeleton-resource-card-line"></div>
                    <div class="skeleton-resource-card-line short"></div>
                    <div class="skeleton-resource-card-line medium"></div>
                </div>
            </div>
        `).join('');

        const res = await fetch(`${API_URL}/resources`);
        allResources = await res.json();
        if (!Array.isArray(allResources)) {
            console.warn('[Resources] API returned non-array:', allResources);
            container.innerHTML = `<div class="empty-state">Failed to load resources. Is the server running?</div>`;
            allResources = [];
            return;
        }

        renderResourceCategories(allResources);

        let filtered = allResources;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                return cats.includes(filterCategory);
            });
        }

        if (query) {
            filtered = filtered.filter(r =>
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                (Array.isArray(r.category) ? r.category.join(' ') : (r.category || '')).toLowerCase().includes(query.toLowerCase()) ||
                (r.dev && r.dev.toLowerCase().includes(query.toLowerCase()))
            );
        }

        // Sort: "Made By Cutefish" category resources first
        filtered.sort((a, b) => {
            const aIsCute = (Array.isArray(a.category) ? a.category : [a.category]).includes('Made By Cutefish');
            const bIsCute = (Array.isArray(b.category) ? b.category : [b.category]).includes('Made By Cutefish');
            if (aIsCute && !bIsCute) return -1;
            if (!aIsCute && bIsCute) return 1;
            return 0;
        });

        if (filtered.length > 0) {
            container.innerHTML = filtered.map((r) => {
                const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
                const osArr = Array.isArray(r.os) ? r.os : [];
                const osIconsHtml = osArr.map(o => {
                    const key = typeof o === 'string' ? o.toUpperCase() : (o.name || '').toUpperCase();
                    const svg = OS_SVG[key];
                    return svg ? `<img src="${svg}" class="os-icon-svg" alt="${key}" style="width:14px;height:14px">` : '';
                }).join('');

                const isCutefish = cats.includes('Made By Cutefish');
                const iconHtml = (r.icon && (r.icon.startsWith('http') || r.icon.includes('/')))
                    ? `<img src="${thumbUrl(r.icon, 128)}" class="resource-icon-img" alt="${r.title}" loading="lazy">`
                    : `<span class="material-symbols-rounded resource-icon">${r.icon || 'shop'}</span>`;

                return `
                <div class="card resource-card ${isCutefish ? 'resource-card-cutefish' : ''}" data-id="${r._id}" style="cursor:pointer">
                    <div class="resource-icon-wrapper">
                        ${iconHtml}
                    </div>
                    <div class="resource-info-compact">
                        <h4 class="resource-title-compact">${r.title}</h4>
                        <p class="resource-dev-compact">${r.dev || 'CHROS Team'}</p>
                        <div class="resource-meta-compact">
                            ${osIconsHtml ? `<span class="chip-mini os-chip">${osIconsHtml}</span>` : ''}
                            <span class="resource-info-text">${r.info || ''}</span>
                        </div>
                        <div class="resource-cats-row">
                            ${cats.map(c => `<span class="resource-cat-chip">${c}</span>`).join('')}
                        </div>
                    </div>
                    <button class="download-direct-btn res-card-detail-btn" data-id="${r._id}" aria-label="Details">
                        <span class="btn-label">Download</span>
                        <span class="material-symbols-rounded">download</span>
                    </button>
                </div>`;
            }).join('');
            container.setAttribute('data-loaded', 'true');

            // Attach click handlers
            container.querySelectorAll('.resource-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.res-card-detail-btn') || e.target.closest('.download-direct-btn')) return;
                    const id = card.dataset.id;
                    const item = allResources.find(r => r._id === id);
                    if (item) openResourcePopup(item);
                });
            });
            container.querySelectorAll('.res-card-detail-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const item = allResources.find(r => r._id === id);
                    if (item) openResourcePopup(item);
                });
            });
        }
    };


    const RESOURCE_PASSWORD = 'EDITINGSTUFF';

    const openResourcePopup = (resource) => {
        const popup = document.getElementById('resource-detail-popup');
        if (!popup) return;

        // Icon
        const iconEl = document.getElementById('res-popup-icon');
        const fallbackEl = document.getElementById('res-popup-icon-fallback');
        if (resource.icon && (resource.icon.startsWith('http') || resource.icon.includes('/'))) {
            iconEl.src = thumbUrl(resource.icon, 128);
            iconEl.classList.remove('hidden');
            if (fallbackEl) fallbackEl.classList.add('hidden');
        } else {
            iconEl.classList.add('hidden');
            if (fallbackEl) fallbackEl.classList.remove('hidden');
        }

        document.getElementById('res-popup-title').textContent = resource.title;
        document.getElementById('res-popup-dev').textContent = resource.dev || 'CHROS Team';
        document.getElementById('res-popup-info').textContent = resource.info || '—';

        // Categories
        const cats = Array.isArray(resource.category) ? resource.category : (resource.category ? [resource.category] : []);
        document.getElementById('res-popup-cats').innerHTML = cats.map(c =>
            `<span class="res-popup-cat-chip">${c}</span>`
        ).join('');

        // OS data
        const osArr = Array.isArray(resource.os) ? resource.os : [];
        document.getElementById('res-popup-os-count').textContent = osArr.length || '—';
        const totalVers = new Set();
        osArr.forEach(o => { if (o.versions) o.versions.forEach(v => totalVers.add(v.label)); });
        document.getElementById('res-popup-ver-count').textContent = totalVers.size || '—';

        // State
        let selectedOs = null;
        let selectedVer = null;
        let osVersionMap = {}; // { WIN: [{label, url}], MAC: [...] }

        osArr.forEach(o => {
            const key = typeof o === 'string' ? o.toUpperCase() : (o.name || '').toUpperCase();
            osVersionMap[key] = o.versions || [];
        });

        const downloadSection = document.getElementById('res-popup-download-section');
        const verSection = document.getElementById('res-popup-ver-section');
        const passwordSection = document.getElementById('res-popup-password-section');
        const instrSection = document.getElementById('res-popup-instruction-section');

        const downloadBtn = document.getElementById('res-popup-download-btn');
        const downloadLabel = document.getElementById('res-popup-download-label');
        const verChipsEl = document.getElementById('res-popup-ver-chips');
        const osChipsEl = document.getElementById('res-popup-os-chips');

        // Hide downstream sections initially
        verSection.classList.add('hidden');
        downloadSection.classList.add('hidden');
        passwordSection.classList.add('hidden');
        instrSection.classList.add('hidden');

        const updateDownloadBtn = () => {
            const mainTextEl = downloadBtn.querySelector('.download-main-text');
            if (selectedOs && selectedVer) {
                const versions = osVersionMap[selectedOs] || [];
                const entry = versions.find(v => v.label === selectedVer);
                if (entry && entry.url) {
                    downloadBtn.disabled = false;
                    downloadBtn.onclick = () => window.open(ensureProtocol(entry.url), '_blank');
                    if (mainTextEl) mainTextEl.style.display = 'block';
                    downloadLabel.textContent = `${OS_LABEL[selectedOs] || selectedOs} - ${selectedVer}`;
                    
                    // Show downstream sections once selected
                    downloadSection.classList.remove('hidden');
                    passwordSection.classList.remove('hidden');
                    if (resource.instruction) {
                        instrSection.classList.remove('hidden');
                    }
                } else {
                    downloadBtn.disabled = true;
                    if (mainTextEl) mainTextEl.style.display = 'none';
                    downloadLabel.textContent = 'No link available';
                    downloadSection.classList.remove('hidden');
                }
            } else {
                downloadBtn.disabled = true;
                if (mainTextEl) mainTextEl.style.display = 'none';
                downloadLabel.textContent = 'Select OS & Version';
            }
        };

        const renderVerChips = () => {
            if (!selectedOs) {
                verSection.classList.add('hidden');
                return;
            }
            const versions = osVersionMap[selectedOs] || [];
            if (!versions.length) {
                verChipsEl.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">No versions available</span>';
                verSection.classList.remove('hidden');
                return;
            }
            verChipsEl.innerHTML = versions.map(v =>
                `<button class="res-popup-chip ${selectedVer === v.label ? 'active' : ''}" data-ver="${v.label}">${v.label}</button>`
            ).join('');
            verSection.classList.remove('hidden');

            verChipsEl.querySelectorAll('.res-popup-chip').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedVer = btn.dataset.ver;
                    verChipsEl.querySelectorAll('.res-popup-chip').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateDownloadBtn();
                });
            });
        };

        // Render OS chips
        const osKeys = Object.keys(osVersionMap);
        if (osKeys.length > 0) {
            osChipsEl.innerHTML = osKeys.map(key =>
                `<button class="res-popup-chip os-chip-btn" data-os="${key}">
                    ${OS_SVG[key] ? `<img src="${OS_SVG[key]}" class="os-icon-svg" style="width:16px;height:16px" alt="${key}">` : ''}
                    <span>${OS_LABEL[key] || key}</span>
                </button>`
            ).join('');
            osChipsEl.querySelectorAll('.os-chip-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedOs = btn.dataset.os;
                    selectedVer = null;
                    osChipsEl.querySelectorAll('.os-chip-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Reset and hide downstream when switching platform
                    downloadSection.classList.add('hidden');
                    passwordSection.classList.add('hidden');
                    instrSection.classList.add('hidden');

                    renderVerChips();
                });
            });
        } else {
            osChipsEl.innerHTML = '<span style="color:var(--md-sys-color-on-surface-variant);font-size:13px">No platforms configured</span>';
        }

        // Password
        document.getElementById('res-popup-password').textContent = RESOURCE_PASSWORD;
        const copyBtn = document.getElementById('res-popup-copy-btn');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(RESOURCE_PASSWORD).then(() => {
                const icon = copyBtn.querySelector('.material-symbols-rounded');
                icon.textContent = 'check';
                setTimeout(() => { icon.textContent = 'content_copy'; }, 1500);
            });
        };

        // Instruction
        const instrEl = document.getElementById('res-popup-instruction');
        if (resource.instruction) {
            instrEl.textContent = resource.instruction;
        }

        popup.classList.add('show');
    };

    document.getElementById('close-resource-popup')?.addEventListener('click', () => {
        document.getElementById('resource-detail-popup').classList.remove('show');
    });
    document.getElementById('resource-detail-popup')?.addEventListener('click', (e) => {
        if (e.target.id === 'resource-detail-popup') {
            e.target.classList.remove('show');
        }
    });



    const categoryContainer = document.getElementById('preset-categories');
    if (categoryContainer) {
        categoryContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            categoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const software = chip.dataset.software;
            renderPresets(software);
        });
    }

    const resourceCategoryContainer = document.getElementById('resource-categories');
    if (resourceCategoryContainer) {
        resourceCategoryContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;
            resourceCategoryContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const category = chip.dataset.category;
            renderResources('', category);
        });
    }

    const resourceSearch = document.getElementById('resource-search');
    if (resourceSearch) {
        resourceSearch.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            const activeCategory = document.querySelector('#resource-categories .chip.active')?.dataset.category || 'All';
            renderResources(query, activeCategory);
        });
    }




    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        const root = document.documentElement;
        
        const getPreferredTheme = () => {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        };

        const setTheme = (theme) => {
            const icon = themeToggleBtn.querySelector('.material-symbols-rounded');
            if (theme === 'dark') {
                root.classList.add('dark-theme');
                root.classList.remove('light-theme');
                if (icon) icon.textContent = 'light_mode';
                localStorage.setItem('theme', 'dark');
            } else {
                root.classList.add('light-theme');
                root.classList.remove('dark-theme');
                if (icon) icon.textContent = 'dark_mode';
                localStorage.setItem('theme', 'light');
            }
        };

        // Init theme
        setTheme(getPreferredTheme());

        themeToggleBtn.addEventListener('click', () => {
            const isDark = root.classList.contains('dark-theme') || 
                           (!root.classList.contains('light-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
            setTheme(isDark ? 'light' : 'dark');
        });
    }

    const initialTab = (targetTab === 'fishtoolupdate') ? 'resource' : (targetTab || 'social');
    const initialItem = document.querySelector(`.nav-item[data-tab="${initialTab}"]`);
    if (initialItem) initialItem.click();

    // Auto-open FishTools popup when hash is #fishtoolupdate
    if (targetTab === 'fishtoolupdate') {
        const tryOpenFishTools = async () => {
            // Wait for resources to be fetched and rendered
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                if (allResources.length > 0) {
                    clearInterval(poll);
                    const fishTools = allResources.find(r => r.title && r.title.toLowerCase() === 'fishtools');
                    if (fishTools) openResourcePopup(fishTools);
                }
                if (attempts > 40) clearInterval(poll); // stop after 4 seconds
            }, 100);
        };
        tryOpenFishTools();
    }

    // Pause all playing videos when page is hidden or window loses focus
    const pauseAllPlayingVideos = () => {
        document.querySelectorAll('video').forEach(v => {
            if (!v.paused) {
                v.pause();
            }
        });
    };

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pauseAllPlayingVideos();
        }
    });

    window.addEventListener('blur', pauseAllPlayingVideos);
});
