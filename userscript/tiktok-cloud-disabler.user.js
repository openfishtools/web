// ==UserScript==
// @name         TikTok Cloud Edit Disabler
// @namespace    https://cutefish.my.id/
// @version      1.1.1
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

  try {
    document.documentElement.dataset.tiktokCloudDisabler = 'active';
  } catch (_) {}

  // Respond to ping from web app
  win.addEventListener('message', (event) => {
    if (event.data?.type === 'TIKTOK_CLOUD_DISABLER_PING' || event.data?.type === 'ADJN_PING') {
      win.postMessage({ type: 'TIKTOK_CLOUD_DISABLER_PONG', source: 'TIKTOK_CLOUD_DISABLER' }, '*');
    }
  });

  const isTikTokSite = /tiktok\.com$/i.test(location.hostname) || location.hostname.includes('tiktok.com');
  const isTikTokStudio = isTikTokSite && (
    location.pathname.includes('/tiktokstudio') ||
    location.pathname.includes('/upload') ||
    location.pathname.includes('/creator-center')
  );

  // Logs queue for the UI widget
  const logEntries = [
    'Cloud Canvas bypass active',
    'TikTok Studio hook ready'
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
    addUiLog(`[${timeStr}] Cloud Canvas disabled ✓`);
    addUiLog(`[${timeStr}] 1080p/120fps preserved`);
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
          width: 280px !important;
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
          max-height: 240px !important;
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
          max-height: 120px !important;
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
