// ==UserScript==
// @name         TikTok Cloud Edit Disabler
// @namespace    https://cutefish.my.id/
// @version      1.3.3
// @description  Menonaktifkan Cloud Canvas Video Editor di TikTok Studio (tiktok.com/tiktokstudio) agar kualitas video 1080p dan 120 FPS tidak di-downscale paksa ke 720p.
// @author       cutefishaep
// @match        https://*.tiktok.com/*
// @match        *://localhost/*
// @match        *://127.0.0.1/*
// @match        *://cutefish.my.id/*
// @match        *://*.cutefish.my.id/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  'use strict';

  const win = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

  if (win.__TIKTOK_CLOUD_DISABLER_HOOK__) return;
  win.__TIKTOK_CLOUD_DISABLER_HOOK__ = true;
  win.__TIKTOK_CLOUD_DISABLER__ = true;
  win.__TIKTOK_CLOUD_DISABLER_VERSION__ = '1.3.3';

  try {
    document.documentElement.dataset.tiktokCloudDisabler = 'active';
    document.documentElement.dataset.tiktokCloudDisablerVersion = '1.3.3';
  } catch (_) {}

  // Respond to ping from web app
  win.addEventListener('message', (event) => {
    if (event.data?.type === 'TIKTOK_CLOUD_DISABLER_PING' || event.data?.type === 'ADJN_PING') {
      win.postMessage({ type: 'TIKTOK_CLOUD_DISABLER_PONG', version: '1.3.3', source: 'TIKTOK_CLOUD_DISABLER' }, '*');
    }
  });

  const isTikTokSite = /tiktok\.com$/i.test(location.hostname) || location.hostname.includes('tiktok.com');
  const isTikTokStudio = isTikTokSite && (
    location.pathname.includes('/tiktokstudio') ||
    location.pathname.includes('/upload') ||
    location.pathname.includes('/creator-center')
  );

  // Diagnostic Log Queue for the UI Widget
  const logEntries = [
    'System: TikTok Studio Cloud Disabler v1.3.3',
    `Host: ${location.hostname}`,
    `UserAgent: ${navigator.userAgent.substring(0, 48)}...`,
    `Engine: SharedArrayBuffer=${typeof SharedArrayBuffer !== 'undefined' ? 'Supported' : 'Disabled'}, WebCodecs=${typeof VideoEncoder !== 'undefined' ? 'Supported' : 'Disabled'}`,
    `FFmpeg Core: In-Browser Canvas Re-Encoder + Sentinel MP4 Box Patcher Active`,
    'Fetch / XHR Hook: Cloud Canvas payload interceptor active',
    'Blob / FileReader Hook: Auto ArrayBuffer patcher ready',
    'TikTok Studio Hook: Active'
  ];

  let addUiLog = (msg) => {
    logEntries.push(msg);
  };

  function isPublishPayload(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.cloud_edit_is_use_video_canvas !== undefined) return true;
    if (Array.isArray(obj.single_post_req_list)) return true;
    if (obj.post_common_info && typeof obj.post_common_info === 'object') return true;
    if (obj.canvas_config !== undefined || obj.draft !== undefined || obj.vedit_segment_info !== undefined) return true;
    return false;
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') return;

    ['draft', 'canvas_config', 'vedit_segment_info'].forEach((key) => {
      if (payload[key] !== undefined) delete payload[key];
    });

    if (payload.cloud_edit_is_use_video_canvas !== undefined) {
      payload.cloud_edit_is_use_video_canvas = false;
    }
    payload.psg_vsp_aud = true;

    if (payload.enter_post_page_from !== undefined) {
      payload.enter_post_page_from = 1;
    }

    if (payload.post_common_info && typeof payload.post_common_info === 'object') {
      payload.post_common_info.post_type = 3;
      payload.post_common_info.enter_post_page_from = 1;
      payload.post_common_info.psg_vsp_aud = true;
    }

    if (Array.isArray(payload.single_post_req_list)) {
      payload.single_post_req_list.forEach((req) => {
        req.psg_vsp_aud = true;
        const info = req?.single_post_feature_info;
        if (!info || typeof info !== 'object') return;
        if (info.vedit_segment_info !== undefined) delete info.vedit_segment_info;
        info.cloud_edit_is_use_video_canvas = false;
        info.has_original_audio = 1;
        info.psg_vsp_aud = true;
        info.video_quality_score = 1.0;
        info.is_high_quality = true;
      });
    }

    const timeStr = new Date().toLocaleTimeString([], { hour12: false });
    addUiLog(`[${timeStr}] Cloud Canvas disabled`);
    addUiLog(`[${timeStr}] Kualitas 1080p/120fps dipertahankan`);
  }

  function transformJsonString(jsonStr) {
    if (typeof jsonStr !== 'string') return jsonStr;
    try {
      const parsed = JSON.parse(jsonStr);
      if (isPublishPayload(parsed)) {
        normalizePayload(parsed);
        return JSON.stringify(parsed);
      }
    } catch (_) {}
    return jsonStr;
  }

  // 1. Hook JSON.stringify
  const nativeStringify = win.JSON.stringify;
  win.JSON.stringify = function(value, replacer, space) {
    if (value && typeof value === 'object') {
      if (value.hasOwnProperty('video_quality_score') || value.hasOwnProperty('is_high_quality')) {
        value.video_quality_score = 1.0;
        value.is_high_quality = true;
      }
      if (isPublishPayload(value)) {
        try {
          normalizePayload(value);
        } catch (_) {}
      }
    }
    return nativeStringify.call(this, value, replacer, space);
  };

  // 2. Hook window.fetch
  if (typeof win.fetch === 'function') {
    const originalFetch = win.fetch;
    win.fetch = async function(input, init) {
      try {
        if (init && typeof init.body === 'string') {
          init.body = transformJsonString(init.body);
        }
      } catch (_) {}
      return originalFetch.apply(this, arguments);
    };
  }

  // 3. Hook XMLHttpRequest.prototype.send
  if (typeof win.XMLHttpRequest !== 'undefined' && win.XMLHttpRequest.prototype) {
    const originalSend = win.XMLHttpRequest.prototype.send;
    win.XMLHttpRequest.prototype.send = function(body) {
      try {
        if (typeof body === 'string') {
          arguments[0] = transformJsonString(body);
        }
      } catch (_) {}
      return originalSend.apply(this, arguments);
    };
  }

  // ================= IN-BROWSER VIDEO COMPRESSOR RE-ENCODER =================
  async function compressVideoInBrowser(file, targetRes, onProgress) {
    if (!targetRes || targetRes === 'OFF') return file;

    return new Promise((resolve) => {
      const timeStr = () => new Date().toLocaleTimeString([], { hour12: false });
      addUiLog(`[${timeStr()}] Compressor: Initializing Frame-Stepping Canvas + MediaRecorder engine...`);

      const video = document.createElement('video');
      video.preload = 'auto';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = async () => {
        try {
          let origWidth = video.videoWidth || 1080;
          let origHeight = video.videoHeight || 1920;

          let targetH = targetRes === '720p' ? 720 : 1080;
          let scale = 1.0;

          if (origHeight > origWidth) {
            if (origHeight > targetH) scale = targetH / origHeight;
          } else {
            if (origWidth > targetH) scale = targetH / origWidth;
          }

          const targetW = Math.round((origWidth * scale) / 2) * 2;
          const outH = Math.round((origHeight * scale) / 2) * 2;

          addUiLog(`[${timeStr()}] Input Video: ${origWidth}x${origHeight} @ ${(video.duration || 0).toFixed(1)}s`);
          addUiLog(`[${timeStr()}] Target Scale: ${targetW}x${outH} (${targetRes.toUpperCase()})`);

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');

          const stream = canvas.captureStream(60);

          let mimeType = 'video/mp4;codecs=avc1';
          if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/mp4';
          }
          if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm;codecs=vp9';
          }
          if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'video/webm';
          }

          const targetBitrate = targetH === 720 ? 5000000 : 10000000;
          addUiLog(`[${timeStr()}] Encoder Config: Bitrate=${(targetBitrate / 1000000).toFixed(1)} Mbps, Codec=${mimeType}`);

          const options = { mimeType, videoBitsPerSecond: targetBitrate };
          let mediaRecorder;
          try {
            mediaRecorder = new MediaRecorder(stream, options);
          } catch (_) {
            mediaRecorder = new MediaRecorder(stream);
          }

          const chunks = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            URL.revokeObjectURL(video.src);
            const compressedBlob = new Blob(chunks, { type: file.type || 'video/mp4' });
            const compressedFile = new File([compressedBlob], file.name, { type: file.type || 'video/mp4' });
            const origMB = (file.size / 1048576).toFixed(2);
            const compMB = (compressedFile.size / 1048576).toFixed(2);
            const diffMB = (file.size > compressedFile.size) ? (origMB - compMB).toFixed(2) : 0;
            addUiLog(`[${timeStr()}] Compression Complete: ${origMB} MB -> ${compMB} MB (Saved: ${diffMB} MB)`);
            resolve(compressedFile);
          };

          mediaRecorder.start(100);
          addUiLog(`[${timeStr()}] Frame-stepping 60 FPS encoding started...`);

          const duration = video.duration || 10;
          const fps = 60;
          const frameTime = 1 / fps;
          let currentTime = 0;
          let lastLoggedMilestone = -1;

          const renderFrame = () => {
            ctx.drawImage(video, 0, 0, targetW, outH);
            if (duration > 0) {
              const pct = Math.min(Math.round((currentTime / duration) * 100), 99);
              if (onProgress) onProgress(pct);

              const milestone = Math.floor(pct / 25) * 25;
              if (milestone > 0 && milestone !== lastLoggedMilestone && milestone <= 75) {
                lastLoggedMilestone = milestone;
                addUiLog(`[${timeStr()}] Encoding progress: ${milestone}%`);
              }
            }

            currentTime += frameTime;
            if (currentTime >= duration) {
              setTimeout(() => {
                if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
              }, 200);
            } else {
              video.currentTime = currentTime;
            }
          };

          video.onseeked = renderFrame;
          video.currentTime = 0;
        } catch (err) {
          URL.revokeObjectURL(video.src);
          addUiLog(`[${timeStr()}] Compressor Error: ${err.message}, fallback to raw file`);
          resolve(file);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        addUiLog(`[${timeStr()}] Video Load Error, fallback to raw file`);
        resolve(file);
      };
    });
  }

  // ================= BINARY PATCHER SENTINEL ENGINE =================
  let selectedMethod = 'BINARY';
  let selectedCompress = 'OFF';

  function patchBinaryBuffer(input) {
    let patchedCount = 0;
    try {
      const buffer = (input && input.buffer) ? input.buffer : input;
      if (!buffer || !(buffer instanceof ArrayBuffer || buffer instanceof SharedArrayBuffer)) {
        return { bytes: input, count: 0 };
      }
      const bytes = new Uint8Array(buffer);
      const view = new DataView(buffer);
      const len = bytes.length;

      for (let i = 0; i < len - 8; i++) {
        // Match 'mvhd' (Movie Header Box: 0x6d, 0x76, 0x68, 0x64)
        if (bytes[i] === 0x6D && bytes[i+1] === 0x76 && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
          const ver = view.getUint8(i + 4);
          const timescaleOffset = ver === 1 ? i + 24 : i + 16;
          if (timescaleOffset + 4 <= len) {
            view.setUint32(timescaleOffset, 60000, false);
            patchedCount++;
          }
        }
        // Match 'mdhd' (Media Header Box: 0x6d, 0x64, 0x68, 0x64)
        else if (bytes[i] === 0x6D && bytes[i+1] === 0x64 && bytes[i+2] === 0x68 && bytes[i+3] === 0x64) {
          const ver = view.getUint8(i + 4);
          const timescaleOffset = ver === 1 ? i + 24 : i + 16;
          if (timescaleOffset + 4 <= len) {
            view.setUint32(timescaleOffset, 60000, false);
            patchedCount++;
          }
        }
      }
      return { bytes, count: patchedCount };
    } catch (err) {
      return { bytes: (input instanceof Uint8Array ? input : new Uint8Array(input || [])), count: 0 };
    }
  }

  // Automatic ArrayBuffer patcher hook for Blobs/Files
  if (typeof Blob !== 'undefined' && Blob.prototype.arrayBuffer) {
    const origArrayBuffer = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function() {
      const buffer = await origArrayBuffer.call(this);
      try {
        const isVideo = (this.type && this.type.startsWith('video/')) ||
                        (this.name && /\.(mp4|mov|webm|wmv)$/i.test(this.name)) ||
                        (buffer.byteLength > 100);
        if (isVideo && (selectedMethod === 'BINARY' || selectedMethod === 'FPS')) {
          const { count } = patchBinaryBuffer(buffer);
          if (count > 0) {
            const timeStr = new Date().toLocaleTimeString([], { hour12: false });
            addUiLog(`[${timeStr}] Auto-patched Blob arrayBuffer (${count} box)`);
          }
        }
      } catch (_) {}
      return buffer;
    };
  }

  // Hook FileReader.prototype.readAsArrayBuffer
  if (typeof FileReader !== 'undefined' && FileReader.prototype.readAsArrayBuffer) {
    const origReadAsArrayBuffer = FileReader.prototype.readAsArrayBuffer;
    FileReader.prototype.readAsArrayBuffer = function(blob) {
      this.addEventListener('load', () => {
        if (this.result && this.result instanceof ArrayBuffer) {
          try {
            const isVideo = (blob && blob.type && blob.type.startsWith('video/')) ||
                            (blob && blob.name && /\.(mp4|mov|webm|wmv)$/i.test(blob.name)) ||
                            (this.result.byteLength > 100);
            if (isVideo && (selectedMethod === 'BINARY' || selectedMethod === 'FPS')) {
              const { count } = patchBinaryBuffer(this.result);
              if (count > 0) {
                const timeStr = new Date().toLocaleTimeString([], { hour12: false });
                addUiLog(`[${timeStr}] Auto-patched FileReader arrayBuffer (${count} box)`);
              }
            }
          } catch (_) {}
        }
      }, { once: true });
      return origReadAsArrayBuffer.call(this, blob);
    };
  }

  // ================= FULL-COVER DRAG & DROP OVERLAY PATCHER =================
  function findUploadContainer() {
    return document.querySelector('.upload-card, .before-upload-new-stage, [class*="upload-card"], [class*="before-upload-new-stage"], [class*="upload-stage"], [class*="uploader-container"], [class*="drop-zone"], [class*="file-uploader"]');
  }

  let pendingRawFile = null;
  let isPatchingFile = false;

  function showPatcherOverlay(file) {
    pendingRawFile = file;
    const container = findUploadContainer();
    if (!container) return;

    container.style.position = 'relative';

    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(inp => {
      inp.disabled = true;
      inp.style.pointerEvents = 'none';
    });

    const restoreInputs = () => {
      fileInputs.forEach(inp => {
        inp.disabled = false;
        inp.style.pointerEvents = '';
      });
    };

    const existing = document.getElementById('cf-drag-patcher-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cf-drag-patcher-overlay';

    ['dragenter', 'dragover', 'dragleave', 'drop', 'click', 'pointerdown', 'mousedown'].forEach(evtType => {
      overlay.addEventListener(evtType, (e) => {
        e.stopPropagation();
      }, true);
    });

    const style = document.createElement('style');
    style.textContent = `
      #cf-drag-patcher-overlay {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        min-height: 320px !important;
        background: #171a13 !important;
        border: 2px solid #bedc74 !important;
        border-radius: 16px !important;
        z-index: 99999 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 24px !important;
        box-sizing: border-box !important;
        color: #edf0e8 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        pointer-events: auto !important;
      }
      #cf-drag-patcher-overlay * {
        box-sizing: border-box !important;
      }
      .cf-overlay-card {
        width: 100% !important;
        max-width: 440px !important;
        text-align: center !important;
      }
      .cf-overlay-label {
        font-size: 11px !important;
        font-weight: 700 !important;
        color: #bedc74 !important;
        text-align: left !important;
        margin-bottom: 6px !important;
        margin-top: 10px !important;
        letter-spacing: 0.5px !important;
      }
      .cf-overlay-group {
        display: flex !important;
        gap: 8px !important;
        margin-bottom: 12px !important;
      }
      .cf-overlay-chip {
        flex: 1 !important;
        padding: 8px 0 !important;
        text-align: center !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        background: #20241a !important;
        border: 1px solid rgba(190, 220, 116, 0.3) !important;
        color: #edf0e8 !important;
        border-radius: 999px !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
      }
      .cf-overlay-chip.active {
        background: #bedc74 !important;
        color: #171a13 !important;
        border-color: #bedc74 !important;
      }
      .cf-action-btn {
        width: 100% !important;
        padding: 12px 0 !important;
        margin-top: 16px !important;
        background: #bedc74 !important;
        color: #171a13 !important;
        border: none !important;
        border-radius: 999px !important;
        font-size: 13.5px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        transition: background 0.15s ease !important;
      }
      .cf-action-btn:hover {
        background: #d4f090 !important;
      }
      .cf-cancel-btn {
        background: transparent !important;
        border: none !important;
        color: #9aa491 !important;
        font-size: 11.5px !important;
        margin-top: 10px !important;
        cursor: pointer !important;
        text-decoration: underline !important;
      }
      .cf-progress-container {
        width: 100% !important;
        margin-top: 16px !important;
        display: none;
      }
      .cf-progress-bar-bg {
        width: 100% !important;
        height: 8px !important;
        background: #20241a !important;
        border-radius: 999px !important;
        overflow: hidden !important;
        margin-bottom: 8px !important;
      }
      .cf-progress-bar-fill {
        width: 0% !important;
        height: 100% !important;
        background: #bedc74 !important;
        transition: width 0.1s linear !important;
      }
      .cf-progress-text {
        font-size: 11.5px !important;
        color: #bedc74 !important;
        font-weight: 600 !important;
      }
    `;

    overlay.appendChild(style);

    let selectedMethod = 'BINARY';
    let selectedCompress = 'OFF';

    const card = document.createElement('div');
    card.className = 'cf-overlay-card';
    card.innerHTML = `
      <div class="cf-overlay-label">PILIH METODE:</div>
      <div class="cf-overlay-group" id="cf-ov-method-group">
        <div class="cf-overlay-chip active" data-val="BINARY">BINARY</div>
        <div class="cf-overlay-chip" data-val="FPS">FPS</div>
        <div class="cf-overlay-chip" data-val="WMV">WMV</div>
      </div>

      <div id="cf-ov-compress-section">
        <div class="cf-overlay-label">KOMPRESI RESOLUSI:</div>
        <div class="cf-overlay-group" id="cf-ov-compress-group">
          <div class="cf-overlay-chip active" data-val="OFF">OFF</div>
          <div class="cf-overlay-chip" data-val="720p">720P</div>
          <div class="cf-overlay-chip" data-val="1080p">1080P</div>
        </div>
      </div>

      <button type="button" class="cf-action-btn" id="cf-btn-start-process">patch & upload</button>
      <div><button type="button" class="cf-cancel-btn" id="cf-btn-cancel">Batal</button></div>

      <div class="cf-progress-container" id="cf-progress-container">
        <div class="cf-progress-bar-bg">
          <div class="cf-progress-bar-fill" id="cf-progress-fill"></div>
        </div>
        <div class="cf-progress-text" id="cf-progress-text">Memproses video... 0%</div>
      </div>
    `;

    overlay.appendChild(card);
    container.appendChild(overlay);

    const removeOverlay = () => {
      restoreInputs();
      overlay.remove();
    };

    const methodChips = overlay.querySelectorAll('#cf-ov-method-group .cf-overlay-chip');
    const compressSection = overlay.querySelector('#cf-ov-compress-section');
    const compressChips = overlay.querySelectorAll('#cf-ov-compress-group .cf-overlay-chip');
    const processBtn = overlay.querySelector('#cf-btn-start-process');
    const cancelBtn = overlay.querySelector('#cf-btn-cancel');
    const progressContainer = overlay.querySelector('#cf-progress-container');
    const progressFill = overlay.querySelector('#cf-progress-fill');
    const progressText = overlay.querySelector('#cf-progress-text');

    methodChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        methodChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedMethod = chip.dataset.val;
        if (selectedMethod === 'BINARY') {
          compressSection.style.display = 'block';
        } else {
          compressSection.style.display = 'none';
        }
      });
    });

    compressChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        compressChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedCompress = chip.dataset.val;
      });
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeOverlay();
      pendingRawFile = null;
    });

    processBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!pendingRawFile || isPatchingFile) return;
      isPatchingFile = true;

      processBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      progressContainer.style.display = 'block';

      const fileSizeMB = (pendingRawFile.size / (1024 * 1024)).toFixed(2);
      const timeStr = new Date().toLocaleTimeString([], { hour12: false });
      addUiLog(`[${timeStr}] Memulai proses patch & upload: ${pendingRawFile.name}`);
      addUiLog(`[${timeStr}] Ukuran awal: ${fileSizeMB} MB, Tipe: ${pendingRawFile.type || 'video/mp4'}`);
      addUiLog(`[${timeStr}] Metode: ${selectedMethod}, Kompresi Target: ${selectedCompress.toUpperCase()}`);

      try {
        let videoToPatch = pendingRawFile;

        // Physical In-Browser Re-encoding / Compression if 720p or 1080p selected
        if (selectedCompress !== 'OFF') {
          videoToPatch = await compressVideoInBrowser(pendingRawFile, selectedCompress, (pct) => {
            progressFill.style.width = pct + '%';
            progressText.textContent = `Mengompresi video (${selectedCompress.toUpperCase()})... ${pct}%`;
          });
        }

        progressFill.style.width = '95%';
        progressText.textContent = 'Menerapkan patch binary timescale (60 FPS)...';

        let finalFile = videoToPatch;
        if (selectedMethod === 'BINARY' || selectedMethod === 'FPS') {
          addUiLog(`[${timeStr}] Executing Sentinel MP4 Box Patcher...`);
          const buf = await videoToPatch.arrayBuffer();
          const { bytes: patchedU8, count } = patchBinaryBuffer(buf);
          const patchedBlob = new Blob([patchedU8], { type: videoToPatch.type || 'video/mp4' });
          finalFile = new File([patchedBlob], pendingRawFile.name, { type: videoToPatch.type || 'video/mp4' });
          addUiLog(`[${timeStr}] Timescale patch diterapkan (${count} box diperbarui)`);
        }

        progressFill.style.width = '100%';
        progressText.textContent = 'Proses patch selesai. Mengunggah ke TikTok Studio...';

        await new Promise(r => setTimeout(r, 400));

        restoreInputs();
        const input = document.querySelector('input[type="file"]');
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(finalFile);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          addUiLog(`[${timeStr}] File terkompresi & ter-patch dikirim ke TikTok Studio`);
        }

        overlay.remove();
      } catch (err) {
        restoreInputs();
        progressText.textContent = `Error: ${err.message}`;
        addUiLog(`[Error] Proses gagal: ${err.message}`);
      } finally {
        pendingRawFile = null;
        setTimeout(() => { isPatchingFile = false; }, 1000);
      }
    });
  }

  function setupDropHandler() {
    if (!isTikTokStudio) return;

    document.addEventListener('change', (e) => {
      if (isPatchingFile || document.getElementById('cf-drag-patcher-overlay')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      const target = e.target;
      if (target && target.tagName === 'INPUT' && target.type === 'file') {
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          if (file.type.startsWith('video/') || /\.(mp4|mov|webm|wmv)$/i.test(file.name)) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showPatcherOverlay(file);
          }
        }
      }
    }, true);

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    }, true);

    document.addEventListener('drop', (e) => {
      if (isPatchingFile || document.getElementById('cf-drag-patcher-overlay')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/') || /\.(mp4|mov|webm|wmv)$/i.test(file.name)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showPatcherOverlay(file);
        }
      }
    }, true);
  }

  // ================= UI BADGE & LOGS WINDOW (TIKTOK STUDIO ONLY) =================
  function shouldShowBadge() {
    const url = (location.href || '').toLowerCase();
    return url.includes('tiktokstudio') || url.includes('/upload') || url.includes('creator-center');
  }

  function initIndicator() {
    if (!shouldShowBadge()) {
      const existing = document.getElementById('cf-tktk-disabler-root');
      if (existing) existing.remove();
      return;
    }

    let root = document.getElementById('cf-tktk-disabler-root');
    const targetParent = document.body || document.documentElement;
    if (!targetParent) return;

    if (!root) {
      setupDropHandler();

      root = document.createElement('div');
      root.id = 'cf-tktk-disabler-root';

      // Inject styles: GreenTea Material You, NO BLUR, pure solid lightweight
      const style = document.createElement('style');
      style.textContent = `
        #cf-tktk-disabler-root {
          position: fixed !important;
          bottom: 24px !important;
          right: 24px !important;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
          color: #edf0e8 !important;
          user-select: none !important;
          box-sizing: border-box !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        #cf-tktk-disabler-root * {
          box-sizing: border-box !important;
        }
        .cf-badge {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          background: #171a13 !important;
          border: 1px solid #bedc74 !important;
          border-radius: 9999px !important;
          padding: 6px 12px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #edf0e8 !important;
          cursor: pointer !important;
          box-shadow: none !important;
          filter: none !important;
          backdrop-filter: none !important;
        }
        .cf-badge:hover {
          background: #20241a !important;
        }
        .cf-dot {
          width: 6px !important;
          height: 6px !important;
          border-radius: 50% !important;
          background: #bedc74 !important;
          box-shadow: none !important;
          filter: none !important;
          flex-shrink: 0 !important;
        }
        .cf-badge-text {
          letter-spacing: 0 !important;
        }
        .cf-badge-tag {
          color: #bedc74 !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          background: rgba(190, 220, 116, 0.15) !important;
          padding: 1px 6px !important;
          border-radius: 9999px !important;
        }
        .cf-panel {
          opacity: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          width: 320px !important;
          background: #171a13 !important;
          border: 1px solid transparent !important;
          border-radius: 12px !important;
          padding: 0 12px !important;
          margin-bottom: 0 !important;
          box-shadow: none !important;
          filter: none !important;
          backdrop-filter: none !important;
          pointer-events: none !important;
          transition: opacity 0.22s ease, max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.22s ease, margin 0.22s ease, border-color 0.22s ease !important;
        }
        .cf-panel.open {
          opacity: 1 !important;
          max-height: 280px !important;
          padding: 12px !important;
          margin-bottom: 8px !important;
          border-color: #bedc74 !important;
          pointer-events: auto !important;
        }
        .cf-panel-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin-bottom: 8px !important;
          padding-bottom: 6px !important;
          border-bottom: 1px solid rgba(190, 220, 116, 0.18) !important;
        }
        .cf-panel-title {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          color: #bedc74 !important;
        }
        .cf-panel-actions {
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
        }
        .cf-header-btn {
          background: transparent !important;
          border: none !important;
          color: #9aa491 !important;
          font-size: 13px !important;
          cursor: pointer !important;
          padding: 2px 5px !important;
          border-radius: 4px !important;
          line-height: 1 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .cf-header-btn:hover {
          color: #edf0e8 !important;
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .cf-log-box {
          background: #10130d !important;
          border: 1px solid rgba(190, 220, 116, 0.15) !important;
          border-radius: 8px !important;
          padding: 8px 10px !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 10.5px !important;
          line-height: 1.5 !important;
          color: #9aa491 !important;
          max-height: 160px !important;
          overflow-y: auto !important;
        }
        .cf-log-row {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .cf-log-prompt {
          color: #bedc74 !important;
          margin-right: 5px !important;
        }
        .cf-panel-footer {
          margin-top: 8px !important;
          font-size: 10px !important;
          color: #9aa491 !important;
          text-align: right !important;
          opacity: 0.8 !important;
        }
      `;

      root.appendChild(style);

      const panel = document.createElement('div');
      panel.className = 'cf-panel';
      panel.innerHTML = `
        <div class="cf-panel-header">
          <div class="cf-panel-title">
            <span class="cf-dot"></span>
            <span>TikTok Studio Cloud Disabler</span>
          </div>
          <div class="cf-panel-actions">
            <button type="button" class="cf-header-btn" id="cf-btn-copy-log" title="Copy All Logs">📋</button>
            <button type="button" class="cf-header-btn" id="cf-btn-refresh" title="Hard Reload Page">↻</button>
            <button type="button" class="cf-header-btn" id="cf-btn-close" title="Close Panel">✕</button>
          </div>
        </div>
        <div class="cf-log-box" id="cf-log-box"></div>
        <div class="cf-panel-footer">cutefishaep</div>
      `;

      const badge = document.createElement('div');
      badge.className = 'cf-badge';
      badge.innerHTML = `
        <span class="cf-dot"></span>
        <span class="cf-badge-text">TikTok Studio</span>
        <span class="cf-badge-tag">Active</span>
      `;

      root.appendChild(panel);
      root.appendChild(badge);

      const logBox = panel.querySelector('#cf-log-box');
      const closeBtn = panel.querySelector('#cf-btn-close');
      const refreshBtn = panel.querySelector('#cf-btn-refresh');
      const copyLogBtn = panel.querySelector('#cf-btn-copy-log');

      function renderLogs() {
        if (!logBox) return;
        logBox.innerHTML = '';
        logEntries.forEach(entry => {
          const row = document.createElement('div');
          row.className = 'cf-log-row';
          row.innerHTML = `<span class="cf-log-prompt">&gt;</span>${entry}`;
          logBox.appendChild(row);
        });
        logBox.scrollTop = logBox.scrollHeight;
      }

      addUiLog = (msg) => {
        logEntries.push(msg);
        renderLogs();
      };

      renderLogs();

      badge.addEventListener('click', () => {
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
          renderLogs();
        }
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('open');
      });

      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          location.reload(true);
        });
      }

      function fallbackCopyText(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          const timeStr = new Date().toLocaleTimeString([], { hour12: false });
          addUiLog(`[${timeStr}] All logs copied to clipboard`);
        } catch (_) {}
        ta.remove();
      }

      if (copyLogBtn) {
        copyLogBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const textToCopy = logEntries.join('\n');
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).then(() => {
              const timeStr = new Date().toLocaleTimeString([], { hour12: false });
              addUiLog(`[${timeStr}] All logs copied to clipboard`);
            }).catch(() => {
              fallbackCopyText(textToCopy);
            });
          } else {
            fallbackCopyText(textToCopy);
          }
        });
      }

      targetParent.appendChild(root);
    } else if (!targetParent.contains(root)) {
      targetParent.appendChild(root);
    }
  }

  // Poll aggressively at startup to attach as soon as DOM / body is available
  const timer = setInterval(() => {
    initIndicator();
    if (document.getElementById('cf-tktk-disabler-root')) {
      clearInterval(timer);
    }
  }, 300);

  // Keep checking for route / DOM updates
  setInterval(initIndicator, 1500);
})();
