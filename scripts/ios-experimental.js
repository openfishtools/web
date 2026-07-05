document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-ios-input');
    const dropArea = document.getElementById('tool-ios-drop');
    const statusText = document.getElementById('tool-ios-status');
    const btnStart = document.getElementById('btn-start-ios');
    const progressContainer = document.getElementById('ios-progress-container');
    const progressFill = document.getElementById('ios-progress-fill');
    const progressPercent = document.getElementById('ios-progress-percent');
    const progressText = document.getElementById('ios-progress-text');
    const logsContainer = document.getElementById('ios-logs-container');
    const logsEl = document.getElementById('ios-logs');

    let selectedFile = null;
    let currentFileBuffer = null;
    let isProcessing = false;

    const MAX_FILE_MB_HARD = 1500;

    // --- Centralized logger ---
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

    // --- Browser detection ---
    function detectBrowser() {
        const ua = navigator.userAgent;
        if (/CriOS/i.test(ua))  return 'Chrome (iOS)';
        if (/FxiOS/i.test(ua))  return 'Firefox (iOS)';
        if (/EdgiOS/i.test(ua)) return 'Edge (iOS)';
        if (/OPiOS/i.test(ua))  return 'Opera (iOS)';
        if (/EdgA/i.test(ua))   return 'Edge (Android)';
        if (/SamsungBrowser/i.test(ua)) return 'Samsung Browser';
        if (/OPR|Opera/i.test(ua))      return 'Opera';
        if (/Edg\//i.test(ua))          return 'Edge';
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

    // --- Global error handlers ---
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

    // --- Copy logs button ---
    const btnCopyLogs = document.getElementById('btn-ios-copy-logs');
    const btnCopyLogsLabel = document.getElementById('btn-ios-copy-logs-label');
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

    // --- Drag and Drop File Handlers ---
    if (dropArea) {
        dropArea.addEventListener('click', () => {
            if (isProcessing) return;
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (isProcessing) return;
            dropArea.style.borderColor = 'var(--md-sys-color-primary)';
            dropArea.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        dropArea.addEventListener('dragleave', () => {
            dropArea.style.borderColor = '';
            dropArea.style.background = '';
        });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = '';
            dropArea.style.background = '';
            if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
        });
    }

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
        progressText.textContent = 'Processing...';
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    }

    const btnClearCache = document.getElementById('btn-ios-clear-cache');
    const btnHardRefresh = document.getElementById('btn-ios-hard-refresh');

    if (btnClearCache) {
        btnClearCache.addEventListener('click', () => {
            if (isProcessing) return;
            resetToolState();
            statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Cache cleared.</span>`;
            const icon = btnClearCache.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.4s ease';
                icon.style.transform = 'rotate(20deg) scale(1.15)';
                setTimeout(() => { icon.style.transform = ''; }, 400);
            }
        });
        btnClearCache.addEventListener('mouseenter', () => {
            btnClearCache.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnClearCache.addEventListener('mouseleave', () => {
            btnClearCache.style.background = 'none';
        });
    }

    if (btnHardRefresh) {
        btnHardRefresh.addEventListener('click', async () => {
            if (isProcessing) return;
            const icon = btnHardRefresh.querySelector('.material-symbols-rounded');
            if (icon) {
                icon.style.transition = 'transform 0.5s ease';
                icon.style.transform = 'rotate(360deg)';
            }
            try {
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(r => r.unregister()));
                }
            } catch (e) { /* ignore */ }
            location.reload(true);
        });
        btnHardRefresh.addEventListener('mouseenter', () => {
            btnHardRefresh.style.background = 'var(--md-sys-color-surface-container-high)';
        });
        btnHardRefresh.addEventListener('mouseleave', () => {
            btnHardRefresh.style.background = 'none';
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
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Selected: ${file.name} (${fileMB.toFixed(2)} MB)</span>`;
        btnStart.classList.remove('hidden');
        progressContainer.classList.add('hidden');
        logsContainer.classList.add('hidden');
        logsEl.textContent = '';
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read video file.'));
            reader.readAsArrayBuffer(file);
        });
    }

    // --- Direct Patch Function (No box modifications, just appends 8-byte box) ---
    function patchMp4Ios(inputData) {
        const srcArr = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
        
        // 8-byte box header: [0, 0, 0, 8, 102, 114, 101, 101] -> size 8, type 'free' (spec compliant dummy box)
        const fakeBox = new Uint8Array([0, 0, 0, 8, 102, 114, 101, 101]);
        
        const output = new Uint8Array(srcArr.byteLength + fakeBox.byteLength);
        output.set(srcArr, 0);
        output.set(fakeBox, srcArr.byteLength);
        
        return output;
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
        progressFill.style.width = '10%';
        progressPercent.textContent = '10%';
        progressText.textContent = 'Reading...';

        logSection('FILE READ');
        log(`  Name        : ${selectedFile.name}`);
        log(`  Size        : ${(selectedFile.size / (1024*1024)).toFixed(3)} MB (${selectedFile.size} bytes)`);
        log(`  MIME type   : ${selectedFile.type}`);
        log(`  Last modif  : ${new Date(selectedFile.lastModified).toISOString()}`);
        log(`  Browser     : ${detectBrowser()}`);
        log(`  OS          : ${detectOS()}`);
        log(`  Platform    : ${navigator.platform || 'unknown'}`);
        log(`  User-Agent  : ${navigator.userAgent}`);
        logEnd();

        try {
            currentFileBuffer = await readFileAsArrayBuffer(selectedFile);
            log(`  ArrayBuffer byteLength : ${currentFileBuffer.byteLength} bytes`);
            log(`  FileReader read        : SUCCESS`);
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

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Applying patch...</span>`;
        progressText.textContent = 'Patching...';
        progressFill.style.width = '60%';
        progressPercent.textContent = '60%';

        logSection('iOS DIRECT PATCH');
        log(`  Original size : ${currentFileBuffer.byteLength} bytes`);
        
        let outputBytes;
        try {
            outputBytes = patchMp4Ios(currentFileBuffer);
            log(`  Appended dummy box header (8 bytes, free)`);
            log(`  Output size   : ${outputBytes.byteLength} bytes`);
            log(`  Patch status  : SUCCESS`);
            logEnd();
        } catch (error) {
            log(`  Patch ERROR: ${error.message}`);
            logEnd();
            console.error(error);
            showStatusError(`Error applying patch: ${error.message}`);
            btnStart.classList.remove('hidden');
            isProcessing = false;
            return;
        }

        progressFill.style.width = '90%';
        progressPercent.textContent = '90%';
        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">Saving output...</span>`;

        logSection('DOWNLOAD');
        const blob = new Blob([outputBytes], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        log(`  Blob size  : ${blob.size} bytes`);
        log(`  Blob type  : ${blob.type}`);
        log(`  Filename   : ${selectedFile.name.replace(/\.[^.]+$/, '')}_ios_hq.mp4`);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedFile.name.replace(/\.[^.]+$/, '')}_ios_hq.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log(`  Download triggered ✓`);
        logEnd();

        statusText.innerHTML = `<span style="color: var(--md-sys-color-primary);">&#10003; Process complete! Download started.</span>`;
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        progressText.textContent = 'Complete!';
        btnStart.classList.remove('hidden');
        isProcessing = false;
    });
});
