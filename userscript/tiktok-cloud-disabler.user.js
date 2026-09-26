// ==UserScript==
// @name         TikTok Cloud Edit Disabler
// @namespace    https://cutefish.my.id/
// @version      1.5.3
// @description  Menonaktifkan Cloud Canvas Video Editor di TikTok Studio (tiktok.com/tiktokstudio) agar kualitas video 1080p dan 120 FPS tidak di-downscale paksa ke 720p.
// @author       cutefishaep
// @match        https://*.tiktok.com/*
// @match        *://localhost/*
// @match        *://127.0.0.1/*
// @match        *://cutefish.my.id/*
// @match        *://*.cutefish.my.id/*
// @updateURL    https://cutefish.my.id/userscript/tiktok-cloud-disabler.user.js
// @downloadURL  https://cutefish.my.id/userscript/tiktok-cloud-disabler.user.js
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

/* jshint esversion: 11 */

(() => {
  'use strict';

  const win = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

  if (win.__TIKTOK_CLOUD_DISABLER_HOOK__) return;
  win.__TIKTOK_CLOUD_DISABLER_HOOK__ = true;
  win.__TIKTOK_CLOUD_DISABLER__ = true;
  win.__TIKTOK_CLOUD_DISABLER_VERSION__ = '1.5.3';

  try {
    document.documentElement.dataset.tiktokCloudDisabler = 'active';
    document.documentElement.dataset.tiktokCloudDisablerVersion = '1.5.3';
  } catch (_) {}

  // Respond to ping from web app
  win.addEventListener('message', (event) => {
    if (event.data?.type === 'TIKTOK_CLOUD_DISABLER_PING' || event.data?.type === 'ADJN_PING') {
      win.postMessage({ type: 'TIKTOK_CLOUD_DISABLER_PONG', version: '1.5.3', source: 'TIKTOK_CLOUD_DISABLER' }, '*');
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
    'System: TikTok Studio Cloud Disabler v1.5.3',
    `Host: ${location.hostname}`,
    `UserAgent: ${navigator.userAgent.substring(0, 48)}...`,
    'Fetch / XHR Hook: Cloud Canvas payload interceptor active',
    'Metadata Verifier: cutefish.my.id detector ready',
    'TikTok Studio Hook: Active'
  ];

  let addUiLog = (msg) => {
    logEntries.push(msg);
  };

  // ================= PAYLOAD NORMALIZATION & HOOKS =================
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

  // ================= CUTEFISH.MY.ID METADATA DETECTOR =================
  async function isFilePatchedByCutefish(file) {
    if (!file) return false;
    try {
      const targetStr = 'cutefish.my.id';
      const targetBytes = new Uint8Array(targetStr.length);
      for (let i = 0; i < targetStr.length; i++) targetBytes[i] = targetStr.charCodeAt(i);

      // Fast check: inspect first 8MB and last 8MB (where moov/udta box is located)
      const slices = [];
      if (file.size <= 16 * 1024 * 1024) {
        slices.push(await file.arrayBuffer());
      } else {
        slices.push(await file.slice(0, 8 * 1024 * 1024).arrayBuffer());
        slices.push(await file.slice(file.size - 8 * 1024 * 1024, file.size).arrayBuffer());
      }

      for (const buf of slices) {
        const bytes = new Uint8Array(buf);
        const max = bytes.length - targetBytes.length;
        for (let i = 0; i <= max; i++) {
          if (bytes[i] === targetBytes[0]) {
            let match = true;
            for (let j = 1; j < targetBytes.length; j++) {
              if (bytes[i + j] !== targetBytes[j]) {
                match = false;
                break;
              }
            }
            if (match) return true;
          }
        }
      }
    } catch (e) {
      console.warn('[TikTok Cloud Disabler] Error checking file metadata:', e);
    }
    return false;
  }

  let isUploadLocked = false;

  function lockUploadContainer() {
    isUploadLocked = true;
    const container = findUploadContainer();
    if (container) {
      container.style.pointerEvents = 'none';
      container.style.opacity = '0.6';
    }
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(inp => {
      inp.disabled = true;
      inp.style.pointerEvents = 'none';
    });
  }

  function unlockUploadContainer() {
    isUploadLocked = false;
    const container = findUploadContainer();
    if (container) {
      container.style.pointerEvents = '';
      container.style.opacity = '';
    }
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(inp => {
      inp.disabled = false;
      inp.style.pointerEvents = '';
    });
  }

  function forwardFileToUpload(file) {
    if (isUploadLocked) return;

    const input = document.querySelector('input[type="file"]');
    if (input) {
      input.disabled = false;
      input.style.pointerEvents = '';

      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;

      const changeEvt = new Event('change', { bubbles: true });
      changeEvt._cfVerified = true;
      input.dispatchEvent(changeEvt);

      // Lock drag & drop container immediately to prevent double upload trigger
      lockUploadContainer();
      const timeStr = new Date().toLocaleTimeString([], { hour12: false });
      addUiLog(`[${timeStr}] Upload dikirim ke TikTok Studio (Drag & drop dikunci)`);

      // Auto-unlock after navigation or timeout
      setTimeout(() => {
        if (document.querySelector('.upload-card, [class*="upload-card"], [class*="drop-zone"]')) {
          unlockUploadContainer();
        }
      }, 10000);
    }
  }

  function findUploadContainer() {
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      let cur = fileInput.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const cl = String(cur.className || '');
        const rect = cur.getBoundingClientRect();
        if (
          cl.includes('upload-card') ||
          cl.includes('before-upload') ||
          cl.includes('upload-stage') ||
          cl.includes('uploader-container') ||
          cl.includes('drop-zone') ||
          cl.includes('file-uploader') ||
          cl.includes('upload-container') ||
          (rect.height >= 240 && rect.width >= 350 && !cl.includes('sidebar') && !cl.includes('header') && !cl.includes('nav'))
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
    }
    return document.querySelector('.upload-card, .before-upload-new-stage, [class*="upload-card"], [class*="before-upload-new-stage"], [class*="upload-stage"], [class*="uploader-container"], [class*="drop-zone"], [class*="file-uploader"]');
  }

  // ================= CLEAN NON-HYPERBOLIC CONFIRMATION MODAL =================
  function showUnpatchedModal(file, onContinue) {
    const existing = document.getElementById('cf-unpatched-modal-root');
    if (existing) existing.remove();

    const container = findUploadContainer();
    const targetParent = container || document.body;
    const isInsideContainer = !!container;

    if (isInsideContainer) {
      container.style.position = 'relative';
    }

    const root = document.createElement('div');
    root.id = 'cf-unpatched-modal-root';
    if (isInsideContainer) {
      root.classList.add('cf-in-container');
    }

    const safeName = file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    root.innerHTML = `
      <style>
        #cf-unpatched-modal-root {
          position: fixed !important;
          inset: 0 !important;
          z-index: 2147483646 !important;
          background: rgba(10, 12, 8, 0.78) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 16px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          color: #edf0e8 !important;
          box-sizing: border-box !important;
        }
        #cf-unpatched-modal-root.cf-in-container {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 280px !important;
          border-radius: inherit !important;
          background: rgba(23, 26, 19, 0.95) !important;
          backdrop-filter: blur(4px) !important;
          z-index: 99999 !important;
        }
        #cf-unpatched-modal-root * {
          box-sizing: border-box !important;
        }
        .cf-modal-box {
          background: #171a13 !important;
          border: 1.5px solid #bedc74 !important;
          border-radius: 16px !important;
          max-width: 440px !important;
          width: 100% !important;
          padding: 24px !important;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5) !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 16px !important;
          text-align: left !important;
        }
        .cf-modal-header {
          display: flex !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 12px !important;
        }
        .cf-modal-title {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: #edf0e8 !important;
          line-height: 1.35 !important;
          margin: 0 !important;
        }
        .cf-modal-close {
          background: transparent !important;
          border: none !important;
          color: #9aa491 !important;
          font-size: 18px !important;
          line-height: 1 !important;
          cursor: pointer !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
        }
        .cf-modal-close:hover {
          color: #edf0e8 !important;
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .cf-modal-desc {
          font-size: 12.5px !important;
          color: #b5c0ad !important;
          line-height: 1.5 !important;
          margin: 0 !important;
        }
        .cf-file-badge {
          display: inline-block !important;
          background: #20241a !important;
          border: 1px solid rgba(190, 220, 116, 0.25) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          font-size: 11px !important;
          font-family: ui-monospace, monospace !important;
          color: #bedc74 !important;
          word-break: break-all !important;
          margin-top: 6px !important;
        }
        .cf-modal-actions {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          margin-top: 4px !important;
        }
        .cf-btn-patch {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          padding: 11px 0 !important;
          background: transparent !important;
          color: #bedc74 !important;
          border: 1.5px solid #bedc74 !important;
          border-radius: 9999px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          text-decoration: none !important;
          transition: background 0.15s ease, color 0.15s ease !important;
        }
        .cf-btn-patch:hover {
          background: rgba(190, 220, 116, 0.12) !important;
        }
        .cf-btn-continue {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          padding: 11px 0 !important;
          background: #bedc74 !important;
          color: #171a13 !important;
          border: none !important;
          border-radius: 9999px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: background 0.15s ease !important;
        }
        .cf-btn-continue:hover {
          background: #d4f090 !important;
        }
      </style>
      <div class="cf-modal-box">
        <div class="cf-modal-header">
          <h3 class="cf-modal-title">Video is not patched, continue uploading ?</h3>
          <button type="button" class="cf-modal-close" id="cf-btn-modal-dismiss" title="Tutup">&times;</button>
        </div>
        <div class="cf-modal-desc">
          File ini belum dipatch dengan metadata <strong>cutefish.my.id</strong>. Tanpa patch, TikTok Studio mungkin menurunkan kualitas video ke 720p.
          <div><span class="cf-file-badge">${safeName} (${fileSizeMB} MB)</span></div>
        </div>
        <div class="cf-modal-actions">
          <a href="https://cutefish.my.id/#tiktok-quality-tool" target="_blank" rel="noopener noreferrer" class="cf-btn-patch" id="cf-btn-go-patch">
            Patch on cutefish.my.id
          </a>
          <button type="button" class="cf-btn-continue" id="cf-btn-confirm-continue">
            Continue uploading
          </button>
        </div>
      </div>
    `;

    targetParent.appendChild(root);

    const closeModal = () => {
      if (root.parentNode) root.remove();
      unlockUploadContainer();
    };

    const dismissBtn = root.querySelector('#cf-btn-modal-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
      });
    }

    const continueBtn = root.querySelector('#cf-btn-confirm-continue');
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
        if (typeof onContinue === 'function') onContinue();
      });
    }

    const patchBtn = root.querySelector('#cf-btn-go-patch');
    if (patchBtn) {
      patchBtn.addEventListener('click', () => {
        // Keep modal or allow continue later
      });
    }
  }

  // ================= UPLOAD EVENT INTERCEPTOR =================
  function setupUploadInterceptor() {
    if (!isTikTokStudio) return;

    let isChecking = false;

    // Prevent dragover while locked / checking
    document.addEventListener('dragover', (e) => {
      if (isUploadLocked || isChecking || document.getElementById('cf-unpatched-modal-root')) {
        e.preventDefault();
      }
    }, true);

    // 1. Intercept file input change
    document.addEventListener('change', async (e) => {
      if (e._cfVerified) return;
      if (isUploadLocked || isChecking || document.getElementById('cf-unpatched-modal-root')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      const target = e.target;
      if (target && target.tagName === 'INPUT' && target.type === 'file' && target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file.type.startsWith('video/') || /\.(mp4|mov|webm|wmv)$/i.test(file.name)) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          isChecking = true;
          const timeStr = new Date().toLocaleTimeString([], { hour12: false });
          addUiLog(`[${timeStr}] Memeriksa metadata patch: ${file.name}`);

          try {
            const isPatched = await isFilePatchedByCutefish(file);
            if (isPatched) {
              addUiLog(`[${timeStr}] Video terverifikasi: Patched via cutefish.my.id`);
              forwardFileToUpload(file);
            } else {
              addUiLog(`[${timeStr}] Video belum di-patch: ${file.name}`);
              showUnpatchedModal(file, () => {
                addUiLog(`[${new Date().toLocaleTimeString([], { hour12: false })}] Upload dilanjutkan tanpa patch`);
                forwardFileToUpload(file);
              });
            }
          } catch (err) {
            console.error(err);
            forwardFileToUpload(file);
          } finally {
            isChecking = false;
          }
        }
      }
    }, true);

    // 2. Intercept drop event
    document.addEventListener('drop', async (e) => {
      if (e._cfVerified) return;
      if (isUploadLocked || isChecking || document.getElementById('cf-unpatched-modal-root')) {
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

          isChecking = true;
          const timeStr = new Date().toLocaleTimeString([], { hour12: false });
          addUiLog(`[${timeStr}] Memeriksa metadata patch: ${file.name}`);

          try {
            const isPatched = await isFilePatchedByCutefish(file);
            if (isPatched) {
              addUiLog(`[${timeStr}] Video terverifikasi: Patched via cutefish.my.id`);
              forwardFileToUpload(file);
            } else {
              addUiLog(`[${timeStr}] Video belum di-patch: ${file.name}`);
              showUnpatchedModal(file, () => {
                addUiLog(`[${new Date().toLocaleTimeString([], { hour12: false })}] Upload dilanjutkan tanpa patch`);
                forwardFileToUpload(file);
              });
            }
          } catch (err) {
            console.error(err);
            forwardFileToUpload(file);
          } finally {
            isChecking = false;
          }
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
      setupUploadInterceptor();

      root = document.createElement('div');
      root.id = 'cf-tktk-disabler-root';

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
        }
        .cf-badge:hover {
          background: #20241a !important;
        }
        .cf-dot {
          width: 6px !important;
          height: 6px !important;
          border-radius: 50% !important;
          background: #bedc74 !important;
          flex-shrink: 0 !important;
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
