document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-tiktok-input');
    const dropArea = document.getElementById('tool-tiktok-drop');
    const statusText = document.getElementById('tool-tiktok-status');
    const btnStart = document.getElementById('btn-start-tiktok');
    const progressContainer = document.getElementById('tiktok-progress-container');
    const progressFill = document.getElementById('tiktok-progress-fill');
    const progressPercent = document.getElementById('tiktok-progress-percent');
    const progressText = document.getElementById('tiktok-progress-text');
    const logsContainer = document.getElementById('tiktok-logs-container');
    const logsEl = document.getElementById('tiktok-logs');
    const versionSwitch = document.getElementById('tiktok-version-switch');
    const compressToggleRow = document.getElementById('tiktok-compress-toggle-row');
    const compressModeSelector = document.getElementById('tiktok-compress-mode');
    const analysisModal = document.getElementById('tiktok-analysis-modal');
    const tktk = {
        checkFps:  document.getElementById('tktk-check-fps'),
        checkRes:  document.getElementById('tktk-check-res'),
        checkSize: document.getElementById('tktk-check-size'),
        iconFps:   document.getElementById('tktk-icon-fps'),
        iconRes:   document.getElementById('tktk-icon-res'),
        iconSize:  document.getElementById('tktk-icon-size'),
        valFps:    document.getElementById('tktk-val-fps'),
        valRes:    document.getElementById('tktk-val-res'),
        valSize:   document.getElementById('tktk-val-size'),
        btnCancel:  document.getElementById('tktk-btn-cancel'),
        btnProceed: document.getElementById('tktk-btn-proceed'),
        btnCompress: document.getElementById('tktk-btn-compress'),
    };
    let selectedFile = null;
    let currentFileBuffer = null;
    let isProcessing = false;
    let currentVersion = 'v3';
    let compressMode = 'off';
    const MAX_FILE_MB_HARD = 1500;
    const COMPRESS_WARN_MB = 50;
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
        const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
        const line = `[${ts}] ${msg}`;
        console.log(line);
        if (logsEl) {
            logsEl.textContent += line + '\n';
            logsEl.scrollTop = logsEl.scrollHeight;
        }
    }
    function logSection(title) {
        log(`== ${title} ==`);
    }
    function logEnd() {
        log('');
    }
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
        if (/iPhone/i.test(ua))  return `iOS iPhone (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g,'.') || '?'})`;
        if (/iPad/i.test(ua))    return `iOS iPad (${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g,'.') || '?'})`;
        if (/Android/i.test(ua)) return `Android ${(ua.match(/Android ([\d.]+)/) || [])[1] || '?'}`;
        if (/Windows NT/i.test(ua)) {
            const v = (ua.match(/Windows NT ([\d.]+)/) || [])[1];
            const map = {'10.0':'10/11','6.3':'8.1','6.2':'8','6.1':'7'};
            return `Windows ${map[v] || v || '?'}`;
        }
        if (/Mac OS X/i.test(ua)) return `macOS ${(ua.match(/Mac OS X ([\d_]+)/) || [])[1]?.replace(/_/g,'.') || '?'}`;
        if (/Linux/i.test(ua))    return 'Linux';
        return 'Unknown OS';
    }
    function isIosDevice() {
        const ua = navigator.userAgent || navigator.vendor || window.opera || '';
        const platform = navigator.platform || '';
        if (/iPhone|iPad|iPod|VisionPro|CriOS|FxiOS|EdgiOS|OPiOS|iPhone OS|iPadOS/i.test(ua)) {
            return true;
        }
        if (/iPhone|iPad|iPod/i.test(platform)) {
            return true;
        }
        if ((platform === 'MacIntel' || ua.includes('Macintosh')) && (navigator.maxTouchPoints > 1)) {
            return true;
        }
        return false;
    }
    function showIosWarningModal(onProceed, onCancel) {
        const iosWarningModal = document.getElementById('tiktok-ios-warning-modal');
        const btnIosWarningCancel = document.getElementById('btn-ios-warning-cancel');
        const btnIosWarningProceed = document.getElementById('btn-ios-warning-proceed');
        if (!iosWarningModal) {
            if (onProceed) onProceed();
            return;
        }
        if (typeof window.applyTranslations === 'function') {
            window.applyTranslations();
        }
        iosWarningModal.classList.remove('hidden');
        iosWarningModal.classList.add('visible');
        const handleProceed = () => {
            iosWarningModal.classList.remove('visible');
            iosWarningModal.classList.add('hidden');
            if (btnIosWarningProceed) btnIosWarningProceed.removeEventListener('click', handleProceed);
            if (btnIosWarningCancel) btnIosWarningCancel.removeEventListener('click', handleCancel);
            if (onProceed) onProceed();
        };
        const handleCancel = () => {
            iosWarningModal.classList.remove('visible');
            iosWarningModal.classList.add('hidden');
            if (btnIosWarningProceed) btnIosWarningProceed.removeEventListener('click', handleProceed);
            if (btnIosWarningCancel) btnIosWarningCancel.removeEventListener('click', handleCancel);
            if (onCancel) onCancel();
        };
        if (btnIosWarningProceed && btnIosWarningCancel) {
            btnIosWarningProceed.onclick = handleProceed;
            btnIosWarningCancel.onclick = handleCancel;
        } else {
            if (onProceed) onProceed();
        }
    }
    function showV3WarningModal(onProceed, onCancel) {
        if (onProceed) onProceed();
    }
    window.addEventListener('error', (e) => {
        if (!logsEl || logsEl.textContent === '') return;
        logSection('UNCAUGHT ERROR');
        log(`  Message : ${e.message}`);
        log(`  Source  : ${e.filename || 'unknown'}`);
        log(`  Line    : ${e.lineno}:${e.colno}`);
        if (e.error && e.error.stack) {
            e.error.stack.split('\n').slice(0, 5).forEach(l => log(`  Stack   : ${l.trim()}`));
        }
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
    const btnCopyLogs = document.getElementById('btn-copy-logs');
    const btnCopyLogsLabel = document.getElementById('btn-copy-logs-label');
    if (btnCopyLogs) {
        btnCopyLogs.addEventListener('mouseenter', () => {
            btnCopyLogs.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnCopyLogs.addEventListener('mouseleave', () => {
            btnCopyLogs.style.background = 'none';
        });
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
                    ta.focus();
                    ta.select();
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
                indicatorEl.style.left = l + 'px';
                indicatorEl.style.width = w + 'px';
            } else {
                const options = Array.from(trackEl.querySelectorAll(`.${activeClass}`));
                const idx = options.indexOf(active);
                const count = options.length || 2;
                const pct = 100 / count;
                indicatorEl.style.left = `calc(${idx * pct}% + 4px)`;
                indicatorEl.style.width = `calc(${pct}% - 8px)`;
            }
        }
    }
    const patcherCard       = document.getElementById('tiktok-patcher-card');
    const patchedOverlay    = document.getElementById('tiktok-patched-overlay');
    const btnOverlayIgnore  = document.getElementById('btn-patched-overlay-ignore');
    const vpModal           = document.getElementById('tiktok-version-patched-modal');
    const vpModalTitle      = document.getElementById('vp-modal-title');
    const vpModalBody       = document.getElementById('vp-modal-body');
    const btnVpProceed      = document.getElementById('btn-vp-proceed');
    const btnVpSwitch       = document.getElementById('btn-vp-switch');
    const v1Patched = patcherCard?.dataset.v1Patched === 'true';
    const v2Patched = patcherCard?.dataset.v2Patched === 'true';
    if (v1Patched && v2Patched && patchedOverlay) {
        patchedOverlay.style.display = 'flex';
    }
    if (btnOverlayIgnore && patchedOverlay) {
        btnOverlayIgnore.addEventListener('click', () => {
            patchedOverlay.style.opacity = '0';
            patchedOverlay.style.transition = 'opacity 0.3s ease';
            setTimeout(() => { patchedOverlay.style.display = 'none'; }, 300);
        });
        btnOverlayIgnore.addEventListener('mouseenter', () => {
            btnOverlayIgnore.style.background = 'rgba(255,255,255,0.22)';
        });
        btnOverlayIgnore.addEventListener('mouseleave', () => {
            btnOverlayIgnore.style.background = 'rgba(255,255,255,0.1)';
        });
    }
    function showVersionPatchedModal(patchedVersion, onProceed, onSwitch) {
        if (!vpModal) { onProceed && onProceed(); return; }
        const other = patchedVersion === 'v2' ? 'V1' : 'V2';
        vpModalTitle.textContent = `${patchedVersion.toUpperCase()} Method Patched`;
        vpModalBody.innerHTML = `<strong>${patchedVersion.toUpperCase()}</strong> is currently patched and may not work as expected. We recommend switching to <strong>${other}</strong> which is currently stable.`;
        btnVpSwitch.textContent = `Use ${other}`;
        vpModal.classList.remove('hidden');
        requestAnimationFrame(() => vpModal.classList.add('visible'));
        const cleanup = () => {
            vpModal.classList.remove('visible');
            setTimeout(() => vpModal.classList.add('hidden'), 260);
            btnVpProceed.removeEventListener('click', handleProceed);
            btnVpSwitch.removeEventListener('click', handleSwitch);
        };
        const handleProceed = () => { cleanup(); onProceed && onProceed(); };
        const handleSwitch  = () => { cleanup(); onSwitch  && onSwitch();  };
        btnVpProceed.addEventListener('click', handleProceed);
        btnVpSwitch.addEventListener('click', handleSwitch);
    }
    if (versionSwitch) {
        versionSwitch.addEventListener('click', (e) => {
            const btn = e.target.closest('.tiktok-switch-option');
            if (!btn || isProcessing) return;
            const clickedVersion = btn.dataset.version;
            const doSwitch = (version) => {
                versionSwitch.querySelectorAll('.tiktok-switch-option').forEach(b => b.classList.remove('active'));
                const target = versionSwitch.querySelector(`[data-version="${version}"]`);
                if (target) target.classList.add('active');
                currentVersion = version;
                const ind = document.getElementById('tiktok-version-indicator');
                updateSwitchIndicator(versionSwitch, ind, 'tiktok-switch-option');
                if (compressToggleRow) {
                    if (currentVersion === 'v3' || currentVersion === 'v2') {
                        compressToggleRow.classList.remove('hidden');
                        compressToggleRow.style.display = 'block';
                        requestAnimationFrame(() => updateModeIndicator(compressMode));
                    } else {
                        compressToggleRow.classList.add('hidden');
                        compressToggleRow.style.display = 'none';
                    }
                }
            };
            if (isIosDevice() && clickedVersion !== 'v3') {
                showIosWarningModal(
                    () => {
                        if (clickedVersion === 'v2' && v2Patched && !v1Patched) {
                            doSwitch('v2');
                            showVersionPatchedModal('v2', () => {}, () => doSwitch('v1'));
                        } else if (clickedVersion === 'v1' && v1Patched && !v2Patched) {
                            doSwitch('v1');
                            showVersionPatchedModal('v1', () => {}, () => doSwitch('v2'));
                        } else {
                            doSwitch(clickedVersion);
                        }
                    },
                    () => {}
                );
            } else if (clickedVersion === 'v2' && v2Patched && !v1Patched) {
                doSwitch('v2');
                showVersionPatchedModal(
                    'v2',
                    () => {  },
                    () => doSwitch('v1')
                );
            } else if (clickedVersion === 'v1' && v1Patched && !v2Patched) {
                doSwitch('v1');
                showVersionPatchedModal(
                    'v1',
                    () => {  },
                    () => doSwitch('v2')
                );
            } else {
                doSwitch(clickedVersion);
            }
        });
        requestAnimationFrame(() => {
            const ind = document.getElementById('tiktok-version-indicator');
            updateSwitchIndicator(versionSwitch, ind, 'tiktok-switch-option');
            if (compressToggleRow && (currentVersion === 'v3' || currentVersion === 'v2')) {
                compressToggleRow.classList.remove('hidden');
                compressToggleRow.style.display = 'block';
                updateModeIndicator(compressMode);
            }
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
    if (compressModeSelector) {
        compressModeSelector.addEventListener('click', (e) => {
            const option = e.target.closest('.tiktok-switch-option');
            if (!option || isProcessing) return;
            compressMode = option.dataset.mode;
            updateModeIndicator(compressMode);
        });
    }
    function updateModeIndicator(mode) {
        if (!compressModeSelector) return;
        const indicator = document.getElementById('tiktok-mode-indicator');
        const descPanel = document.getElementById('tiktok-mode-desc');
        const option = compressModeSelector.querySelector(`.tiktok-switch-option[data-mode="${mode}"]`);
        compressModeSelector.querySelectorAll('.tiktok-switch-option').forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
        
        const refreshPill = () => {
            updateSwitchIndicator(compressModeSelector, indicator, 'tiktok-switch-option');
        };

        refreshPill();
        requestAnimationFrame(refreshPill);
        setTimeout(refreshPill, 50);
        setTimeout(refreshPill, 150);
        setTimeout(refreshPill, 350);

        if (descPanel && option) {
            descPanel.style.opacity = '0';
            setTimeout(() => {
                const translationKey = 'patcher_mode_' + mode + '_desc';
                descPanel.textContent = window.getTranslation(translationKey);
                descPanel.style.opacity = '1';
            }, 160);
        }
    }

    window.addEventListener('load', () => {
        const vInd = document.getElementById('tiktok-version-indicator');
        updateSwitchIndicator(versionSwitch, vInd, 'tiktok-switch-option');
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
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
    });
    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }
    function resetToolState() {
        selectedFile = null;
        currentFileBuffer = null;
        fileInput.value = '';
        statusText.innerHTML = '';
        btnStart.classList.add('hidden');
        progressContainer.classList.add('hidden');
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = window.getTranslation('status_processing');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    }
    async function clearAllToolCache() {
        if (isProcessing) return;

        // 1. Reset tool state & memory references
        resetToolState();

        // 2. Unregister Service Workers
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                }
            } catch (e) {}
        }

        // 3. Clear browser Cache Storage API (ServiceWorker & HTTP Caches)
        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {}
        }

        // 4. Clear SessionStorage & LocalStorage temporary data
        try {
            sessionStorage.clear();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('tiktok') || key.includes('ffmpeg') || key.includes('cache'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (e) {}

        // 5. Reset ArrayBuffers & release JS memory
        currentFileBuffer = null;
        selectedFile = null;

        // 6. Visual UI Feedback
        statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; Cache cleared. Reloading...</span>`;
        const icon = btnClearCache ? btnClearCache.querySelector('.material-symbols-rounded') : null;
        if (icon) {
            icon.style.transition = 'transform 0.5s ease';
            icon.style.transform = 'rotate(360deg) scale(1.2)';
            setTimeout(() => {
                icon.style.transform = '';
            }, 500);
        }
        setTimeout(() => {
            const reloadUrl = new URL(window.location.href);
            reloadUrl.searchParams.set('cache', Date.now().toString());
            window.location.replace(reloadUrl.href);
        }, 550);
    }

    const btnClearCache = document.getElementById('btn-tiktok-clear-cache');
    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => {
            clearAllToolCache();
        });
        btnClearCache.addEventListener('mouseenter', () => {
            btnClearCache.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnClearCache.addEventListener('mouseleave', () => {
            btnClearCache.style.background = 'none';
        });
    }
    function handleFileSelection(file) {
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
        if (isIosDevice() && currentVersion !== 'v3') {
            btnStart.classList.add('hidden');
            showStatusError(window.getTranslation('ios_not_supported_err') || 'Perangkat iOS tidak didukung. Silakan gunakan PC (Windows/macOS) atau Android.');
            showIosWarningModal(
                () => {},
                () => { resetToolState(); }
            );
            return;
        }
        btnStart.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
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
        setCheckState(tktk.iconFps, tktk.checkFps, 'loading', 'Analyzing...');
        setCheckState(tktk.iconRes, tktk.checkRes, 'loading', 'Analyzing...');
        setCheckState(tktk.iconSize, tktk.checkSize, 'loading', 'Analyzing...');
        tktk.btnProceed.disabled = true;
        tktk.btnProceed.style.display = '';
        tktk.btnCompress.disabled = true;
        analysisModal.classList.add('visible');
    }
    function closeAnalysisModal() {
        analysisModal.classList.remove('visible');
    }
    async function runAnalysis(file) {
        openAnalysisModal();
        const fileMB = file.size / (1024 * 1024);
        let fps = null;
        let w = 0, h = 0;
        let hasFail = false;
        try {
            if (currentFileBuffer) {
                fps = parseFpsFromMp4(currentFileBuffer);
                const res = parseResolutionFromMp4(currentFileBuffer);
                if (res) {
                    w = res.width;
                    h = res.height;
                }
            }
        } catch (e) {}
        if (w === 0 || h === 0) {
            await new Promise(resolve => {
                const url = URL.createObjectURL(file);
                const vid = document.createElement('video');
                vid.preload = 'metadata';
                vid.muted = true;
                vid.src = url;
                const done = () => { URL.revokeObjectURL(url); resolve(); };
                vid.onloadedmetadata = () => {
                    if (vid.videoWidth && vid.videoHeight) {
                        w = vid.videoWidth;
                        h = vid.videoHeight;
                    }
                    done();
                };
                vid.onerror = done;
                setTimeout(done, 2000);
                vid.load();
            });
        }
        const fpsFail = fps !== null && fps > 120;
        const fpsLabel = fps !== null ? `${fps} fps` : 'Unable to detect';
        setCheckState(tktk.iconFps, tktk.checkFps, fpsFail ? 'fail' : 'pass', fpsLabel);
        if (fpsFail) {
            const errFpsEl = document.getElementById('tktk-err-fps');
            if (errFpsEl) errFpsEl.textContent = 'Exceeds 120 fps limit (max 120fps). Must be compressed.';
        }
        const shortSide = Math.min(w, h);
        const longSide = Math.max(w, h);
        const resFail = w > 0 && (shortSide > 1080 || longSide > 1920);
        const resLabel = w > 0 ? `${w}x${h}` : 'Unable to detect';
        setCheckState(tktk.iconRes, tktk.checkRes, w === 0 ? 'pass' : (resFail ? 'fail' : 'pass'), resLabel);
        if (resFail) {
            const errResEl = document.getElementById('tktk-err-res');
            if (errResEl) errResEl.textContent = 'Exceeds 1080p limit (max 1080x1920). Must be compressed.';
        }
        hasFail = false;
        let hasHardFail = false;
        if (fpsFail || resFail) {
            hasFail = true;
            hasHardFail = true;
        }
        const sizeFail = fileMB > COMPRESS_WARN_MB;
        setCheckState(tktk.iconSize, tktk.checkSize, sizeFail ? 'warn' : 'pass', `${fileMB.toFixed(1)} MB`);
        if (sizeFail) hasFail = true;
        if (!hasFail) {
            closeAnalysisModal();
            await processVideoV2(file, 'off');
            return;
        }
        tktk.btnProceed.disabled = hasHardFail;
        tktk.btnProceed.style.display = hasHardFail ? 'none' : '';
        tktk.btnCompress.disabled = false;
    }
    if (tktk.btnCancel) {
        tktk.btnCancel.addEventListener('click', () => closeAnalysisModal());
    }
    if (tktk.btnProceed) {
        tktk.btnProceed.addEventListener('click', async () => {
            closeAnalysisModal();
            await processVideoV2(selectedFile, 'off');
        });
    }
    if (tktk.btnCompress) {
        tktk.btnCompress.addEventListener('click', async () => {
            closeAnalysisModal();
            setCompressMode('hd');
            await processVideoV2(selectedFile, 'hd');
        });
    }
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read video file.'));
            reader.readAsArrayBuffer(file);
        });
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
        log(`  Size        : ${(selectedFile.size / (1024*1024)).toFixed(3)} MB (${selectedFile.size} bytes)`);
        log(`  MIME type   : ${selectedFile.type}`);
        log(`  Last modif  : ${new Date(selectedFile.lastModified).toISOString()}`);
        log(`  Version     : ${currentVersion.toUpperCase()}  |  Compress mode: ${compressMode}`);
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
            const peek = new Uint8Array(currentFileBuffer, 0, Math.min(12, currentFileBuffer.byteLength));
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
        isProcessing = false;
    function checkIosWarningAndProceed(onProceed) {
        if (isIosDevice() && currentVersion !== 'v3') {
            btnStart.classList.add('hidden');
            progressContainer.classList.add('hidden');
            logsContainer.classList.add('hidden');
            showStatusError(window.getTranslation('ios_not_supported_err') || 'Perangkat iOS tidak didukung. Silakan gunakan PC (Windows/macOS) atau Android.');
            isProcessing = false;
            showIosWarningModal(
                () => {},
                () => { resetToolState(); }
            );
            return;
        }
        onProceed();
    }
        const startProcess = async () => {
            isProcessing = false;
            if (currentVersion === 'v1') {
                await processVideoV1(selectedFile);
                return;
            }
            if (currentVersion === 'v3') {
                await processVideoV3(selectedFile, compressMode);
                return;
            }
            if (compressMode === 'off') {
                await runAnalysis(selectedFile);
                return;
            }
            await processVideoV2(selectedFile, compressMode);
        };
        checkIosWarningAndProceed(startProcess);
    });
    function parseFpsFromMp4(arrayBuffer) {
        try {
            const srcArr = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
            const fresh = new Uint8Array(srcArr.byteLength);
            fresh.set(srcArr);
            const data = fresh;
            const view = new DataView(data.buffer);
            const topLevel = parseBoxes(data, view, 0, data.length, '');
            const moov = findTopLevel(topLevel, 'moov');
            if (!moov) return null;
            const videoTrak = moov.children.find(
                c => c.type === 'trak' && handlerTypeForTrak(c) === 'vide'
            );
            if (!videoTrak) return null;
            const mdhd = findDescendant(videoTrak, ['mdia', 'mdhd']);
            const stbl = findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
            const stsz = stbl && findChild(stbl, 'stsz');
            if (!mdhd || !stsz) return null;
            const mdhdPayload = boxPayload(mdhd);
            const version = mdhdPayload[0];
            let timescale, duration;
            if (version === 0) {
                timescale = readU32BE(mdhdPayload, 12);
                duration = readU32BE(mdhdPayload, 16);
            } else if (version === 1) {
                timescale = readU32BE(mdhdPayload, 20);
                const high = readU32BE(mdhdPayload, 24);
                const low = readU32BE(mdhdPayload, 28);
                duration = high * 4294967296 + low;
            } else {
                return null;
            }
            if (!timescale || !duration) return null;
            const durationSec = duration / timescale;
            const frameCount = stsz.view.getUint32(stsz.offset + 16, false);
            if (!frameCount || durationSec <= 0) return null;
            return Math.round(frameCount / durationSec);
        } catch (e) {
            return null;
        }
    }
    function parseResolutionFromMp4(arrayBuffer) {
        try {
            const srcArr = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
            const fresh = new Uint8Array(srcArr.byteLength);
            fresh.set(srcArr);
            const data = fresh;
            const view = new DataView(data.buffer);
            const topLevel = parseBoxes(data, view, 0, data.length, '');
            const moov = findTopLevel(topLevel, 'moov');
            if (!moov) return null;
            const videoTrak = moov.children.find(
                c => c.type === 'trak' && handlerTypeForTrak(c) === 'vide'
            );
            if (!videoTrak) return null;
            const stsd = findDescendant(videoTrak, ['mdia', 'minf', 'stbl', 'stsd']);
            if (stsd) {
                const entryCount = stsd.view.getUint32(stsd.offset + 12, false);
                if (entryCount >= 1) {
                    const entryOffset = stsd.offset + 16;
                    if (entryOffset + 36 <= stsd.end) {
                        let width = stsd.view.getUint16(entryOffset + 32, false);
                        let height = stsd.view.getUint16(entryOffset + 34, false);
                        if (!width || !height) {
                            width = stsd.view.getUint16(entryOffset + 24, false);
                            height = stsd.view.getUint16(entryOffset + 26, false);
                        }
                        if (width > 0 && height > 0) {
                            return { width, height };
                        }
                    }
                }
            }
            const tkhd = findChild(videoTrak, 'tkhd');
            if (tkhd) {
                const tkhdPayload = boxPayload(tkhd);
                const version = tkhdPayload[0];
                let width = 0, height = 0;
                if (version === 0) {
                    width = readU32BE(tkhdPayload, 72) >>> 16;
                    height = readU32BE(tkhdPayload, 76) >>> 16;
                } else if (version === 1) {
                    width = readU32BE(tkhdPayload, 80) >>> 16;
                    height = readU32BE(tkhdPayload, 84) >>> 16;
                }
                if (width > 0 && height > 0) {
                    return { width, height };
                }
            }
        } catch (e) {
            console.error('Failed to parse resolution from MP4 box', e);
        }
        return null;
    }
    function detectCompatibilityFlags(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            const flags = [];
            const fileMB = file.size / (1024 * 1024);
            let resolved = false;
            const cleanup = () => {
                URL.revokeObjectURL(url);
            };
            const safeResolve = (result) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolve(result);
            };
            const timeoutId = setTimeout(() => {
                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }
                safeResolve(flags);
            }, 1500);
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;
            video.src = url;
            video.onloadedmetadata = () => {
                clearTimeout(timeoutId);
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }
                const shortSide = Math.min(w, h);
                const longSide = Math.max(w, h);
                if (shortSide > 1080 || longSide > 1920) {
                    flags.push(`Resolution ${w}x${h} exceeds the 1080p limit (max 1080x1920 or 1920x1080)`);
                }
                safeResolve(flags);
            };
            video.onerror = () => {
                clearTimeout(timeoutId);
                if (fileMB > COMPRESS_WARN_MB) {
                    flags.push(`File size is ${fileMB.toFixed(1)} MB (exceeds the 50 MB safe limit)`);
                }
                safeResolve(flags);
            };
            video.load();
        });
    }
    async function loadFFmpegLibraries() {
        if (window.FFmpegWASM && window.FFmpegUtil) return true;
        const loadScript = (src) => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
        });
        try {
            if (!window.FFmpegUtil) {
                await loadScript('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/umd/index.js');
            }
            if (!window.FFmpegWASM) {
                const [ffmpegRes, workerRes] = await Promise.all([
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js'),
                    fetch('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/814.ffmpeg.js')
                ]);
                if (!ffmpegRes.ok || !workerRes.ok) throw new Error('CDN HTTP response error');
                const ffmpegCode = await ffmpegRes.text();
                const workerCode = await workerRes.text();
                const workerBlobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
                const patchedCode = ffmpegCode.replace(/new Worker\(new URL\(e\.p\+e\.u\(814\),e\.b\),\{type:void 0\}\)/g, `new Worker("${workerBlobUrl}")`)
                                               .replace(/u:e=>e\+"\.\x66\x66\x6d\x70\x65\x67\.\x6a\x73"/g, `u:()=>"${workerBlobUrl}"`)
                                               .replace(/u:e=>e\+"\x2effmpeg\x2ejs"/g, `u:()=>"${workerBlobUrl}"`);
                const ffmpegBlobUrl = URL.createObjectURL(new Blob([patchedCode], { type: 'text/javascript' }));
                await loadScript(ffmpegBlobUrl);
            }
            if (window.FFmpegWASM && window.FFmpegUtil) {
                return true;
            }
        } catch (cdnErr) {
            console.warn(cdnErr);
        }
        try {
            if (!window.FFmpegWASM) await loadScript('assets/ffmpeg/ffmpeg.js');
            if (!window.FFmpegUtil) await loadScript('assets/ffmpeg/index.js');
            if (window.FFmpegWASM && window.FFmpegUtil) {
                return true;
            }
        } catch (localErr) {
            console.error(localErr);
        }
        return !!(window.FFmpegWASM && window.FFmpegUtil);
    }
    async function loadFFmpegHelper(ffmpeg, toBlobURL) {
        const cdnBaseMT = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/umd';
        const cdnBaseST = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
        const localBaseURL = window.location.origin + '/assets/ffmpeg';
        const isMultiThread = typeof SharedArrayBuffer !== 'undefined' && !isIosDevice();
        let loaded = false;
        logSection('FFmpeg Load');
        log(`  CDN Base MT : ${cdnBaseMT}`);
        log(`  Multi-thread: ${isMultiThread}`);
        if (isMultiThread) {
            try {
                log(`  Attempting multi-thread load from CDN...`);
                const coreURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.wasm`, 'application/wasm');
                const workerURL = await toBlobURL(`${cdnBaseMT}/ffmpeg-core.worker.js`, 'text/javascript');
                await ffmpeg.load({ coreURL, wasmURL, workerURL });
                loaded = true;
                log(`  Multi-thread load from CDN: SUCCESS`);
            } catch (err) {
                log(`  CDN multi-thread load FAILED: ${err.message} — trying local fallback`);
                try {
                    const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.js`, 'text/javascript');
                    const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.wasm`, 'application/wasm');
                    const workerURL = await toBlobURL(`${localBaseURL}/ffmpeg-core.worker.js`, 'text/javascript');
                    await ffmpeg.load({ coreURL, wasmURL, workerURL });
                    loaded = true;
                    log(`  Local multi-thread load: SUCCESS`);
                } catch (localErr) {
                    log(`  Local multi-thread load FAILED: ${localErr.message} — falling back to single-thread`);
                }
            }
        }
        if (!loaded) {
            try {
                log(`  Loading single-thread FFmpeg from CDN...`);
                const coreURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${cdnBaseST}/ffmpeg-core.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                log(`  CDN Single-thread load: SUCCESS`);
            } catch (err) {
                log(`  CDN Single-thread load FAILED: ${err.message} — using local fallback`);
                const coreURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.js`, 'text/javascript');
                const wasmURL = await toBlobURL(`${localBaseURL}/ffmpeg-core-st.wasm`, 'application/wasm');
                await ffmpeg.load({ coreURL, wasmURL });
                log(`  Local Single-thread load: SUCCESS`);
            }
        }
        logEnd();
    }
    async function processVideoV1(file) {
        if (isProcessing) return;
        isProcessing = true;
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = window.getTranslation('status_processing');
        logSection('V1 PROCESS START');
        log(`  File : ${file.name}`);
        log(`  Mode : WMV2 lossless re-encode (v1)`);
        logEnd();
        try {
            const isReady = await loadFFmpegLibraries();
            if (!isReady) {
                throw new Error("FFmpeg library failed to load. Please check your network connection and reload the page.");
            }
            const { FFmpeg } = window.FFmpegWASM;
            const { fetchFile, toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();
            let oomDetected = false;
            let oomLine = '';
            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_encoding')}</span>`;
            });
            let warnRepeatCount = 0;
            ffmpeg.on('log', ({ message }) => {
                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                    oomLine = message;
                }
                if (lc.includes('missing picture in access') || lc.includes('no frame!') || lc.includes('invalid data found when processing')) {
                    warnRepeatCount++;
                    if (warnRepeatCount % 100 !== 1) {
                        return;
                    }
                }
                appendToLogsEl(message);
            });
            await loadFFmpegHelper(ffmpeg, toBlobURL);
            logSection('FFmpeg V1 — Writing Input');
            log(`  Buffer size : ${currentFileBuffer.byteLength} bytes`);
            await ffmpeg.writeFile('input.mp4', new Uint8Array(currentFileBuffer));
            log(`  Write       : DONE`);
            logEnd();
            const hardwareThreads = navigator.hardwareConcurrency || 4;
            const threads = Math.min(4, hardwareThreads).toString();
            logSection('FFmpeg V1 — Command');
            log(`  Hardware threads : ${hardwareThreads}`);
            log(`  Using threads    : ${threads}`);
            const command = [
                '-i', 'input.mp4',
                '-threads', threads,
                '-map_metadata', '-1',
                '-map_chapters', '-1',
                '-vf', "scale='if(lt(iw,ih),trunc(min(iw,1080)/2)*2,-2)':'if(lt(iw,ih),-2,trunc(min(ih,1080)/2)*2)'",
                '-c:v', 'wmv2',
                '-qscale:v', '1',
                '-c:a', 'wmav2',
                '-b:a', '320k',
                'output.wmv'
            ];
            logsEl.textContent += `Executing command: ffmpeg ${command.join(' ')}\n`;
            log(`  Full command: ffmpeg ${command.join(' ')}`);
            logEnd();
            logSection('FFmpeg V1 — Encoding');
            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('output.wmv');
                    if (!testData || testData.byteLength < 1024) {
                        throw execError;
                    }
                } catch (readError) {
                    throw execError;
                }
            }
            logEnd();
            if (oomDetected) {
                log(`  OOM detected! Triggered by: ${oomLine}`);
                throw new Error(`Out of memory during video processing. (Triggered by log: "${oomLine}")`);
            }
            logSection('FFmpeg V1 — Output');
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
            const data = await ffmpeg.readFile('output.wmv');
            log(`  Output bytes : ${data ? data.byteLength : 0}`);
            log(`  Output size  : ${data ? (data.byteLength / (1024*1024)).toFixed(2) + ' MB' : 'EMPTY'}`);
            if (!data || data.byteLength < 1024) {
                log(`  ERROR: Output too small or empty!`);
                throw new Error('Processing failed (output is empty or too small).');
            }
            logEnd();
            const blob = new Blob([data.buffer], { type: 'video/x-ms-wmv' });
            const url = URL.createObjectURL(blob);
            log(`  Blob URL created, triggering download...`);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.replace(/\.[^.]+$/, '')}_hq.wmv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            log(`  Download triggered: ${a.download}`);
            logEnd();
            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            btnStart.classList.remove('hidden');
        } catch (error) {
            log(`  !! V1 ERROR: ${error.name} — ${error.message}`);
            if (error.stack) log(`  Stack: ${error.stack.split('\n').slice(0,3).join(' | ')}`);
            logEnd();
            console.error(error);
            showStatusError(`Error: ${error.message}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }
    const FAKE_SAMPLE_SIZE       = 10;
    const FAKE_SAMPLE_BYTES      = new Uint8Array([
        0x00, 0x00, 0x00, 0x06, // length of NAL unit
        0x0C,                   // NAL unit header (forbidden_zero_bit=0, nal_ref_idc=00, nal_unit_type=12: Filler)
        0xFF, 0xFF, 0xFF, 0xFF, // filler byte payload
        0x80                    // rbsp trailing bits
    ]);
    const VIDEO_TIMESCALE        = 90000;
    const VIDEO_DURATION         = 2269500;
    const VIDEO_EDIT_MEDIA_TIME  = 0;
    const CONTAINER_BOXES = new Set([
        'moov', 'trak', 'mdia', 'minf', 'stbl',
        'edts', 'dinf', 'udta', 'meta', 'ilst',
    ]);
    function getBoxType(data, offset) {
        return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    }
    function assertUint32(value, label) {
        if (!Number.isFinite(value) || value < 0 || value > 0xffffffff)
            throw new Error(`${label} out of uint32 range: ${value}`);
    }
    function readBox(view, data, offset, end, parentPath) {
        if (offset + 8 > end) return null;
        const smallSize = view.getUint32(offset, false);
        const type = getBoxType(data, offset + 4);
        let size = smallSize;
        let headerSize = 8;
        if (smallSize === 1) {
            if (offset + 16 > end) return null;
            const high = view.getUint32(offset + 8, false);
            const low  = view.getUint32(offset + 12, false);
            size = high * 4294967296 + low;
            headerSize = 16;
        } else if (smallSize === 0) {
            size = end - offset;
        }
        if (size < headerSize || offset + size > end) return null;
        return {
            type, offset, size, headerSize,
            contentStart: offset + headerSize,
            end: offset + size,
            path: parentPath ? `${parentPath}/${type}` : type,
            data, view,
            children: [],
            prefixStart: offset + headerSize,
            prefixEnd:   offset + headerSize,
        };
    }
    function childStartForBox(box) {
        return box.type === 'meta' ? box.contentStart + 4 : box.contentStart;
    }
    function parseBoxes(data, view, start, end, parentPath) {
        const boxes = [];
        let offset = start;
        while (offset + 8 <= end) {
            const box = readBox(view, data, offset, end, parentPath || '');
            if (!box) break;
            if (CONTAINER_BOXES.has(box.type)) {
                const childStart = childStartForBox(box);
                if (childStart <= box.end) {
                    box.prefixStart = box.contentStart;
                    box.prefixEnd   = childStart;
                    box.children    = parseBoxes(data, view, childStart, box.end, box.path);
                }
            }
            boxes.push(box);
            offset = box.end;
        }
        return boxes;
    }
    function findChild(box, type) {
        return box.children.find(c => c.type === type) || null;
    }
    function findDescendant(box, typePath) {
        let cur = box;
        for (const t of typePath) {
            cur = findChild(cur, t);
            if (!cur) return null;
        }
        return cur;
    }
    function findTopLevel(boxes, type) {
        return boxes.find(b => b.type === type) || null;
    }
    function handlerTypeForTrak(trak) {
        const hdlr = findDescendant(trak, ['mdia', 'hdlr']);
        if (!hdlr || hdlr.offset + 20 > hdlr.end) return null;
        return getBoxType(hdlr.data, hdlr.offset + 16);
    }
    function parseStsz(stsz) {
        const sampleSize = stsz.view.getUint32(stsz.offset + 12, false);
        const count      = stsz.view.getUint32(stsz.offset + 16, false);
        if (sampleSize) return new Array(count).fill(sampleSize);
        const tableStart = stsz.offset + 20;
        if (tableStart + count * 4 > stsz.end)
            throw new Error('stsz too small for declared sample count.');
        const sizes = [];
        for (let i = 0; i < count; i++)
            sizes.push(stsz.view.getUint32(tableStart + i * 4, false));
        return sizes;
    }
    function parseStco(stcoBox) {
        const isCo64 = stcoBox.type === 'co64';
        const count = stcoBox.view.getUint32(stcoBox.offset + 12, false);
        const tableStart = stcoBox.offset + 16;
        const itemSize = isCo64 ? 8 : 4;
        if (tableStart + count * itemSize > stcoBox.end)
            throw new Error(`${stcoBox.type} too small for declared chunk count.`);
        const offsets = [];
        for (let i = 0; i < count; i++) {
            if (isCo64) {
                const high = stcoBox.view.getUint32(tableStart + i * 8, false);
                const low  = stcoBox.view.getUint32(tableStart + i * 8 + 4, false);
                offsets.push(high * 4294967296 + low);
            } else {
                offsets.push(stcoBox.view.getUint32(tableStart + i * 4, false));
            }
        }
        return offsets;
    }
    function parseStsc(stsc) {
        const count      = stsc.view.getUint32(stsc.offset + 12, false);
        const tableStart = stsc.offset + 16;
        if (tableStart + count * 12 > stsc.end)
            throw new Error('stsc too small for declared entry count.');
        const rows = [];
        for (let i = 0; i < count; i++) {
            const off = tableStart + i * 12;
            rows.push([
                stsc.view.getUint32(off,     false),
                stsc.view.getUint32(off + 4, false),
                stsc.view.getUint32(off + 8, false),
            ]);
        }
        return rows;
    }
    function parseStts(stts) {
        const count = stts.view.getUint32(stts.offset + 12, false);
        const tableStart = stts.offset + 16;
        const entries = [];
        for (let i = 0; i < count; i++) {
            const off = tableStart + i * 8;
            entries.push([
                stts.view.getUint32(off, false),
                stts.view.getUint32(off + 4, false)
            ]);
        }
        return entries;
    }
    function getTimescale(trak) {
        const mdhd = findDescendant(trak, ['mdia', 'mdhd']);
        if (!mdhd) return 90000;
        const ver = mdhd.data[mdhd.offset + 8];
        if (ver === 0) {
            return mdhd.view.getUint32(mdhd.offset + 20, false);
        } else {
            return mdhd.view.getUint32(mdhd.offset + 28, false);
        }
    }
    function extractSampleLocations(trak) {
        const stbl = findDescendant(trak, ['mdia', 'minf', 'stbl']);
        if (!stbl) return [];
        const stszBox = findChild(stbl, 'stsz');
        const stcoBox = findChild(stbl, 'stco') || findChild(stbl, 'co64');
        const stscBox = findChild(stbl, 'stsc');
        if (!stszBox || !stcoBox || !stscBox) return [];
        const sizes = parseStsz(stszBox);
        const offsets = parseStco(stcoBox);
        const stsc = parseStsc(stscBox);
        const locations = [];
        let sampleIdx = 0;
        for (let i = 0; i < stsc.length; i++) {
            const firstChunk = stsc[i][0];
            const samplesPerChunk = stsc[i][1];
            const nextChunk = (i + 1 < stsc.length) ? stsc[i + 1][0] : (offsets.length + 1);
            for (let chunkIdx = firstChunk - 1; chunkIdx < nextChunk - 1; chunkIdx++) {
                let currOff = offsets[chunkIdx];
                for (let s = 0; s < samplesPerChunk; s++) {
                    if (sampleIdx < sizes.length) {
                        const sz = sizes[sampleIdx];
                        locations.push({ offset: currOff, size: sz });
                        currOff += sz;
                        sampleIdx++;
                    }
                }
            }
        }
        return locations;
    }
    function getSampleTimestamps(sttsEntries, timescale) {
        const timestamps = [];
        let currTime = 0.0;
        for (const [count, delta] of sttsEntries) {
            const dt = delta / timescale;
            for (let i = 0; i < count; i++) {
                timestamps.push(currTime);
                currTime += dt;
            }
        }
        return timestamps;
    }
    function makeBox(type, payload) {
        const size = 8 + payload.byteLength;
        assertUint32(size, `${type}.size`);
        const box = new Uint8Array(size);
        const dv  = new DataView(box.buffer);
        dv.setUint32(0, size, false);
        for (let i = 0; i < 4; i++) box[4 + i] = type.charCodeAt(i);
        box.set(new Uint8Array(payload.buffer || payload, payload.byteOffset || 0, payload.byteLength), 8);
        return box;
    }
    function concatBytes(parts) {
        let totalLen = 0;
        for (const p of parts) totalLen += p.byteLength;
        const result = new Uint8Array(totalLen);
        let off = 0;
        for (const p of parts) {
            result.set(new Uint8Array(p.buffer || p, p.byteOffset || 0, p.byteLength), off);
            off += p.byteLength;
        }
        return result;
    }
    function boxBytes(box) {
        return new Uint8Array(box.data.buffer, box.data.byteOffset + box.offset, box.size);
    }
    function boxPayload(box) {
        return new Uint8Array(box.data.buffer, box.data.byteOffset + box.contentStart, box.end - box.contentStart);
    }
    function writeU32BE(arr, offset, value) {
        const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
        dv.setUint32(offset, value, false);
    }
    function buildMdhd(box, dynamicTimescale, dynamicDuration) {
        const payload = new Uint8Array(boxPayload(box));
        const version = payload[0];
        if (version === 0) {
            writeU32BE(payload, 12, dynamicTimescale);
            writeU32BE(payload, 16, dynamicDuration);
        } else if (version === 1) {
            writeU32BE(payload, 20, dynamicTimescale);
            const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
            dv.setBigUint64(24, BigInt(dynamicDuration), false);
        }
        return makeBox('mdhd', payload);
    }
    function buildStts(originalSttsEntries, fakeSampleCount, dynamicSampleDelta) {
        if (!fakeSampleCount) {
            let totalLen = 8 + originalSttsEntries.length * 8;
            const payload = new Uint8Array(totalLen);
            writeU32BE(payload, 4, originalSttsEntries.length);
            let off = 8;
            for (const [count, delta] of originalSttsEntries) {
                writeU32BE(payload, off, count);
                writeU32BE(payload, off + 4, delta);
                off += 8;
            }
            return makeBox('stts', payload);
        } else {
            let entries = [...originalSttsEntries, [fakeSampleCount, dynamicSampleDelta]];
            const payload = new Uint8Array(8 + entries.length * 8);
            writeU32BE(payload, 4, entries.length);
            let off = 8;
            for (const [count, delta] of entries) {
                writeU32BE(payload, off, count);
                writeU32BE(payload, off + 4, delta);
                off += 8;
            }
            return makeBox('stts', payload);
        }
    }
    function buildStsz(originalSizes, fakeSampleCount) {
        const total = originalSizes.length + (fakeSampleCount || 0);
        const payload = new Uint8Array(12 + total * 4);
        writeU32BE(payload, 8, total);
        let off = 12;
        for (const s of originalSizes) { writeU32BE(payload, off, s); off += 4; }
        if (fakeSampleCount) {
            for (let i = 0; i < fakeSampleCount; i++) {
                writeU32BE(payload, off, FAKE_SAMPLE_SIZE); off += 4;
            }
        }
        return makeBox('stsz', payload);
    }
    function buildStscFromChunkMap(chunkSampleCounts) {
        const rows = [];
        let startChunk = 1;
        let prevCount = chunkSampleCounts[0];
        for (let i = 1; i < chunkSampleCounts.length; i++) {
            if (chunkSampleCounts[i] !== prevCount) {
                rows.push([startChunk, prevCount, 1]);
                startChunk = i + 1;
                prevCount = chunkSampleCounts[i];
            }
        }
        rows.push([startChunk, prevCount, 1]);
        const payload = new Uint8Array(8 + rows.length * 12);
        writeU32BE(payload, 4, rows.length);
        let off = 8;
        for (const [fc, spc, sdi] of rows) {
            writeU32BE(payload, off, fc);
            writeU32BE(payload, off + 4, spc);
            writeU32BE(payload, off + 8, sdi);
            off += 12;
        }
        return makeBox('stsc', payload);
    }
    function buildStco(newOffsets) {
        const payload = new Uint8Array(8 + newOffsets.length * 4);
        writeU32BE(payload, 4, newOffsets.length);
        let off = 8;
        for (const o of newOffsets) {
            assertUint32(o, 'stco.chunk_offset');
            writeU32BE(payload, off, o);
            off += 4;
        }
        return makeBox('stco', payload);
    }
    function rebuildBox(box, replacements) {
        if (replacements.has(box)) return replacements.get(box);
        if (!box.children.length) return boxBytes(box);
        const prefix = new Uint8Array(box.data.buffer, box.data.byteOffset + box.prefixStart, box.prefixEnd - box.prefixStart);
        const parts  = [prefix];
        for (const child of box.children) parts.push(rebuildBox(child, replacements));
        return makeBox(box.type, concatBytes(parts));
    }
    function patchMp4(inputData, _logFn) {
        const _log = _logFn || (() => {});
        const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
        const data = new Uint8Array(srcArr.byteLength);
        data.set(srcArr);
        const view = new DataView(data.buffer);
        _log(`Input buffer size: ${data.byteLength} bytes (${(data.byteLength/(1024*1024)).toFixed(3)} MB)`);
        const topLevel = parseBoxes(data, view, 0, data.length, '');
        const ftyp = findTopLevel(topLevel, 'ftyp');
        const moov = findTopLevel(topLevel, 'moov');
        const mdat = findTopLevel(topLevel, 'mdat');
        if (!ftyp || !moov || !mdat) {
            throw new Error('Invalid MP4 structure: missing ftyp, moov, or mdat.');
        }
        const traks = moov.children.filter(c => c.type === 'trak');
        const videoTrak = traks.find(c => handlerTypeForTrak(c) === 'vide');
        const audioTrak = traks.find(c => handlerTypeForTrak(c) === 'soun');
        if (!videoTrak) throw new Error('Video track not found.');
        const vSamples = extractSampleLocations(videoTrak);
        const aSamples = audioTrak ? extractSampleLocations(audioTrak) : [];
        const vSttsBox = findDescendant(videoTrak, ['mdia', 'minf', 'stbl', 'stts']);
        const aSttsBox = audioTrak ? findDescendant(audioTrak, ['mdia', 'minf', 'stbl', 'stts']) : null;
        const vStts = parseStts(vSttsBox);
        const aStts = aSttsBox ? parseStts(aSttsBox) : [];
        const vTimescale = getTimescale(videoTrak);
        const aTimescale = audioTrak ? getTimescale(audioTrak) : 44100;
        const vPts = getSampleTimestamps(vStts, vTimescale);
        const aPts = audioTrak ? getSampleTimestamps(aStts, aTimescale) : [];
        _log(`Extracted ${vSamples.length} video samples, ${aSamples.length} audio samples.`);
        const allItems = [];
        for (let i = 0; i < vSamples.length; i++) {
            allItems.push({ type: 'v', idx: i, pts: vPts[i] || 0, loc: vSamples[i] });
        }
        for (let i = 0; i < aSamples.length; i++) {
            allItems.push({ type: 'a', idx: i, pts: aPts[i] || 0, loc: aSamples[i] });
        }
        allItems.sort((a, b) => (a.pts - b.pts) || (a.type === 'a' ? -1 : 1));
        let mdatPayloadSize = 0;
        for (const item of allItems) mdatPayloadSize += item.loc.size;
        const fakeSampleCount = (aSamples.length > 0 ? aSamples.length : vSamples.length) * 9;
        const fakeTotalBytes  = fakeSampleCount * FAKE_SAMPLE_SIZE;
        const newMdatPayload = new Uint8Array(mdatPayloadSize + fakeTotalBytes);
        let writeOffset = 0;
        const newVOffsets = new Array(vSamples.length);
        const newAOffsets = new Array(aSamples.length);
        for (const item of allItems) {
            const srcOffset = item.loc.offset;
            const sz = item.loc.size;
            newMdatPayload.set(data.subarray(srcOffset, srcOffset + sz), writeOffset);
            if (item.type === 'v') newVOffsets[item.idx] = writeOffset;
            else newAOffsets[item.idx] = writeOffset;
            writeOffset += sz;
        }
        const fakeStartInMdat = writeOffset;
        for (let i = 0; i < fakeSampleCount; i++) {
            newMdatPayload.set(FAKE_SAMPLE_BYTES, writeOffset);
            writeOffset += FAKE_SAMPLE_SIZE;
        }
        _log(`Rebuilt mdat payload: ${newMdatPayload.byteLength} bytes (${fakeSampleCount} fake samples appended).`);
        const preservedTopLevel = topLevel
            .filter(b => !['ftyp', 'moov', 'mdat'].includes(b.type))
            .map(boxBytes);
        const preservedBytes = concatBytes(preservedTopLevel);
        const ftypBytes = boxBytes(ftyp);
        let moovHeaderLen = moov.size;
        let finalOutput = null;
        let patchResultStats = null;
        for (let pass = 1; pass <= 3; pass++) {
            const mdatStartOffset = ftypBytes.byteLength + moovHeaderLen + preservedBytes.byteLength + 8;
            const vAbsOffsets = newVOffsets.map(rel => rel + mdatStartOffset);
            const aAbsOffsets = newAOffsets.map(rel => rel + mdatStartOffset);
            if (audioTrak) {
                aAbsOffsets.push(fakeStartInMdat + mdatStartOffset);
            } else {
                vAbsOffsets.push(fakeStartInMdat + mdatStartOffset);
            }
            const vStbl = findDescendant(videoTrak, ['mdia', 'minf', 'stbl']);
            const vStscBox = findChild(vStbl, 'stsc');
            const vStszBox = findChild(vStbl, 'stsz');
            const vStcoBox = findChild(vStbl, 'stco') || findChild(vStbl, 'co64');
            const vChunkCounts = new Array(vSamples.length).fill(1);
            const replacements = new Map([
                [vStcoBox, buildStco(vAbsOffsets)],
                [vStscBox, buildStscFromChunkMap(vChunkCounts)],
                [vStszBox, buildStsz(vSamples.map(s => s.size), 0)],
            ]);
            if (audioTrak) {
                const aStbl = findDescendant(audioTrak, ['mdia', 'minf', 'stbl']);
                const aStscBox = findChild(aStbl, 'stsc');
                const aStszBox = findChild(aStbl, 'stsz');
                const aStcoBox = findChild(aStbl, 'stco') || findChild(aStbl, 'co64');
                const aMdhdBox = findDescendant(audioTrak, ['mdia', 'mdhd']);
                const aChunkCounts = new Array(aSamples.length).fill(1);
                aChunkCounts.push(fakeSampleCount);
                const aSizes = aSamples.map(s => s.size);
                const aSampleDelta = aStts.length ? aStts[0][1] : 1024;
                replacements.set(aStcoBox, buildStco(aAbsOffsets));
                replacements.set(aStscBox, buildStscFromChunkMap(aChunkCounts));
                replacements.set(aStszBox, buildStsz(aSizes, fakeSampleCount));
                replacements.set(aSttsBox, buildStts(aStts, 0, aSampleDelta));
                replacements.set(aMdhdBox, buildMdhd(aMdhdBox, aTimescale, aStts.reduce((sum, entry) => sum + entry[0] * entry[1], 0)));
            }
            const moovFinal = rebuildBox(moov, replacements);
            moovHeaderLen = moovFinal.byteLength;
            if (pass === 3) {
                const newMdatBox = makeBox('mdat', newMdatPayload);
                finalOutput = concatBytes([ftypBytes, moovFinal, preservedBytes, newMdatBox]);
                const inputFps = Math.round(vTimescale / (vStts[0] ? vStts[0][1] : 1000));
                patchResultStats = {
                    output: finalOutput,
                    realSamples: vSamples.length,
                    fakeSamples: fakeSampleCount,
                    timescale: vTimescale,
                    sampleDelta: vStts[0] ? vStts[0][1] : 1000,
                    duration: (vSamples.length + fakeSampleCount) * (vStts[0] ? vStts[0][1] : 1000),
                    chunkCount: vAbsOffsets.length,
                    inputFps,
                    patchedFps: inputFps
                };
            }
        }
        _log(`Universal MP4 patch completed successfully. Total output: ${finalOutput.byteLength} bytes.`);
        return patchResultStats;
    }
    async function processVideoV2(file, mode = 'hd') {
        if (isProcessing) return;
        isProcessing = true;
        const isOff = mode === 'off';
        const modeLabel = mode === 'off' ? 'OFF' : mode === 'fast' ? 'Compatibility (720p)' : 'Quality (1080p)';
        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = window.getTranslation('status_processing');
        logSection('V2 PROCESS START');
        log(`  File     : ${file.name}`);
        log(`  Mode     : ${modeLabel}`);
        log(`  Buffer   : ${currentFileBuffer ? (currentFileBuffer.byteLength/(1024*1024)).toFixed(3)+' MB' : 'NOT LOADED'}`);
        logEnd();
        try {
            let dataToPath;
            if (isOff) {
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
                progressFill.style.width = '10%';
                progressPercent.textContent = '10%';
                logsEl.textContent += 'Compression skipped | reading original file...\n';
                dataToPath = new Uint8Array(currentFileBuffer);
                logSection('Direct Patch — Buffer Prep');
                log(`  Uint8Array byteLength : ${dataToPath.byteLength}`);
                log(`  byteOffset            : ${dataToPath.byteOffset}`);
                const h = dataToPath;
                log(`  First box size bytes  : [${h[0]},${h[1]},${h[2]},${h[3]}] = ${((h[0]<<24)|(h[1]<<16)|(h[2]<<8)|h[3])>>>0}`);
                log(`  First box type bytes  : ${String.fromCharCode(h[4],h[5],h[6],h[7])}`);
                log(`  Original size         : ${(dataToPath.byteLength / (1024 * 1024)).toFixed(3)} MB`);
                logEnd();
                progressFill.style.width = '40%';
                progressPercent.textContent = '40%';
            } else {
                const isReady = await loadFFmpegLibraries();
                if (!isReady) {
                    throw new Error("FFmpeg library failed to load. Please check your network connection and reload the page.");
                }
                const { FFmpeg } = window.FFmpegWASM;
                const { fetchFile, toBlobURL } = window.FFmpegUtil;
                const ffmpeg = new FFmpeg();
                let oomDetected = false;
                let oomLine = '';
                ffmpeg.on('progress', ({ progress }) => {
                    const percent = Math.max(0, Math.min(90, Math.round(progress * 90)));
                    progressFill.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_encoding')}</span>`;
                });
                let warnRepeatCount = 0;
                ffmpeg.on('log', ({ message }) => {
                    const lc = message.toLowerCase();
                    if (lc.includes('oom') || lc.includes('out of memory')) {
                        oomDetected = true;
                        oomLine = message;
                    }
                    if (lc.includes('missing picture in access') || lc.includes('no frame!') || lc.includes('invalid data found when processing')) {
                        warnRepeatCount++;
                        if (warnRepeatCount % 100 !== 1) {
                            return;
                        }
                    }
                    appendToLogsEl(message);
                });
                await loadFFmpegHelper(ffmpeg, toBlobURL);
                logSection('V2 FFmpeg — Writing Input');
                log(`  Buffer byteLength: ${currentFileBuffer.byteLength}`);
                await ffmpeg.writeFile('input.mp4', new Uint8Array(currentFileBuffer));
                log(`  Write: DONE`);
                logEnd();
                const hardwareThreads = navigator.hardwareConcurrency || 4;
                const threads = Math.min(4, hardwareThreads).toString();
                logSection('V2 FFmpeg — Command');
                log(`  Hardware threads : ${hardwareThreads}`);
                log(`  Using threads    : ${threads}`);
                log(`  Mode             : ${mode}`);
                let command;
                if (mode === 'fast') {
                    command = [
                        '-i', 'input.mp4',
                        '-threads', threads,
                        '-map_metadata', '-1',
                        '-map_chapters', '-1',
                        '-vf', "scale='if(lt(iw,ih),720,-2)':'if(lt(iw,ih),-2,720)',fps=60",
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-pix_fmt', 'yuv420p',
                        '-bf', '0',
                        '-video_track_timescale', '90000',
                        '-b:v', '16M',
                        '-minrate', '10M',
                        '-maxrate', '22M',
                        '-bufsize', '22M',
                        '-c:a', 'aac',
                        '-b:a', '320k',
                        '-movflags', '+faststart',
                        'compressed.mp4'
                    ];
                } else {
                    command = [
                        '-i', 'input.mp4',
                        '-threads', threads,
                        '-map_metadata', '-1',
                        '-map_chapters', '-1',
                        '-vf', "scale='if(lt(iw,ih),1080,-2)':'if(lt(iw,ih),-2,1080)',fps=60",
                        '-c:v', 'libx264',
                        '-preset', 'veryfast',
                        '-pix_fmt', 'yuv420p',
                        '-bf', '0',
                        '-video_track_timescale', '90000',
                        '-b:v', '19M',
                        '-minrate', '12M',
                        '-maxrate', '26M',
                        '-bufsize', '26M',
                        '-c:a', 'aac',
                        '-b:a', '320k',
                        '-movflags', '+faststart',
                        'compressed.mp4'
                    ];
                }
                logsEl.textContent += `Compressing: ffmpeg ${command.join(' ')}\n`;
                log(`  Full command: ffmpeg ${command.join(' ')}`);
                logEnd();
                logSection('V2 FFmpeg — Encoding');
                try {
                    await ffmpeg.exec(command);
                } catch (execError) {
                    try {
                        const testData = await ffmpeg.readFile('compressed.mp4');
                        if (!testData || testData.byteLength < 1024) {
                            throw execError;
                        }
                    } catch (readError) {
                        throw execError;
                    }
                }
                logEnd();
                if (oomDetected) {
                    log(`  OOM: ${oomLine}`);
                    throw new Error(`Out of memory during compression. (Triggered by log: "${oomLine}")`);
                }
                const compressedData = await ffmpeg.readFile('compressed.mp4');
                logSection('V2 FFmpeg — Compress Output');
                log(`  compressedData bytes : ${compressedData ? compressedData.byteLength : 0}`);
                log(`  compressedData byteOffset : ${compressedData ? compressedData.byteOffset : 'N/A'}`);
                log(`  Size : ${compressedData ? (compressedData.byteLength/(1024*1024)).toFixed(3)+' MB' : 'EMPTY'}`);
                if (!compressedData || compressedData.byteLength < 1024) {
                    log(`  ERROR: Compressed output is empty or too small!`);
                    throw new Error('Compression failed (output is empty or too small).');
                }
                logEnd();
                logsEl.textContent += `Compressed size: ${(compressedData.byteLength / (1024 * 1024)).toFixed(2)} MB\n`;
                dataToPath = compressedData;
            }
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_processing')}</span>`;
            progressText.textContent = window.getTranslation('status_processing');
            progressFill.style.width = '92%';
            progressPercent.textContent = '92%';
            logSection('MP4 Patch');
            const patchResult = patchMp4(dataToPath, log);
            log(`  Patch result:`);
            log(`    Real samples     : ${patchResult.realSamples}`);
            log(`    Fake samples     : ${patchResult.fakeSamples}`);
            log(`    Total declared   : ${patchResult.realSamples + patchResult.fakeSamples}`);
            log(`    Timescale        : ${patchResult.timescale}`);
            log(`    Sample delta     : ${patchResult.sampleDelta}`);
            log(`    Duration ticks   : ${patchResult.duration}`);
            log(`    Chunks           : ${patchResult.chunkCount}`);
            log(`    Output size      : ${(patchResult.output.byteLength/(1024*1024)).toFixed(3)} MB`);
            logEnd();
            logsEl.scrollTop = logsEl.scrollHeight;
            progressFill.style.width = '98%';
            progressPercent.textContent = '98%';
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
            const blob = new Blob([patchResult.output], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            logSection('Download');
            log(`  Blob size  : ${blob.size} bytes`);
            log(`  Blob type  : ${blob.type}`);
            log(`  Filename   : ${file.name.replace(/\.[^.]+$/, '')}_hq.mp4`);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.name.replace(/\.[^.]+$/, '')}_hq.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            log(`  Download triggered ✓`);
            logEnd();
            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = window.getTranslation('status_completed');
            btnStart.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            showStatusError(`Error: ${error.message}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }

    function detectVideoInfo(file) {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = url;
            video.onloadedmetadata = () => {
                const width = video.videoWidth || 1080;
                const height = video.videoHeight || 1920;
                const duration = video.duration || 1;
                URL.revokeObjectURL(url);
                resolve({ width, height, duration });
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 1080, height: 1920, duration: 1 });
            };
        });
    }

    function parseFpsFromLogs(logText) {
        if (!logText) return 60;
        const match = logText.match(/(\d+(?:\.\d+)?)\s*fps/i) || logText.match(/(\d+(?:\.\d+)?)\s*tbr/i);
        if (match) {
            const parsed = parseFloat(match[1]);
            if (parsed > 0 && parsed < 240) return Math.round(parsed);
        }
        return 60;
    }

    function computeOptimalSettings(measuredMbps, width, height, fps) {
        let targetBitrateMbps = Math.round((measuredMbps * 0.4) * 10) / 10;
        if (fps >= 60) targetBitrateMbps = Math.round((targetBitrateMbps * 1.1) * 10) / 10;
        targetBitrateMbps = Math.max(0.8, Math.min(5.0, targetBitrateMbps));
        let maxrateMbps = Math.round((targetBitrateMbps * 2.0) * 10) / 10;
        maxrateMbps = Math.max(2.0, Math.min(20.0, maxrateMbps));
        const bufsizeMbps = Math.max(4.0, Math.round(maxrateMbps * 3 * 10) / 10);
        const crf = targetBitrateMbps >= 3.5 ? 23 : (targetBitrateMbps >= 2.0 ? 25 : 27);
        return { targetBitrateMbps, maxrateMbps, bufsizeMbps, crf };
    }

    function patchMp4HDMethod(inputBuffer, isCompressedMode = false) {
        const result = patchMp4(inputBuffer);
        return result.output;
    }
    window.patchMp4HDMethod = patchMp4HDMethod;

    async function processVideoV3(file, mode = 'off') {
        if (isProcessing) return;
        isProcessing = true;

        const isOff = mode === 'off';
        const safeName = escapeHTML(file.name);

        btnStart.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        logsContainer.classList.remove('hidden');
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_loading_engine')}</span>`;
        progressFill.style.width = '0%';
        progressPercent.textContent = '0%';
        progressText.textContent = 'Processing V3...';

        logSection('PROCESSING');
        log(`  File   : ${safeName}`);
        log(`  Status : Processing video pipeline...`);
        logEnd();

        if (isOff) {
            log(`  [1/2] Executing Pure JS Patch...`);
            try {
                const patchedBytes = patchMp4HDMethod(currentFileBuffer, false);
                log(`  [2/2] Finalizing output package...`);

                const blob = new Blob([patchedBytes], { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                const filename = `${file.name.replace(/\.[^.]+$/, '')}_hd.mp4`;

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                log(`  Process Completed Successfully!`);
                statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                progressText.textContent = window.getTranslation('status_completed');
                btnStart.classList.remove('hidden');
                isProcessing = false;
                return;
            } catch (jsErr) {
                log(`  [Notice] Pure JS patch notice: ${jsErr.message}`);
            }
        }

        try {
            const isReady = await loadFFmpegLibraries();
            if (!isReady) throw new Error("Processing engine failed to load.");

            const { FFmpeg } = window.FFmpegWASM;
            const { toBlobURL } = window.FFmpegUtil;
            const ffmpeg = new FFmpeg();

            let oomDetected = false;

            ffmpeg.on('progress', ({ progress }) => {
                const percent = Math.max(0, Math.min(90, Math.round(progress * 90)));
                progressFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_encoding')}</span>`;
            });

            ffmpeg.on('log', ({ message }) => {
                const lc = message.toLowerCase();
                if (lc.includes('oom') || lc.includes('out of memory')) {
                    oomDetected = true;
                }
            });

            await loadFFmpegHelper(ffmpeg, toBlobURL);

            log(`  [1/3] Loading video data...`);
            await ffmpeg.writeFile('input.mp4', new Uint8Array(currentFileBuffer));

            const fileMB = file.size / (1024 * 1024);
            const hardwareThreads = navigator.hardwareConcurrency || 4;
            const safeThreads = (fileMB > 50) ? '2' : Math.min(4, hardwareThreads).toString();

            const ts = Math.floor(Date.now() / 1000);
            const hexHash = Math.random().toString(16).substring(2, 10);
            const sessionId = `${ts}_${hexHash}`;

            let command = [];

            if (isOff) {
                log(`  [2/3] Processing video stream...`);
                command = [
                    '-y', '-i', 'input.mp4',
                    '-map', '0:v:0',
                    '-map', '0:a:0?',
                    '-dn',
                    '-c:v', 'copy',
                    '-c:a', 'copy',
                    '-movflags', '+faststart',
                    '-map_metadata', '-1',
                    '-map_chapters', '-1',
                    'output.mp4'
                ];
            } else {
                log(`  [2/3] Optimizing video quality...`);
                const threads = fileMB > 50 ? '2' : safeThreads;

                command = [
                    '-y', '-i', 'input.mp4',
                    '-threads', threads,
                    '-map', '0:v:0',
                    '-map', '0:a:0?',
                    '-dn',
                    '-map_metadata', '-1',
                    '-map_chapters', '-1',
                    '-vf', "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '22',
                    '-maxrate', '12M',
                    '-bufsize', '20M',
                    '-pix_fmt', 'yuv420p',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-movflags', '+faststart',
                    '-map_metadata', '-1',
                    '-map_chapters', '-1',
                    'output.mp4'
                ];
            }

            try {
                await ffmpeg.exec(command);
            } catch (execError) {
                try {
                    const testData = await ffmpeg.readFile('output.mp4');
                    if (!testData || testData.byteLength < 1024) throw execError;
                } catch (rErr) {
                    throw execError;
                }
            }

            if (oomDetected) {
                throw new Error(`Memory limit reached during video processing.`);
            }

            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">${window.getTranslation('status_finalizing')}</span>`;
            progressText.textContent = 'Finalizing package...';
            progressFill.style.width = '95%';
            progressPercent.textContent = '95%';

            log(`  [3/3] Finalizing output package...`);
            const compressedData = await ffmpeg.readFile('output.mp4');

            try {
                await ffmpeg.deleteFile('input.mp4');
                await ffmpeg.deleteFile('output.mp4');
            } catch (cleanErr) {}

            const paddingUnit = new Uint8Array([0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00]);
            const paddingTotal = 79272;
            const paddingBuf = new Uint8Array(paddingTotal);
            for (let i = 0; i < paddingTotal; i += 8) {
                paddingBuf.set(paddingUnit, i);
            }

            const rawOutput = new Uint8Array(compressedData.buffer, compressedData.byteOffset, compressedData.byteLength);
            let finalResultBytes;
            try {
                finalResultBytes = patchMp4HDMethod(rawOutput, true);
            } catch (pErr) {
                log(`  [Notice] Dynamic patch fallback: ${pErr.message}`);
                finalResultBytes = concatBytes([rawOutput, paddingBuf]);
            }
            logEnd();

            const blob = new Blob([finalResultBytes], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const filename = `${file.name.replace(/\.[^.]+$/, '')}_hd.mp4`;

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            log(`  Process Completed Successfully!`);
            statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${window.getTranslation('status_completed')}</span>`;
            progressFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressText.textContent = window.getTranslation('status_completed');
            btnStart.classList.remove('hidden');

        } catch (error) {
            log(`  !! Process Error: ${escapeHTML(error.message)}`);
            console.error(error);
            showStatusError(`Error: ${escapeHTML(error.message)}`);
            btnStart.classList.remove('hidden');
        } finally {
            isProcessing = false;
        }
    }
});
