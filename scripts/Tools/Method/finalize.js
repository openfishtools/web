(function() {
    'use strict';

    /**
     * ╔═══════════════════════════════════════════════════════════════╗
     * ║                  CMT - CUTEFISH MEDIA TOOLS                   ║
     * ║                   Universal Finalize Module                   ║
     * ║                                                               ║
     * ║  Single source of truth for post-patch finalizing, downloading║
     * ║  naming standardization (*_hd.mp4), and UI completion hooks.  ║
     * ║  Designed for cutefish.my.id & Editorstuff CMT toolchain.     ║
     * ╚═══════════════════════════════════════════════════════════════╝
     *
     * @param {File} file - Original video File object
     * @param {Uint8Array} finalBytes - Processed media buffer bytes
     * @param {string|Object} [optionsOrSuffix='hd'] - Suffix string or config object { suffix, ext, mimeType }
     * @returns {{ url: string, filename: string, blob: Blob }}
     */
    function finalizePatcherDownload(file, finalBytes, optionsOrSuffix) {
        let suffix = 'hd';
        let ext = 'mp4';
        let mimeType = 'video/mp4';

        if (typeof optionsOrSuffix === 'string' && optionsOrSuffix.trim()) {
            suffix = optionsOrSuffix.trim();
        } else if (typeof optionsOrSuffix === 'object' && optionsOrSuffix !== null) {
            if (optionsOrSuffix.suffix) suffix = optionsOrSuffix.suffix;
            if (optionsOrSuffix.ext) ext = optionsOrSuffix.ext;
            if (optionsOrSuffix.mimeType) mimeType = optionsOrSuffix.mimeType;
        }

        // Standardize output filename to (nama file)_hd.mp4 across all methods
        if (suffix === 'shield' || suffix === 'fps' || suffix === 'binary' || suffix === 'fry' || !suffix) {
            suffix = 'hd';
        }

        const rawName = (file && file.name) ? file.name.replace(/\.[^.]+$/, '') : 'video';
        const filename = `${rawName}_${suffix}.${ext}`;

        const s = window._tktk || {};
        const blob = new Blob([finalBytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Auto trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Update modal download button
        const dlBtn = document.getElementById('tool-download-btn');
        if (dlBtn) {
            dlBtn.classList.remove('hidden');
            dlBtn.onclick = () => {
                const da = document.createElement('a');
                da.href = url;
                da.download = filename;
                document.body.appendChild(da);
                da.click();
                document.body.removeChild(da);
            };
        }

        const getT = (key, fallback) => {
            if (typeof window.getTranslation === 'function') {
                return window.getTranslation(key) || fallback;
            }
            return fallback;
        };

        if (s.log && typeof s.log === 'function') {
            s.log(`  Process Completed Successfully! Output: ${filename}`);
            if (typeof s.logEnd === 'function') s.logEnd();
        }

        if (s.statusText) {
            s.statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">&#10003; ${getT('status_completed', 'Selesai')}</span>`;
        }
        if (s.progressFill) s.progressFill.style.width = '100%';
        if (s.progressPercent) s.progressPercent.textContent = '100%';
        if (s.progressText) s.progressText.textContent = getT('status_completed', 'Selesai');

        if (window.ToolProgressManager) {
            window.ToolProgressManager.set('tool-tiktok-patcher', {
                isProcessing: false,
                completed: true,
                percent: 100,
                status: getT('status_completed', 'Selesai'),
                file
            });
        }

        const processBtn = document.getElementById('tool-process-btn');
        const processLabel = document.getElementById('tool-process-label');
        const processIcon = document.getElementById('tool-process-icon');
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.dataset.state = 'completed';
            if (processLabel) processLabel.textContent = getT('status_process_another', 'Process Another');
            if (processIcon) processIcon.textContent = 'restart_alt';
        }

        s.isProcessing = false;

        if (typeof window.showToast === 'function') {
            window.showToast(getT('status_completed_toast', 'Pemrosesan video berhasil diselesaikan!'));
        }

        if (typeof s.showTikTokStudioUploadPrompt === 'function') {
            s.showTikTokStudioUploadPrompt();
        }

        return { url, filename, blob };
    }

    // CMT & Global exports
    window.finalizePatcherDownload = finalizePatcherDownload;
    window.finalizeCMT = finalizePatcherDownload;
    if (window._tktk) {
        window._tktk.finalizePatcherDownload = finalizePatcherDownload;
    }

})();
