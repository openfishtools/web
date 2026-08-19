document.addEventListener('DOMContentLoaded', () => {
    const fileInput          = document.getElementById('tool-tiktok-input');
    const dropArea           = document.getElementById('tool-tiktok-drop');
    const statusText         = document.getElementById('tool-tiktok-status');
    const btnStart           = document.getElementById('btn-start-tiktok');
    const progressContainer  = document.getElementById('tiktok-progress-container');
    const progressFill       = document.getElementById('tiktok-progress-fill');
    const progressPercent    = document.getElementById('tiktok-progress-percent');
    const progressText       = document.getElementById('tiktok-progress-text');
    const logsContainer      = document.getElementById('tiktok-logs-container');
    const logsEl             = document.getElementById('tiktok-logs');
    const versionSwitch      = document.getElementById('tiktok-version-switch');
    const compressToggleRow  = document.getElementById('tiktok-compress-toggle-row');
    const compressModeSelector = document.getElementById('tiktok-compress-mode');
    const analysisModal      = document.getElementById('tiktok-analysis-modal');
    const tktk = {
        checkFps:   document.getElementById('tktk-check-fps'),
        checkRes:   document.getElementById('tktk-check-res'),
        checkSize:  document.getElementById('tktk-check-size'),
        iconFps:    document.getElementById('tktk-icon-fps'),
        iconRes:    document.getElementById('tktk-icon-res'),
        iconSize:   document.getElementById('tktk-icon-size'),
        valFps:     document.getElementById('tktk-val-fps'),
        valRes:     document.getElementById('tktk-val-res'),
        valSize:    document.getElementById('tktk-val-size'),
        btnCancel:  document.getElementById('tktk-btn-cancel'),
        btnProceed: document.getElementById('tktk-btn-proceed'),
        btnCompress: document.getElementById('tktk-btn-compress'),
    };

    let selectedFile     = null;
    let currentFileBuffer = null;
    let isProcessing     = false;
    let currentVersion   = 'v3';
    let compressMode     = 'off';
    const MAX_FILE_MB_HARD    = 1500;
    const COMPRESS_WARN_MB    = 50;
    const MOBILE_OOM_THRESHOLD_MB = 70;
    const PC_OOM_THRESHOLD_MB     = 100;

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    function getDeviceInfo() {
        const isMobile  = isMobileDevice();
        const deviceType = isMobile ? 'Mobile' : 'PC/Desktop';
        const cpuCores  = navigator.hardwareConcurrency || 'Unknown';
        return { deviceType, cpuCores };
    }
    function showCompressOomWarning(fileMB, fps, w, h) {
        return new Promise((resolve) => {
            const modal     = document.getElementById('compress-oom-warning-modal');
            const btnCancel  = document.getElementById('btn-compress-oom-cancel');
            const btnProceed = document.getElementById('btn-compress-oom-proceed');
            if (!modal) { resolve(false); return; }
            const deviceInfo = getDeviceInfo();
            const descEl = modal.querySelector('.warning-modal-content');
            if (descEl) {
                const resLabel  = (w > 0 && h > 0) ? `${w}×${h}` : 'N/A';
                const fpsLabel  = fps ? `${fps} fps` : 'N/A';
                const sizeLabel = `${fileMB.toFixed(1)} MB`;
                let aspectRatio = 'N/A';
                if (w > 0 && h > 0) {
                    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                    const d   = gcd(w, h);
                    aspectRatio = `${w / d}:${h / d}`;
                }
                descEl.innerHTML = window.getTranslation('compress_oom_desc') +
                    `<a href="https://play.google.com/store/apps/details?id=com.pandavideocompressor&hl=en&pli=1" target="_blank" rel="noopener" class="oom-app-card"><img src="https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/4f/86/d8/4f86d827-1ace-22c0-2ced-e4c3d172eecf/Placeholder.mill/200x200bb-75.webp" class="oom-app-icon" alt="Panda"><div class="oom-app-info"><div class="oom-app-name">Panda Video Compress &amp; Convert</div><div class="oom-app-tag">Mobile</div></div><span class="material-symbols-rounded oom-app-arrow">open_in_new</span></a>` +
                    `<a href="https://handbrake.fr/" target="_blank" rel="noopener" class="oom-app-card"><img src="https://user-images.githubusercontent.com/21181118/90317679-9b8bde00-df1a-11ea-9fe3-6c2df9dc5638.png" class="oom-app-icon oom-app-icon-contain" alt="HandBrake"><div class="oom-app-info"><div class="oom-app-name">HandBrake</div><div class="oom-app-tag">Desktop</div></div><span class="material-symbols-rounded oom-app-arrow">open_in_new</span></a>` +
                    `<div class="oom-info-grid">` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">smartphone</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_device')}</div><div class="oom-info-value">${deviceInfo.deviceType}</div></div></div>` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">developer_board</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_cpu')}</div><div class="oom-info-value">${deviceInfo.cpuCores} cores</div></div></div>` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">video_file</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_filesize')}</div><div class="oom-info-value">${sizeLabel}</div></div></div>` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">speed</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_fps')}</div><div class="oom-info-value">${fpsLabel}</div></div></div>` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">aspect_ratio</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_resolution')}</div><div class="oom-info-value">${resLabel}</div></div></div>` +
                    `<div class="oom-info-item"><span class="material-symbols-rounded oom-info-icon">crop</span><div><div class="oom-info-label">${window.getTranslation('compress_oom_aspect')}</div><div class="oom-info-value">${aspectRatio}</div></div></div>` +
                    `</div>`;
            }
            if (typeof window.applyTranslations === 'function') window.applyTranslations();
            modal.classList.remove('hidden');
            modal.classList.add('visible');
            const close = (result) => {
                modal.classList.remove('visible');
                modal.classList.add('hidden');
                resolve(result);
            };
            btnCancel.onclick  = () => close(false);
            btnProceed.onclick = () => close(true);
        });
    }
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    function log(msg) {
        const ts   = new Date().toISOString().replace('T', ' ').replace('Z', '');
        const line = `[${ts}] ${msg}`;
        console.log(line);
        if (logsEl) {
            logsEl.textContent += line + '\n';
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }
    function logSection(title) { log(`== ${title} ==`); }
    function logEnd() { log(''); }
    function appendToLogsEl(message) {
        if (!logsEl) return;
        const lines = logsEl.textContent.split('\n');
        lines.push(message);
        if (lines.length > 150) {
            logsEl.textContent = lines.slice(lines.length - 150).join('\n');
        } else {
            logsEl.textContent = lines.join('\n');
        }
        logsEl.scrollTop = logsEl.scrollHeight;
    }
    function computeVideoProcessingOptions(w, h, fps, fileMB, targetQuality = '1080p') {
        const maxShort = (targetQuality === '720p') ? 720 : 1080;
        const maxLong  = (targetQuality === '720p') ? 1280 : 1920;
        let scaleFilter    = `scale='if(gt(iw,ih),min(iw,${maxLong}),min(iw,${maxShort}))':'-2'`;
        let resNeedsCompress = false;
        let targetW = w, targetH = h;

        if (w > 0 && h > 0) {
            const shortSide = Math.min(w, h);
            const longSide  = Math.max(w, h);
            if (shortSide > maxShort || longSide > maxLong) {
                resNeedsCompress = true;
                const scaleFactor = Math.min(maxShort / shortSide, maxLong / longSide);
                targetW      = Math.floor((w * scaleFactor) / 2) * 2;
                targetH      = Math.floor((h * scaleFactor) / 2) * 2;
                scaleFilter  = `scale=${targetW}:${targetH}`;
            } else {
                scaleFilter  = "scale='trunc(iw/2)*2':'trunc(ih/2)*2'";
            }
        }
        let targetFps       = null;
        let fpsNeedsCompress = false;
        let isFractional    = false;
        if (fps !== null && fps > 0) {
            if (fps > 120) {
                targetFps        = 120;
                fpsNeedsCompress = true;
            } else if (!Number.isInteger(fps) || Math.abs(fps - Math.round(fps)) > 0.05) {
                fpsNeedsCompress = true;
                isFractional     = true;
                const rounded    = Math.round(fps);
                if (Math.abs(fps - 59.0) < 2 || Math.abs(fps - 60.0) < 2)   targetFps = 60;
                else if (Math.abs(fps - 29.97) < 1 || Math.abs(fps - 30.0) < 1) targetFps = 30;
                else if (Math.abs(fps - 23.976) < 1 || Math.abs(fps - 24.0) < 1) targetFps = 24;
                else targetFps = rounded;
            }
        }
        const vfParts = [scaleFilter];
        if (targetFps) vfParts.push(`fps=fps=${targetFps}:round=near`);
        return { scaleFilter, vfString: vfParts.join(','), resNeedsCompress, fpsNeedsCompress, isFractional, targetW, targetH, targetFps };
    }
    function detectBrowser() {
        const ua = navigator.userAgent;
        if (/CriOS/i.test(ua))  return 'Chrome (iOS)';
        if (/FxiOS/i.test(ua))  return 'Firefox (iOS)';
        if (/EdgiOS/i.test(ua)) return 'Edge (iOS)';
        if (/OPiOS/i.test(ua))  return 'Opera (iOS)';
        if (/EdgA/i.test(ua))   return 'Edge (Android)';
        if (/SamsungBrowser/i.test(ua)) return 'Samsung Browser';
        if (/OPR|Opera/i.test(ua))      return 'Opera';
        if (/Edg/i.test(ua))            return 'Edge';
        if (/YaBrowser/i.test(ua))      return 'Yandex';
        if (/Firefox/i.test(ua))        return 'Firefox';
        if (/Chrome/i.test(ua))         return 'Chrome';
        if (/Safari/i.test(ua))         return 'Safari';
        return 'Unknown Browser';
    }
    function detectOS() {
        const ua = navigator.userAgent;
        if (/iPhone/i.test(ua))  return `iOS iPhone (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g, '.') || '?'})`;
        if (/iPad/i.test(ua))    return `iOS iPad (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g, '.') || '?'})`;
        if (/Android/i.test(ua)) return `Android ${(ua.match(/Android ([\d.]+)/) || [])[1] || '?'}`;
        if (/Windows NT/i.test(ua)) {
            const v   = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
            const map = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
            return `Windows ${map[v] || v || '?'}`;
        }
        if (/Mac OS X/i.test(ua)) return `macOS ${(ua.match(/Mac OS X ([\d_]+)/) || [])[1]?.replace(/_/g, '.') || '?'}`;
        if (/Linux/i.test(ua))    return 'Linux';
        return 'Unknown OS';
    }
    function isIosDevice() {
        const ua       = navigator.userAgent || navigator.vendor || window.opera || '';
        const platform = navigator.platform || '';
        if (/iPhone|iPad|iPod|VisionPro|CriOS|FxiOS|EdgiOS|OPiOS|iPhone OS|iPadOS/i.test(ua)) return true;
        if (/iPhone|iPad|iPod/i.test(platform)) return true;
        if ((platform === 'MacIntel' || ua.includes('Macintosh')) && (navigator.maxTouchPoints > 1)) return true;
        return false;
    }
    function showIosWarningModal(onProceed, onCancel) {
        const iosWarningModal    = document.getElementById('tiktok-ios-warning-modal');
        const btnIosWarningCancel  = document.getElementById('btn-ios-warning-cancel');
        const btnIosWarningProceed = document.getElementById('btn-ios-warning-proceed');
        if (!iosWarningModal) { if (onProceed) onProceed(); return; }
        if (typeof window.applyTranslations === 'function') window.applyTranslations();
        iosWarningModal.classList.remove('hidden');
        iosWarningModal.classList.add('visible');
        const handleProceed = () => {
            iosWarningModal.classList.remove('visible');
            iosWarningModal.classList.add('hidden');
            if (btnIosWarningProceed) btnIosWarningProceed.removeEventListener('click', handleProceed);
            if (btnIosWarningCancel)  btnIosWarningCancel.removeEventListener('click', handleCancel);
            if (onProceed) onProceed();
        };
        const handleCancel = () => {
            iosWarningModal.classList.remove('visible');
            iosWarningModal.classList.add('hidden');
            if (btnIosWarningProceed) btnIosWarningProceed.removeEventListener('click', handleProceed);
            if (btnIosWarningCancel)  btnIosWarningCancel.removeEventListener('click', handleCancel);
            if (onCancel) onCancel();
        };
        if (btnIosWarningProceed && btnIosWarningCancel) {
            btnIosWarningProceed.onclick = handleProceed;
            btnIosWarningCancel.onclick  = handleCancel;
        } else {
            if (onProceed) onProceed();
        }
    }
    let adConsentShown = false;
    function showAdConsentModal() {
        const modal      = document.getElementById('ad-consent-modal');
        const btnAccept  = document.getElementById('btn-ad-accept');
        const btnDecline = document.getElementById('btn-ad-decline');
        if (!modal || adConsentShown) return;
        adConsentShown = true;
        if (typeof window.applyTranslations === 'function') window.applyTranslations();
        modal.classList.remove('hidden');
        modal.classList.add('visible');
        const close = () => { modal.classList.remove('visible'); modal.classList.add('hidden'); };
        btnDecline.onclick = close;
        btnAccept.onclick  = () => { close(); window.open('https://saweria.co/cutefishaep', '_blank'); };
    }
    function closeAdConsentModal() {
        const modal = document.getElementById('ad-consent-modal');
        if (modal) { modal.classList.remove('visible'); modal.classList.add('hidden'); }
    }
    function showUploadGuideModal(filename) {
        const modal    = document.getElementById('tiktok-upload-guide-modal');
        const body     = document.getElementById('upload-guide-body');
        const btnClose  = document.getElementById('btn-upload-guide-close');
        const btnUpload = document.getElementById('btn-upload-guide-upload');
        if (!modal) return;
        if (typeof window.translateUI === 'function') window.translateUI();
        const html     = window.getTranslation('upload_guide_body');
        const safeName = filename ? escapeHTML(filename) : '';
        body.innerHTML = html.replace(/\{filename\}/g, safeName);
        modal.classList.remove('hidden');
        modal.classList.add('visible');
        const close = () => { modal.classList.remove('visible'); modal.classList.add('hidden'); };
        btnClose.onclick  = close;
        btnUpload.onclick = () => { close(); window.open('https://www.tiktok.com/tiktokstudio/upload', '_blank', 'noopener'); };
    }
    window.addEventListener('error', (e) => {
        if (!logsEl || logsEl.textContent === '') return;
        logSection('UNCAUGHT ERROR');
        log(`  Message : ${e.message}`);
        log(`  Source  : ${e.filename || 'unknown'}`);
        log(`  Line    : ${e.lineno}:${e.colno}`);
        if (e.error && e.error.stack) e.error.stack.split('\n').slice(0, 5).forEach(l => log(`  Stack   : ${l.trim()}`));
        logEnd();
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (!logsEl || logsEl.textContent === '') return;
        logSection('UNHANDLED PROMISE REJECTION');
        const reason = e.reason;
        if (reason instanceof Error) {
            log(`  Message : ${reason.message}`);
            if (reason.stack) reason.stack.split('\n').slice(0, 5).forEach(l => log(`  Stack   : ${l.trim()}`));
        } else {
            log(`  Reason  : ${String(reason)}`);
        }
        logEnd();
    });
    const btnCopyLogs      = document.getElementById('btn-copy-logs');
    const btnCopyLogsLabel = document.getElementById('btn-copy-logs-label');
    if (btnCopyLogs) {
        btnCopyLogs.addEventListener('mouseenter', () => { btnCopyLogs.style.background = 'var(--md-sys-color-surface-container-high)'; });
        btnCopyLogs.addEventListener('mouseleave', () => { btnCopyLogs.style.background = 'none'; });
        btnCopyLogs.addEventListener('click', async () => {
            const text = logsEl ? logsEl.textContent : '';
            if (!text.trim()) return;
            const icon = btnCopyLogs.querySelector('.material-symbols-rounded');
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
                    document.body.appendChild(ta);
                    ta.focus(); ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                }
                if (icon) icon.textContent = 'check';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Copied!';
                btnCopyLogs.style.color = 'var(--md-sys-color-primary)';
            } catch (err) {
                if (icon) icon.textContent = 'error';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Failed';
                btnCopyLogs.style.color = 'var(--md-sys-color-error)';
            }
            setTimeout(() => {
                if (icon) icon.textContent = 'content_copy';
                if (btnCopyLogsLabel) btnCopyLogsLabel.textContent = 'Copy';
                btnCopyLogs.style.color = '';
            }, 2000);
        });
    }
    function updateSwitchIndicator(trackEl, indicatorEl, activeClass) {
        if (!trackEl || !indicatorEl) return;
        const active = trackEl.querySelector(`.${activeClass}.active`);
        if (active) {
            const w = active.offsetWidth;
            const l = active.offsetLeft;
            if (w > 0) {
                indicatorEl.style.left  = l + 'px';
                indicatorEl.style.width = w + 'px';
            } else {
                const options = Array.from(trackEl.querySelectorAll(`.${activeClass}`));
                const idx     = options.indexOf(active);
                const count   = options.length || 2;
                const pct     = 100 / count;
                indicatorEl.style.left  = `calc(${idx * pct}% + 4px)`;
                indicatorEl.style.width = `calc(${pct}% - 8px)`;
            }
        }
    }
    const patcherCard      = document.getElementById('tiktok-patcher-card');
    const patchedOverlay   = document.getElementById('tiktok-patched-overlay');
    const btnOverlayIgnore = document.getElementById('btn-patched-overlay-ignore');
    const v1Patched = patcherCard?.dataset.v1Patched === 'true';
    if (v1Patched && patchedOverlay) {
        patchedOverlay.style.display = 'flex';
    }
    if (btnOverlayIgnore && patchedOverlay) {
        btnOverlayIgnore.addEventListener('click', () => {
            patchedOverlay.style.opacity   = '0';
            patchedOverlay.style.transition = 'opacity 0.3s ease';
            setTimeout(() => { patchedOverlay.style.display = 'none'; }, 300);
        });
        btnOverlayIgnore.addEventListener('mouseenter', () => { btnOverlayIgnore.style.background = 'rgba(255,255,255,0.22)'; });
        btnOverlayIgnore.addEventListener('mouseleave', () => { btnOverlayIgnore.style.background = 'rgba(255,255,255,0.1)'; });
    }
    function updateUnifiedInfoCard() {
        const descPanel = document.getElementById('tiktok-info-desc') || document.getElementById('tiktok-mode-desc');
        if (!descPanel) return;
        let i18nKey = '';
        if (currentVersion === 'v1') {
            i18nKey = 'patcher_desc_wmv';
        } else if (currentVersion === 'fps') {
            i18nKey = 'patcher_desc_fps';
        } else {
            const normMode = (compressMode === '720p' || compressMode === '1080p') ? compressMode : 'off';
            i18nKey = 'patcher_desc_binary_' + normMode;
        }
        descPanel.style.opacity = '0';
        setTimeout(() => {
            descPanel.innerHTML = (window.getTranslation && window.getTranslation(i18nKey)) || '';
            descPanel.style.opacity = '1';
        }, 120);
    }

    function updateMethodIndicator(version) {
        if (!versionSwitch) return;
        currentVersion = version;
        versionSwitch.querySelectorAll('.tiktok-switch-option').forEach(b => b.classList.toggle('active', b.dataset.version === version));
        const ind = document.getElementById('tiktok-version-indicator');
        updateSwitchIndicator(versionSwitch, ind, 'tiktok-switch-option');
        if (compressToggleRow) {
            if (currentVersion === 'v3') {
                compressToggleRow.classList.remove('hidden');
                compressToggleRow.style.display = 'block';
                requestAnimationFrame(() => updateModeIndicator(compressMode));
            } else {
                compressToggleRow.classList.add('hidden');
                compressToggleRow.style.display = 'none';
            }
        }
        updateUnifiedInfoCard();
    }

    if (versionSwitch) {
        versionSwitch.addEventListener('click', (e) => {
            const btn = e.target.closest('.tiktok-switch-option');
            if (!btn || isProcessing) return;
            const clickedVersion = btn.dataset.version;
            const doSwitch = (version) => {
                updateMethodIndicator(version);
            };
            if (isIosDevice() && clickedVersion === 'v1') {
                showIosWarningModal(() => doSwitch(clickedVersion), () => {});
            } else {
                doSwitch(clickedVersion);
            }
        });
        requestAnimationFrame(() => {
            updateMethodIndicator(currentVersion);
        });
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.getAttribute('data-tab') === 'tools') {
                    setTimeout(() => {
                        const ind = document.getElementById('tiktok-version-indicator');
                        updateSwitchIndicator(versionSwitch, ind, 'tiktok-switch-option');
                        updateModeIndicator(compressMode);
                    }, 50);
                }
            });
        });
        window.addEventListener('resize', () => {
            const ind = document.getElementById('tiktok-version-indicator');
            updateSwitchIndicator(versionSwitch, ind, 'tiktok-switch-option');
            updateModeIndicator(compressMode);
        });
    }
    function checkIfSelectedFileRequiresCompress() {
        if (!selectedFile) return false;
        const fileMB = selectedFile.size / (1024 * 1024);
        if (fileMB > COMPRESS_WARN_MB) return true;
        let fps = null, w = 0, h = 0;
        if (currentFileBuffer) {
            try {
                fps = parseFpsFromMp4(currentFileBuffer);
                const res = parseResolutionFromMp4(currentFileBuffer);
                if (res) { w = res.width; h = res.height; }
            } catch (e) {}
        }
        const opts = computeVideoProcessingOptions(w, h, fps, fileMB);
        return opts.resNeedsCompress || opts.fpsNeedsCompress || fileMB > COMPRESS_WARN_MB;
    }
    if (compressModeSelector) {
        compressModeSelector.addEventListener('click', (e) => {
            const option = e.target.closest('.tiktok-switch-option');
            if (!option || isProcessing) return;
            const targetMode = option.dataset.mode;
            if (targetMode === 'off' && checkIfSelectedFileRequiresCompress()) {
                showStatusError(window.getTranslation('tktk_err_mode_off') || 'Mode OFF tidak dapat digunakan untuk video ini');
                setCompressMode('1080p');
                return;
            }
            compressMode = targetMode;
            updateModeIndicator(compressMode);
        });
    }
    function updateModeIndicator(mode) {
        if (!compressModeSelector) return;
        const normalizedMode = (mode === '720p' || mode === '1080p') ? mode : ((mode === 'on' || mode === 'hd') ? '1080p' : 'off');
        compressMode = normalizedMode;
        const indicator = document.getElementById('tiktok-mode-indicator');
        compressModeSelector.querySelectorAll('.tiktok-switch-option').forEach(c => c.classList.toggle('active', c.dataset.mode === normalizedMode));
        const refreshPill = () => updateSwitchIndicator(compressModeSelector, indicator, 'tiktok-switch-option');
        refreshPill();
        requestAnimationFrame(refreshPill);
        setTimeout(refreshPill, 50);
        setTimeout(refreshPill, 150);
        setTimeout(refreshPill, 350);
        updateUnifiedInfoCard();
    }
    window.addEventListener('load', () => {
        updateMethodIndicator(currentVersion);
        updateModeIndicator(compressMode);
    });
    function setCompressMode(mode) {
        compressMode = mode;
        updateModeIndicator(mode);
    }
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
    });
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background  = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background  = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background  = '';
        if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
    });
    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }
    function resetToolState() {
        selectedFile      = null;
        currentFileBuffer = null;
        fileInput.value   = '';
        statusText.innerHTML = '';
        btnStart.classList.add('hidden');
        progressContainer.classList.add('hidden');
        progressFill.style.width  = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent  = window.getTranslation('status_processing');
        logsContainer.classList.add('hidden');
        logsEl.textContent        = '';
        dropArea.style.borderColor = '';
        dropArea.style.background  = '';
    }
    async function clearAllToolCache() {
        if (isProcessing) return;
        resetToolState();
        if (btnClearCache) {
            btnClearCache.disabled = true;
            const icon = btnClearCache.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.5s ease';
                icon.style.transform  = 'rotate(360deg) scale(1.2)';
            }
        }
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary); font-weight: bold;">&#10003; Cache cleared. Reloading...</span>`;
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) await reg.unregister();
            } catch (e) {}
        }
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {}
        }
        try {
            sessionStorage.clear();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('tiktok') || key.includes('ffmpeg') || key.includes('cache'))) keysToRemove.push(key);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        currentFileBuffer = null;
        selectedFile      = null;
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }
    const btnClearCache = document.getElementById('btn-tiktok-clear-cache');
    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => clearAllToolCache());
        btnClearCache.addEventListener('mouseenter', () => { btnClearCache.style.background = 'var(--md-sys-color-surface-container-high)'; });
        btnClearCache.addEventListener('mouseleave', () => { btnClearCache.style.background = 'none'; });
    }
    async function handleFileSelection(file) {
        if (!file.type.startsWith('video/')) {
            showStatusError('Please select a valid video file.');
            btnStart.classList.add('hidden');
            return;
        }
        const fileMB = file.size / (1024 * 1024);
        if (fileMB > MAX_FILE_MB_HARD) {
            showStatusError(`File is too large (${fileMB.toFixed(1)} MB). Max limit is ${MAX_FILE_MB_HARD} MB.`);
            btnStart.classList.add('hidden');
            selectedFile = null;
            return;
        }
        selectedFile = file;
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Selected: ${escapeHTML(file.name)} (${fileMB.toFixed(2)} MB)</span>`;
        if (isIosDevice() && currentVersion === 'v1') {
            btnStart.classList.add('hidden');
            showStatusError(window.getTranslation('ios_not_supported_err') || 'Perangkat iOS tidak didukung. Silakan gunakan PC (Windows/macOS) atau Android.');
            showIosWarningModal(() => {}, () => { resetToolState(); });
            return;
        }
        btnStart.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
        try {
            currentFileBuffer = await readFileAsArrayBuffer(file);
            await runAnalysis(file, currentFileBuffer);
        } catch (err) {
            console.error('Error reading buffer for analysis:', err);
        }
    }
    function setCheckState(iconEl, itemEl, state, valueText) {
        const iconMap = { loading: 'progress_activity', pass: 'check', fail: 'close', warn: 'warning' };
        iconEl.className = `tktk-check-icon ${state}`;
        iconEl.innerHTML = `<span class="material-symbols-rounded">${iconMap[state]}</span>`;
        itemEl.className = `tktk-check-item ${state === 'loading' ? '' : state}`;
        const valEl = itemEl.querySelector('.tktk-check-value');
        if (valEl && valueText !== undefined) valEl.textContent = valueText;
    }
    function openAnalysisModal() {
        if (typeof window.translateUI === 'function') window.translateUI();
        const analyzingText = (window.getTranslation && window.getTranslation('tktk_val_analyzing')) || 'Analyzing...';
        setCheckState(tktk.iconFps,  tktk.checkFps,  'loading', analyzingText);
        setCheckState(tktk.iconRes,  tktk.checkRes,  'loading', analyzingText);
        setCheckState(tktk.iconSize, tktk.checkSize, 'loading', analyzingText);
        tktk.btnProceed.disabled = true;
        tktk.btnProceed.style.display = '';
        analysisModal.classList.remove('hidden');
        analysisModal.classList.add('visible');
    }
    function closeAnalysisModal() {
        analysisModal.classList.remove('visible');
        analysisModal.classList.add('hidden');
    }
    async function runAnalysis(file, buffer) {
        openAnalysisModal();
        const targetBuffer = buffer || currentFileBuffer;
        const fileMB = file.size / (1024 * 1024);
        let fps = null, w = 0, h = 0, hasFail = false;
        try {
            if (targetBuffer) {
                fps = parseFpsFromMp4(targetBuffer);
                const res = parseResolutionFromMp4(targetBuffer);
                if (res) { w = res.width; h = res.height; }
            }
        } catch (e) {}
        if (w === 0 || h === 0 || fps === null) {
            await new Promise(resolve => {
                const url = URL.createObjectURL(file);
                const vid = document.createElement('video');
                vid.preload = 'metadata'; vid.muted = true; vid.src = url;
                const done = () => { URL.revokeObjectURL(url); resolve(); };
                vid.onloadedmetadata = () => {
                    if (vid.videoWidth && vid.videoHeight) { w = vid.videoWidth; h = vid.videoHeight; }
                    if (fps === null && vid.duration > 0) {
                        fps = ('mozParsedFrames' in vid && vid.mozParsedFrames > 0)
                            ? Math.round(vid.mozParsedFrames / vid.duration) : 60;
                    }
                    done();
                };
                vid.onerror = done;
                setTimeout(done, 2000);
                vid.load();
            });
        }
        const options   = computeVideoProcessingOptions(w, h, fps, fileMB);
        const fpsFail   = (fps !== null && fps > 120) || options.isFractional;
        const fpsLabel  = fps !== null ? `${fps} fps` : 'Unable to detect';
        setCheckState(tktk.iconFps, tktk.checkFps, fpsFail ? (options.isFractional ? 'warn' : 'fail') : 'pass', fpsLabel);
        if (fpsFail) {
            const errFpsEl = document.getElementById('tktk-err-fps');
            if (errFpsEl) {
                if (options.isFractional) {
                    const template = (window.getTranslation && window.getTranslation('tktk_err_fps_fractional'))
                        || 'FPS tidak bulat ({fps} fps). Akan dinormalisasi ke {target} fps.';
                    errFpsEl.textContent = template.replace('{fps}', fps).replace('{target}', options.targetFps);
                } else {
                    errFpsEl.textContent = (window.getTranslation && window.getTranslation('tktk_err_fps_over120'))
                        || 'FPS melebihi 120 fps (maks 120 fps). Harus dikompresi.';
                }
            }
        }
        const resFail  = options.resNeedsCompress;
        const resLabel = w > 0 ? `${w}x${h}` : 'Unable to detect';
        setCheckState(tktk.iconRes, tktk.checkRes, w === 0 ? 'pass' : (resFail ? 'fail' : 'pass'), resLabel);
        if (resFail) {
            const errResEl = document.getElementById('tktk-err-res');
            if (errResEl) {
                const template = (window.getTranslation && window.getTranslation('tktk_err_res_2k'))
                    || 'Resolusi melebihi 1080p ({res}). Wajib dikompresi dan disesuaikan ke 1080p.';
                errResEl.textContent = template.replace('{res}', `${w}x${h}`);
            }
        }
        hasFail = fpsFail || resFail;
        const sizeFail = fileMB > COMPRESS_WARN_MB;
        setCheckState(tktk.iconSize, tktk.checkSize, sizeFail ? 'warn' : 'pass', `${fileMB.toFixed(1)} MB`);
        if (sizeFail) {
            hasFail = true;
            const errSizeEl = document.getElementById('tktk-err-size');
            if (errSizeEl) {
                errSizeEl.textContent = (window.getTranslation && window.getTranslation('tktk_err_size_30mb'))
                    || 'Ukuran file melebihi batas aman 50 MB. Otomatis menggunakan Compress 1080p.';
            }
        }
        if (fileMB > COMPRESS_WARN_MB) setCompressMode('1080p');
        if (!hasFail) {
            closeAnalysisModal();
            btnStart.classList.remove('hidden');
            btnStart.disabled = false;
            return;
        }
        btnStart.classList.add('hidden');
        btnStart.disabled = true;
        tktk.btnProceed.disabled = false;
        tktk.btnProceed.style.display = '';
    }
    if (tktk.btnCancel) {
        tktk.btnCancel.addEventListener('click', () => {
            closeAnalysisModal();
            selectedFile      = null;
            currentFileBuffer = null;
            btnStart.classList.add('hidden');
            statusText.innerHTML = '';
        });
    }
    if (tktk.btnProceed) {
        tktk.btnProceed.addEventListener('click', async () => {
            closeAnalysisModal();
            let fps = null, w = 0, h = 0;
            if (currentFileBuffer) {
                try {
                    fps = parseFpsFromMp4(currentFileBuffer);
                    const res = parseResolutionFromMp4(currentFileBuffer);
                    if (res) { w = res.width; h = res.height; }
                } catch (e) {}
            }
            if (w === 0 || h === 0 || fps === null) {
                await new Promise(resolve => {
                    const url = URL.createObjectURL(selectedFile);
                    const vid = document.createElement('video');
                    vid.preload = 'metadata'; vid.muted = true; vid.src = url;
                    const done = () => { URL.revokeObjectURL(url); resolve(); };
                    vid.onloadedmetadata = () => {
                        if (vid.videoWidth && vid.videoHeight) { w = vid.videoWidth; h = vid.videoHeight; }
                        if (fps === null && vid.duration > 0) {
                            fps = ('mozParsedFrames' in vid && vid.mozParsedFrames > 0)
                                ? Math.round(vid.mozParsedFrames / vid.duration) : 60;
                        }
                        done();
                    };
                    vid.onerror = done;
                    setTimeout(done, 2000);
                    vid.load();
                });
            }
            const fileMB = selectedFile ? (selectedFile.size / (1024 * 1024)) : 0;
            const opts   = computeVideoProcessingOptions(w, h, fps, fileMB);
            if (opts.resNeedsCompress || opts.fpsNeedsCompress || fileMB > COMPRESS_WARN_MB) setCompressMode('1080p');
            const isMobile  = isMobileDevice();
            const threshold = isMobile ? MOBILE_OOM_THRESHOLD_MB : PC_OOM_THRESHOLD_MB;
            if (fileMB > threshold) {
                showCompressOomWarning(fileMB, fps, w, h).then((proceed) => {
                    if (proceed) {
                        btnStart.classList.remove('hidden');
                        btnStart.disabled = false;
                        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary); font-weight: 500;">Ready to Process</span>`;
                    } else {
                        selectedFile = null; currentFileBuffer = null;
                        btnStart.classList.add('hidden');
                        statusText.innerHTML = '';
                    }
                });
                return;
            }
            btnStart.classList.remove('hidden');
            btnStart.disabled = false;
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary); font-weight: 500;">Ready to Process</span>`;
        });
    }
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read video file.'));
            reader.readAsArrayBuffer(file);
        });
    }
    function checkIosWarningAndProceed(onProceed) {
        if (isIosDevice() && currentVersion === 'v1') {
            btnStart.classList.add('hidden');
            progressContainer.classList.add('hidden');
            logsContainer.classList.add('hidden');
            showStatusError(window.getTranslation('ios_not_supported_err') || 'Perangkat iOS tidak didukung. Silakan gunakan PC (Windows/macOS) atau Android.');
            isProcessing = false;
            showIosWarningModal(() => {}, () => { resetToolState(); });
            return;
        }
        onProceed();
    }
    function parseFpsFromMp4(arrayBuffer) {
        try {
            const srcArr = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
            const fresh  = new Uint8Array(srcArr.byteLength);
            fresh.set(srcArr);
            const data = fresh;
            const view = new DataView(data.buffer);
            const topLevel  = _coordParseBoxes(data, view, 0, data.length, '');
            const moov      = _coordFindTopLevel(topLevel, 'moov');
            if (!moov) return null;
            const traks = moov.children.filter(c => c.type === 'trak');
            if (!traks || traks.length === 0) return null;
            let videoTrak = traks.find(c => {
                const ht = _coordHandlerTypeForTrak(c);
                if (ht === 'vide') return true;
                const stsd = _coordFindDescendant(c, ['mdia', 'minf', 'stbl', 'stsd']);
                if (stsd && stsd.children) return stsd.children.some(entry => ['avc1', 'hvc1', 'hev1', 'mp4v', 'vp09', 'av01'].includes(entry.type));
                return false;
            }) || traks[0];
            if (!videoTrak) return null;
            const mdhd = _coordFindDescendant(videoTrak, ['mdia', 'mdhd']);
            const stbl = _coordFindDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
            if (!mdhd || !stbl) return null;
            const mdhdPayload = _coordBoxPayload(mdhd);
            const version = mdhdPayload[0];
            let timescale = 0, duration = 0;
            if (version === 0) { timescale = _coordReadU32BE(mdhdPayload, 12); duration = _coordReadU32BE(mdhdPayload, 16); }
            else if (version === 1) {
                timescale = _coordReadU32BE(mdhdPayload, 20);
                duration  = _coordReadU32BE(mdhdPayload, 24) * 4294967296 + _coordReadU32BE(mdhdPayload, 28);
            }
            if (!timescale) return null;
            const stts = _coordFindChild(stbl, 'stts');
            if (stts) {
                const sttsPayload = _coordBoxPayload(stts);
                const entryCount  = _coordReadU32BE(sttsPayload, 4);
                let totalSamples  = 0, totalTicks = 0;
                for (let i = 0; i < entryCount; i++) {
                    const sc = _coordReadU32BE(sttsPayload, 8 + i * 8);
                    const sd = _coordReadU32BE(sttsPayload, 12 + i * 8);
                    totalSamples += sc; totalTicks += sc * sd;
                }
                if (totalSamples > 0 && totalTicks > 0)
                    return Math.round((totalSamples * timescale / totalTicks) * 1000) / 1000;
            }
            const stsz = _coordFindChild(stbl, 'stsz');
            if (stsz && duration > 0) {
                const durationSec = duration / timescale;
                const frameCount  = _coordReadU32BE(_coordBoxPayload(stsz), 4);
                if (frameCount && durationSec > 0)
                    return Math.round((frameCount / durationSec) * 1000) / 1000;
            }
            return null;
        } catch (e) { console.error('parseFpsFromMp4 error:', e); return null; }
    }
    function parseResolutionFromMp4(arrayBuffer) {
        try {
            const srcArr = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
            const fresh  = new Uint8Array(srcArr.byteLength);
            fresh.set(srcArr);
            const data = fresh;
            const view = new DataView(data.buffer);
            const topLevel  = _coordParseBoxes(data, view, 0, data.length, '');
            const moov      = _coordFindTopLevel(topLevel, 'moov');
            if (!moov) return null;
            const videoTrak = moov.children.find(c => c.type === 'trak' && _coordHandlerTypeForTrak(c) === 'vide');
            if (!videoTrak) return null;
            const stsd = _coordFindDescendant(videoTrak, ['mdia', 'minf', 'stbl', 'stsd']);
            if (stsd) {
                const entryCount = stsd.view.getUint32(stsd.offset + 12, false);
                if (entryCount >= 1) {
                    const entryOffset = stsd.offset + 16;
                    if (entryOffset + 36 <= stsd.end) {
                        let width  = stsd.view.getUint16(entryOffset + 32, false);
                        let height = stsd.view.getUint16(entryOffset + 34, false);
                        if (!width || !height) { width = stsd.view.getUint16(entryOffset + 24, false); height = stsd.view.getUint16(entryOffset + 26, false); }
                        if (width > 0 && height > 0) return { width, height };
                    }
                }
            }
            const tkhd = _coordFindChild(videoTrak, 'tkhd');
            if (tkhd) {
                const tkhdPayload = _coordBoxPayload(tkhd);
                const version = tkhdPayload[0];
                let width = 0, height = 0;
                if (version === 0) { width = _coordReadU32BE(tkhdPayload, 72) >>> 16; height = _coordReadU32BE(tkhdPayload, 76) >>> 16; }
                else if (version === 1) { width = _coordReadU32BE(tkhdPayload, 80) >>> 16; height = _coordReadU32BE(tkhdPayload, 84) >>> 16; }
                if (width > 0 && height > 0) return { width, height };
            }
        } catch (e) { console.error('Failed to parse resolution from MP4 box', e); }
        return null;
    }

    function _coordGetBoxType(data, offset) {
        return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }
    function _coordReadU32BE(arr, offset) {
        return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
    }
    function _coordBoxPayload(box) { return box.data.subarray(box.contentStart, box.end); }
    function _coordFindChild(box, type) { return box ? box.children.find(c => c.type === type) || null : null; }
    function _coordFindDescendant(box, typePath) {
        let cur = box;
        for (const t of typePath) { cur = _coordFindChild(cur, t); if (!cur) return null; }
        return cur;
    }
    function _coordFindTopLevel(boxes, type) { return boxes.find(b => b.type === type) || null; }
    function _coordHandlerTypeForTrak(trak) {
        const hdlr = _coordFindDescendant(trak, ['mdia', 'hdlr']);
        if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
        return _coordGetBoxType(hdlr.data, hdlr.offset + 16);
    }
    const _COORD_CONTAINER_BOXES = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'meta', 'ilst']);
    function _coordReadBox(view, data, offset, end, parentPath) {
        if (offset + 8 > end) return null;
        const smallSize = view.getUint32(offset, false);
        const type = _coordGetBoxType(data, offset + 4);
        let size = smallSize, headerSize = 8;
        if (smallSize === 1) {
            if (offset + 16 > end) return null;
            size = view.getUint32(offset + 8, false) * 4294967296 + view.getUint32(offset + 12, false);
            headerSize = 16;
        } else if (smallSize === 0) { size = end - offset; }
        if (size < headerSize || offset + size > end) return null;
        return { type, offset, size, headerSize, contentStart: offset + headerSize, end: offset + size,
            path: parentPath ? `${parentPath}/${type}` : type, data, view, children: [],
            prefixStart: offset + headerSize, prefixEnd: offset + headerSize };
    }
    function _coordParseBoxes(data, view, start, end, parentPath) {
        const boxes = []; let offset = start;
        while (offset + 8 <= end) {
            const box = _coordReadBox(view, data, offset, end, parentPath || '');
            if (!box) break;
            if (_COORD_CONTAINER_BOXES.has(box.type)) {
                const cs = box.type === 'meta' ? box.contentStart + 4 : box.contentStart;
                if (cs <= box.end) { box.prefixStart = box.contentStart; box.prefixEnd = cs; box.children = _coordParseBoxes(data, view, cs, box.end, box.path); }
            }
            boxes.push(box); offset = box.end;
        }
        return boxes;
    }
    async function loadFFmpegLibraries() {
        if (window.FFmpegWASM && window.FFmpegUtil) return true;
        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src    = src;
            s.onload  = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
        try {
            if (!window.FFmpegUtil) await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
            if (!window.FFmpegWASM) {
                const [ffmpegRes, workerRes] = await Promise.all([
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'),
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js')
                ]);
                if (!ffmpegRes.ok || !workerRes.ok) throw new Error('CDN HTTP response error');
                const ffmpegCode  = await ffmpegRes.text();
                const workerCode  = await workerRes.text();
                const workerBlobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
                const patchedCode   = ffmpegCode
                    .replace(/new Worker\(new URL\(e\.p\+e\.u\(814\),e\.b\),\{type:void 0\}\)/g, `new Worker("${workerBlobUrl}")`)
                    .replace(/u:e=>e\+"\.\x66\x66\x6d\x70\x65\x67\.\x6a\x73"/g, `u:()=>"${workerBlobUrl}"`)
                    .replace(/u:e=>e\+"\x2effmpeg\x2ejs"/g, `u:()=>"${workerBlobUrl}"`);
                await loadScript(URL.createObjectURL(new Blob([patchedCode], { type: 'text/javascript' })));
            }
            if (window.FFmpegWASM && window.FFmpegUtil) return true;
        } catch (cdnErr) { console.warn(cdnErr); }
        try {
            if (!window.FFmpegWASM) await loadScript('assets/ffmpeg/ffmpeg.js');
            if (!window.FFmpegUtil)  await loadScript('assets/ffmpeg/index.js');
            if (window.FFmpegWASM && window.FFmpegUtil) return true;
        } catch (localErr) { console.error(localErr); }
        return !!(window.FFmpegWASM && window.FFmpegUtil);
    }
    async function loadFFmpegHelper(ffmpeg, toBlobURL) {
        const cdnBaseMT  = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
        const cdnBaseST  = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const localBaseURL = window.location.origin + '/assets/ffmpeg';
        const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice();
        let loaded = false;
        logSection('FFmpeg Load');
        log(`  Multi-thread: ${isMultiThread}`);
        if (isMultiThread) {
            try {
                log(`  Attempting multi-thread load from CDN...`);
                await ffmpeg.load({
                    coreURL:   await toBlobURL(`${cdnBaseMT}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL:   await toBlobURL(`${cdnBaseMT}/ffmpeg-core.wasm`, 'application/wasm'),
                    workerURL: await toBlobURL(`${cdnBaseMT}/ffmpeg-core.worker.js`, 'text/javascript'),
                });
                loaded = true;
                log(`  Multi-thread load from CDN: SUCCESS`);
            } catch (err) {
                log(`  CDN multi-thread FAILED: ${err.message} — trying local`);
                try {
                    await ffmpeg.load({
                        coreURL:   await toBlobURL(`${localBaseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL:   await toBlobURL(`${localBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                        workerURL: await toBlobURL(`${localBaseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
                    });
                    loaded = true;
                    log(`  Local multi-thread load: SUCCESS`);
                } catch (localErr) { log(`  Local multi-thread FAILED: ${localErr.message} — falling back to single-thread`); }
            }
        }
        if (!loaded) {
            try {
                log(`  Loading single-thread FFmpeg from CDN...`);
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm'),
                });
                log(`  CDN Single-thread load: SUCCESS`);
            } catch (err) {
                log(`  CDN Single-thread FAILED: ${err.message} — using local`);
                await ffmpeg.load({
                    coreURL: await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm'),
                });
                log(`  Local Single-thread load: SUCCESS`);
            }
        }
        logEnd();
    }
    btnStart.addEventListener('click', async () => {
        if (!selectedFile) return;
        if (isProcessing) return;
        isProcessing = true;
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        logsEl.textContent = '';
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Reading file...</span>`;
        progressFill.style.width = '5%';
        progressPercent.textContent = '5%';
        progressText.textContent = 'Reading...';
        logSection('FILE READ');
        log(`  Name        : ${selectedFile.name}`);
        log(`  Size        : ${(selectedFile.size / (1024 * 1024)).toFixed(3)} MB (${selectedFile.size} bytes)`);
        log(`  MIME type   : ${selectedFile.type}`);
        log(`  Last modif  : ${new Date(selectedFile.lastModified).toISOString()}`);
        const methodLabel = currentVersion === 'v1' ? 'WMV' : (currentVersion === 'fps' ? 'FPS' : 'Binary');
        log(`  Method      : ${methodLabel}  |  Compress mode: ${compressMode}`);
        log(`  Browser     : ${detectBrowser()}`);
        log(`  OS          : ${detectOS()}`);
        log(`  Platform    : ${navigator.platform || 'unknown'}`);
        log(`  User-Agent  : ${navigator.userAgent}`);
        log(`  Threads(HW) : ${navigator.hardwareConcurrency || 'unknown'}`);
        log(`  SharedArrayBuffer: ${'SharedArrayBuffer' in window ? 'available (multi-thread)' : 'NOT available (single-thread)'}`);
        logEnd();
        try {
            currentFileBuffer = await readFileAsArrayBuffer(selectedFile);
            log(`  ArrayBuffer byteLength : ${currentFileBuffer.byteLength} bytes`);
            log(`  FileReader read        : SUCCESS`);
            const peek      = new Uint8Array(currentFileBuffer, 0, Math.min(12, currentFileBuffer.byteLength));
            const ftypMagic = String.fromCharCode(peek[4], peek[5], peek[6], peek[7]);
            log(`  Box[0] magic bytes    : ${ftypMagic} (expect: ftyp or mdat)`);
            logEnd();
        } catch (error) {
            log(`  FileReader ERROR: ${error.name} — ${error.message}`);
            logEnd();
            console.error(error);
            showStatusError(`Error reading file: ${error.message}`);
            btnStart.classList.remove('hidden');
            isProcessing = false;
            return;
        }
        isProcessing = false;
        const startProcess = async () => {
            isProcessing = false;
            adConsentShown = false;
            setTimeout(() => showAdConsentModal(), 1500);
            try {
                if (currentVersion === 'v1') {
                    await window.processVideoV1(selectedFile);
                    return;
                }
                if (currentVersion === 'fps') {
                    await window.processVideoFPS(selectedFile);
                    return;
                }
                await window.processVideoV3(selectedFile, compressMode);
            } finally {
                closeAdConsentModal();
            }
        };
        checkIosWarningAndProceed(startProcess);
    });

    window._tktk = {
        get isProcessing()     { return isProcessing; },
        set isProcessing(v)    { isProcessing = v; },
        get currentFileBuffer(){ return currentFileBuffer; },
        get compressMode()     { return compressMode; },
        get selectedFile()     { return selectedFile; },
        statusText,
        btnStart,
        progressContainer,
        progressFill,
        progressPercent,
        progressText,
        logsContainer,
        logsEl,
        log,
        logSection,
        logEnd,
        appendToLogsEl,
        escapeHTML,
        showStatusError,
        showUploadGuideModal,
        showAdConsentModal,
        closeAdConsentModal,
        loadFFmpegLibraries,
        loadFFmpegHelper,
        detectBrowser,
        detectOS,
        parseFpsFromMp4,
        parseResolutionFromMp4,
        computeVideoProcessingOptions,
        isMobileDevice,
        checkIfSelectedFileRequiresCompress,
        updateModeIndicator,
    };
});
