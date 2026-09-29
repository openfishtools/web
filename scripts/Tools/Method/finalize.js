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
    /**
     * In-memory MP4 Container HDR Patch
     * Injects or updates the 19-byte colr (nclx) atom to declare ITU-R BT.2020 / ARIB STD-B67 (HLG)
     * color primaries and transfer characteristics without lossy re-encoding.
     *
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    function applyHdrColrPatch(data) {
        if (!data || data.length < 32) return data;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        // 1. Look for existing colr box
        for (let i = 0; i < data.length - 19; i++) {
            if (data[i+4] === 0x63 && data[i+5] === 0x6F && data[i+6] === 0x6C && data[i+7] === 0x72) {
                const size = view.getUint32(i, false);
                if (size >= 19 && i + size <= data.length) {
                    const colorType = String.fromCharCode(data[i+8], data[i+9], data[i+10], data[i+11]);
                    if (colorType === 'nclx') {
                        view.setUint16(i + 12, 9, false);  // BT.2020
                        view.setUint16(i + 14, 18, false); // HLG (ARIB STD-B67)
                        view.setUint16(i + 16, 9, false);  // BT.2020 non-constant
                        data[i + 18] = 0;                  // Limited range
                        return data;
                    }
                }
            }
        }

        // 2. Find stsd
        let stsdOffset = -1;
        for (let i = 0; i < data.length - 8; i++) {
            if (data[i+4] === 0x73 && data[i+5] === 0x74 && data[i+6] === 0x73 && data[i+7] === 0x64) {
                stsdOffset = i;
                break;
            }
        }
        if (stsdOffset === -1 || stsdOffset + 16 > data.length) return data;

        const sampleEntryOffset = stsdOffset + 16;
        const sampleEntrySize = view.getUint32(sampleEntryOffset, false);
        if (sampleEntrySize <= 8 || sampleEntryOffset + sampleEntrySize > data.length) return data;

        // 19-byte HLG colr box (BT.2020 / ARIB STD-B67 / BT.2020 non-constant / TV range)
        const colrBox = new Uint8Array([
            0x00, 0x00, 0x00, 0x13, // 19 bytes
            0x63, 0x6F, 0x6C, 0x72, // "colr"
            0x6E, 0x63, 0x6C, 0x78, // "nclx"
            0x00, 0x09,             // primaries: 9 (BT.2020)
            0x00, 0x12,             // transfer: 18 (HLG)
            0x00, 0x09,             // matrix: 9 (BT.2020)
            0x00                    // full range: 0
        ]);

        const insertPos = sampleEntryOffset + sampleEntrySize;
        const newBytes = new Uint8Array(data.length + 19);
        newBytes.set(data.subarray(0, insertPos), 0);
        newBytes.set(colrBox, insertPos);
        newBytes.set(data.subarray(insertPos), insertPos + 19);

        const newView = new DataView(newBytes.buffer, newBytes.byteOffset, newBytes.byteLength);

        // Expand sample entry size (+19)
        newView.setUint32(sampleEntryOffset, sampleEntrySize + 19, false);

        // Find moov
        let moovOffset = -1;
        for (let i = 0; i < newBytes.length - 8; i++) {
            if (newBytes[i+4] === 0x6D && newBytes[i+5] === 0x6F && newBytes[i+6] === 0x6F && newBytes[i+7] === 0x76) {
                moovOffset = i;
                break;
            }
        }

        function expandBox(off, amount) {
            const sz = newView.getUint32(off, false);
            newView.setUint32(off, sz + amount, false);
        }

        expandBox(stsdOffset, 19);

        function updateAncestors(start, max) {
            let off = start;
            while (off < max - 8) {
                const sz = newView.getUint32(off, false);
                if (sz <= 0 || off + sz > max) break;
                const type = String.fromCharCode(newBytes[off+4], newBytes[off+5], newBytes[off+6], newBytes[off+7]);
                if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
                    if (insertPos >= off && insertPos <= off + sz) {
                        expandBox(off, 19);
                        updateAncestors(off + 8, off + sz + 19);
                    }
                }
                off += (type === 'stsd' && insertPos >= off ? sz + 19 : sz);
            }
        }

        if (moovOffset !== -1) {
            expandBox(moovOffset, 19);
            updateAncestors(moovOffset + 8, moovOffset + newView.getUint32(moovOffset, false));
        }

        // Check if moov is before mdat
        let mdatOffset = -1;
        for (let i = 0; i < newBytes.length - 8; i++) {
            if (newBytes[i+4] === 0x6D && newBytes[i+5] === 0x64 && newBytes[i+6] === 0x61 && newBytes[i+7] === 0x74) {
                mdatOffset = i;
                break;
            }
        }

        if (moovOffset !== -1 && mdatOffset !== -1 && moovOffset < mdatOffset) {
            // Shift stco (32-bit chunk offsets)
            for (let i = 0; i < newBytes.length - 8; i++) {
                if (newBytes[i+4] === 0x73 && newBytes[i+5] === 0x74 && newBytes[i+6] === 0x63 && newBytes[i+7] === 0x6F) {
                    const count = newView.getUint32(i + 12, false);
                    for (let c = 0; c < count; c++) {
                        const oldOff = newView.getUint32(i + 16 + c * 4, false);
                        newView.setUint32(i + 16 + c * 4, oldOff + 19, false);
                    }
                }
                // Shift co64 (64-bit chunk offsets)
                if (newBytes[i+4] === 0x63 && newBytes[i+5] === 0x6F && newBytes[i+6] === 0x36 && newBytes[i+7] === 0x34) {
                    const count = newView.getUint32(i + 12, false);
                    for (let c = 0; c < count; c++) {
                        const high = newView.getUint32(i + 16 + c * 8, false);
                        const low = newView.getUint32(i + 20 + c * 8, false);
                        let val = BigInt(high) * 4294967296n + BigInt(low) + 19n;
                        newView.setUint32(i + 16 + c * 8, Number(val >> 32n), false);
                        newView.setUint32(i + 20 + c * 8, Number(val & 0xffffffffn), false);
                    }
                }
            }
        }

        return newBytes;
    }

    function hasCutefishMetadata(bytes) {
        const target = [99, 117, 116, 101, 102, 105, 115, 104, 46, 109, 121, 46, 105, 100]; // "cutefish.my.id"
        const max = Math.min(bytes.length - target.length, 4 * 1024 * 1024);
        for (let i = 0; i <= max; i++) {
            if (bytes[i] === target[0]) {
                let match = true;
                for (let j = 1; j < target.length; j++) {
                    if (bytes[i + j] !== target[j]) { match = false; break; }
                }
                if (match) return true;
            }
        }
        return false;
    }

    function applyCutefishMetadataPatch(bytes) {
        if (!bytes || bytes.length < 32) return bytes;
        if (hasCutefishMetadata(bytes)) return bytes;

        let moovOffset = -1;
        let moovSize = 0;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        for (let i = 0; i < bytes.length - 8; i++) {
            if (bytes[i+4] === 0x6D && bytes[i+5] === 0x6F && bytes[i+6] === 0x6F && bytes[i+7] === 0x76) {
                moovOffset = i;
                moovSize = view.getUint32(i, false);
                break;
            }
        }

        if (moovOffset === -1 || moovSize <= 8 || moovOffset + moovSize > bytes.length) {
            return bytes;
        }

        const textCmt = new TextEncoder().encode('cutefish.my.id');

        const cmtData = new Uint8Array(16 + textCmt.length);
        new DataView(cmtData.buffer).setUint32(0, cmtData.length, false);
        cmtData.set([0x64, 0x61, 0x74, 0x61, 0, 0, 0, 1, 0, 0, 0, 0], 4);
        cmtData.set(textCmt, 16);

        const cmtItem = new Uint8Array(8 + cmtData.length);
        new DataView(cmtItem.buffer).setUint32(0, cmtItem.length, false);
        cmtItem.set([0xa9, 0x63, 0x6d, 0x74], 4);
        cmtItem.set(cmtData, 8);

        const ilstSize = 8 + cmtItem.length;
        const ilstBox = new Uint8Array(ilstSize);
        new DataView(ilstBox.buffer).setUint32(0, ilstSize, false);
        ilstBox.set([0x69, 0x6c, 0x73, 0x74], 4);
        ilstBox.set(cmtItem, 8);

        const hdlrBox = new Uint8Array(33);
        new DataView(hdlrBox.buffer).setUint32(0, 33, false);
        hdlrBox.set([0x68, 0x64, 0x6c, 0x72], 4);
        hdlrBox.set([0x6d, 0x64, 0x69, 0x72], 12);

        const metaSize = 12 + hdlrBox.length + ilstBox.length;
        const metaBox = new Uint8Array(metaSize);
        new DataView(metaBox.buffer).setUint32(0, metaSize, false);
        metaBox.set([0x6d, 0x65, 0x74, 0x61], 4);
        metaBox.set(hdlrBox, 12);
        metaBox.set(ilstBox, 12 + hdlrBox.length);

        const udtaSize = 8 + metaBox.length;
        const udtaBox = new Uint8Array(udtaSize);
        new DataView(udtaBox.buffer).setUint32(0, udtaSize, false);
        udtaBox.set([0x75, 0x64, 0x74, 0x61], 4);
        udtaBox.set(metaBox, 8);

        let existingUdtaOffset = -1;
        let existingUdtaSize = 0;
        let p = moovOffset + 8;
        while (p < moovOffset + moovSize - 8) {
            const bSize = view.getUint32(p, false);
            if (bSize < 8 || p + bSize > moovOffset + moovSize) break;
            const bType = String.fromCharCode(bytes[p+4], bytes[p+5], bytes[p+6], bytes[p+7]);
            if (bType === 'udta') {
                existingUdtaOffset = p;
                existingUdtaSize = bSize;
                break;
            }
            p += bSize;
        }

        let newBytes;
        let sizeDiff = 0;

        if (existingUdtaOffset !== -1) {
            sizeDiff = udtaSize - existingUdtaSize;
            newBytes = new Uint8Array(bytes.length + sizeDiff);
            newBytes.set(bytes.subarray(0, existingUdtaOffset), 0);
            newBytes.set(udtaBox, existingUdtaOffset);
            newBytes.set(bytes.subarray(existingUdtaOffset + existingUdtaSize), existingUdtaOffset + udtaSize);
        } else {
            sizeDiff = udtaSize;
            const insertPos = moovOffset + moovSize;
            newBytes = new Uint8Array(bytes.length + sizeDiff);
            newBytes.set(bytes.subarray(0, insertPos), 0);
            newBytes.set(udtaBox, insertPos);
            newBytes.set(bytes.subarray(insertPos), insertPos + sizeDiff);
        }

        const newView = new DataView(newBytes.buffer);
        newView.setUint32(moovOffset, moovSize + sizeDiff, false);

        let mdatOffset = -1;
        for (let i = 0; i < newBytes.length - 8; i++) {
            if (newBytes[i+4] === 0x6D && newBytes[i+5] === 0x64 && newBytes[i+6] === 0x61 && newBytes[i+7] === 0x74) {
                mdatOffset = i;
                break;
            }
        }

        if (sizeDiff !== 0 && moovOffset < mdatOffset) {
            const newMoovEnd = moovOffset + moovSize + sizeDiff;
            for (let i = moovOffset; i < newMoovEnd - 8; i++) {
                if (newBytes[i+4] === 0x73 && newBytes[i+5] === 0x74 && newBytes[i+6] === 0x63 && newBytes[i+7] === 0x6F) {
                    const count = newView.getUint32(i + 12, false);
                    for (let c = 0; c < count; c++) {
                        const oldOff = newView.getUint32(i + 16 + c * 4, false);
                        newView.setUint32(i + 16 + c * 4, oldOff + sizeDiff, false);
                    }
                }
                if (newBytes[i+4] === 0x63 && newBytes[i+5] === 0x6F && newBytes[i+6] === 0x36 && newBytes[i+7] === 0x34) {
                    const count = newView.getUint32(i + 12, false);
                    for (let c = 0; c < count; c++) {
                        const high = newView.getUint32(i + 16 + c * 8, false);
                        const low = newView.getUint32(i + 20 + c * 8, false);
                        let val = BigInt(high) * 4294967296n + BigInt(low) + BigInt(sizeDiff);
                        newView.setUint32(i + 16 + c * 8, Number(val >> 32n), false);
                        newView.setUint32(i + 20 + c * 8, Number(val & 0xffffffffn), false);
                    }
                }
            }
        }

        return newBytes;
    }

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

        const s = window._tktk || {};

        // Check if HDR (BETA) is enabled
        const isHdr = (optionsOrSuffix && optionsOrSuffix.hdr !== undefined)
            ? !!optionsOrSuffix.hdr
            : (s.hdrEnabled === true || window.hdrEnabled === true);

        if (isHdr && ext === 'mp4' && finalBytes && finalBytes.length > 32) {
            try {
                finalBytes = applyHdrColrPatch(finalBytes);
                if (s.log && typeof s.log === 'function') {
                    s.log('  [HDR BETA] Injected HLG Rec.2020 container color metadata.');
                }
            } catch (hdrErr) {
                console.warn('[HDR BETA] Error applying HDR colr patch:', hdrErr);
            }
        }

        // Ensure cutefish.my.id container metadata is present for userscript and analyzer detection
        if (ext === 'mp4' && finalBytes && finalBytes.length > 32) {
            try {
                finalBytes = applyCutefishMetadataPatch(finalBytes);
            } catch (metaErr) {
                console.warn('[Metadata] Error ensuring cutefish.my.id metadata:', metaErr);
            }
        }

        const rawName = (file && file.name) ? file.name.replace(/\.[^.]+$/, '') : 'video';
        const filename = `${rawName}_${suffix}.${ext}`;

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
    window.applyHdrColrPatch = applyHdrColrPatch;
    if (window._tktk) {
        window._tktk.finalizePatcherDownload = finalizePatcherDownload;
        window._tktk.applyHdrColrPatch = applyHdrColrPatch;
    }

})();
