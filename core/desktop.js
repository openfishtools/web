(function () {
  "use strict";

  // Smooth same-origin page exit transitions
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || a.target === "_blank") return;

    var url;
    try {
      url = new URL(a.href, location.href);
    } catch (err) {
      return;
    }
    if (url.origin === location.origin && (url.pathname.endsWith(".html") || url.pathname === "/")) {
      e.preventDefault();
      document.body.classList.add("page-is-exiting");
      window.setTimeout(function () {
        location.href = a.href;
      }, 220);
    }
  });

  window.addEventListener("pageshow", function () {
    document.body.classList.remove("page-is-exiting");
  });

  var hasAnimatedDesktopEntrance = false;

  function playDesktopUnlockEntrance() {
    if (hasAnimatedDesktopEntrance) return;
    hasAnimatedDesktopEntrance = true;

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    var clockEl = document.querySelector(".clock-widget");
    if (clockEl && typeof clockEl.animate === "function") {
      clockEl.animate([
        { opacity: 0, transform: "scale(1.16) translateY(-14px)" },
        { opacity: 1, transform: "scale(0.975) translateY(2px)", offset: 0.68 },
        { opacity: 1, transform: "scale(1) translateY(0px)" }
      ], {
        duration: 620,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards"
      });
    }

    var folders = document.querySelectorAll("#desktop-shortcuts .big-folder");
    folders.forEach(function (folderEl, idx) {
      if (typeof folderEl.animate !== "function") return;
      folderEl.animate([
        { opacity: 0, transform: "scale(1.34) translateY(20px)" },
        { opacity: 0.92, transform: "scale(0.965) translateY(-2px)", offset: 0.68 },
        { opacity: 1, transform: "scale(1) translateY(0px)" }
      ], {
        duration: 680,
        delay: 75 + idx * 70,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards"
      });
    });
  }

  function renderDesktopShortcuts() {
    var grid = document.getElementById("desktop-shortcuts");
    if (!grid || !window.AppRegistry) return;

    var allApps = window.AppRegistry.getAll();
    var byId = {};
    allApps.forEach(function (app) { byId[app.id] = app; });
    var getSvg = window.AppRegistry.getIconHtml;

    var FOLDERS = typeof window.AppRegistry.getFolders === "function"
      ? window.AppRegistry.getFolders()
      : [];

    grid.innerHTML = "";

    // Big-folder-sized "Preset" icon placed first
    var presetApp = byId["preset"] || {
      id: "preset",
      title: "Preset",
      icon: "preset.svg",
      entry: "apps/preset/index.html"
    };

    var presetWrap = document.createElement("div");
    presetWrap.className = "big-folder";

    var presetBtn = document.createElement("button");
    presetBtn.type = "button";
    presetBtn.className = "big-folder-card big-folder-tile";
    presetBtn.dataset.shortcutId = presetApp.id;
    presetBtn.setAttribute("aria-label", presetApp.title);
    presetBtn.title = presetApp.title;
    presetBtn.innerHTML = getSvg(presetApp.icon);

    var openPreset = function () {
      if (window.AppWindow) {
        window.AppWindow.open(presetApp, presetBtn);
      }
    };
    presetBtn.addEventListener("click", openPreset);

    var presetTitle = document.createElement("span");
    presetTitle.className = "big-folder-title";
    presetTitle.textContent = presetApp.title;
    presetTitle.addEventListener("click", openPreset);

    presetWrap.appendChild(presetBtn);
    presetWrap.appendChild(presetTitle);
    grid.appendChild(presetWrap);

    FOLDERS.forEach(function (folder) {
      var apps = folder.ids.map(function (id) { return byId[id]; }).filter(Boolean);
      if (apps.length === 0) return;

      var wrap = document.createElement("div");
      wrap.className = "big-folder";

      var card = document.createElement("div");
      card.className = "big-folder-card";
      card.dataset.shortcutId = folder.id || folder.title;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "Folder " + folder.title);

      var folderGrid = document.createElement("div");
      folderGrid.className = "big-folder-grid";

      apps.slice(0, 4).forEach(function (app) {
        var tile = document.createElement("div");
        tile.className = "big-folder-app";
        tile.dataset.appId = app.id;
        tile.setAttribute("aria-hidden", "true");

        var iconWrap = document.createElement("span");
        iconWrap.className = "big-folder-app-icon";
        iconWrap.innerHTML = getSvg(app.icon);

        var labelEl = document.createElement("span");
        labelEl.className = "big-folder-app-label";
        labelEl.textContent = app.title;

        tile.appendChild(iconWrap);
        tile.appendChild(labelEl);

        folderGrid.appendChild(tile);
      });

      card.appendChild(folderGrid);

      var openThisFolder = function () {
        if (window.FolderModal && typeof window.FolderModal.open === "function") {
          window.FolderModal.open(folder.title, apps, card);
        }
      };

      card.addEventListener("click", openThisFolder);
      card.addEventListener("keydown", function (e) {
        if (e.target === card && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          openThisFolder();
        }
      });

      var titleEl = document.createElement("span");
      titleEl.className = "big-folder-title";
      titleEl.textContent = folder.title;
      titleEl.addEventListener("click", openThisFolder);

      wrap.appendChild(card);
      wrap.appendChild(titleEl);
      grid.appendChild(wrap);
    });

    playDesktopUnlockEntrance();
  }

  function initIndonesiaClock() {
    var timeEl = document.getElementById("clock-time");
    var dateEl = document.getElementById("clock-date");
    if (!timeEl || !dateEl) return;

    var ZONES = [
      { label: "WIB", tz: "Asia/Jakarta" },
      { label: "WITA", tz: "Asia/Makassar" },
      { label: "WIT", tz: "Asia/Jayapura" }
    ];

    var localTz = "";
    try {
      localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (_) {}

    var zoneIndex = 0;
    if (localTz === "Asia/Makassar" || localTz === "Asia/Ujung_Pandang") zoneIndex = 1;
    else if (localTz === "Asia/Jayapura") zoneIndex = 2;

    try {
      var savedIdx = parseInt(localStorage.getItem("cutefish_id_tz_idx"), 10);
      if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < ZONES.length) {
        zoneIndex = savedIdx;
      }
    } catch (_) {}

    function updateClock() {
      var z = ZONES[zoneIndex];
      var now = new Date();
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: z.tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(now);

      var hh = "00", mm = "00";
      parts.forEach(function (p) {
        if (p.type === "hour") hh = p.value;
        else if (p.type === "minute") mm = p.value;
      });

      timeEl.textContent = hh + ":" + mm;

      var dateLocale = (window.CutefishI18n && typeof window.CutefishI18n.locale === "function")
        ? window.CutefishI18n.locale()
        : "id-ID";
      var dateStr = new Intl.DateTimeFormat(dateLocale, {
        timeZone: z.tz,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(now);

      dateEl.textContent = dateStr + " \u2022 " + z.label;
    }

    dateEl.addEventListener("click", function () {
      zoneIndex = (zoneIndex + 1) % ZONES.length;
      try { localStorage.setItem("cutefish_id_tz_idx", String(zoneIndex)); } catch (_) {}
      updateClock();
    });

    updateClock();
    setInterval(updateClock, 1000);
  }

  var desktopHomeEl = document.getElementById("desktop-home");
  var clockWidgetEl = document.getElementById("clock-widget");
  var desktopShortcutsEl = document.getElementById("desktop-shortcuts");

  function setClockCentered(centered) {
    if (!clockWidgetEl) return;
    if (!centered) {
      clockWidgetEl.style.transform = "";
      return;
    }
    var dockEl = document.getElementById("dock");
    var dockTop = dockEl ? dockEl.getBoundingClientRect().top : (window.innerHeight - 96);
    var homeTop = desktopHomeEl ? desktopHomeEl.getBoundingClientRect().top : 0;
    var naturalCenterY = homeTop + clockWidgetEl.offsetTop + clockWidgetEl.offsetHeight / 2;
    var targetCenterY = Math.max(clockWidgetEl.offsetHeight / 2, dockTop / 2);
    var dy = Math.max(0, targetCenterY - naturalCenterY);
    clockWidgetEl.style.transform = "translate3d(0, " + dy.toFixed(1) + "px, 0)";
  }

  function setShortcutsDocked(docked) {
    if (!desktopShortcutsEl) return;
    desktopShortcutsEl.classList.toggle("is-docked", Boolean(docked));
  }

  function collectShortcutCards() {
    var map = {};
    if (!desktopShortcutsEl) return map;
    desktopShortcutsEl.querySelectorAll(".big-folder-card[data-shortcut-id]").forEach(function (card) {
      var id = card.dataset.shortcutId;
      var rect = card.getBoundingClientRect();
      if (id && rect.width > 0 && rect.height > 0) {
        map[id] = { el: card, rect: rect };
      }
    });
    return map;
  }

  function getDeepLinkPresetId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var qp = (params.get("preset") || "").trim();
      if (/^\d+$/.test(qp)) return qp;
    } catch (_) {}

    var pathMatch = (window.location.pathname || "").match(/^\/(\d+)\/?$/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    return "";
  }

  function getDeepLinkAppId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var appId = (params.get("app") || "").trim();
      if (/^[a-z0-9-]+$/i.test(appId)) return appId;
    } catch (_) {}
    return "";
  }

  function hasDeepLink() {
    return Boolean(getDeepLinkPresetId() || getDeepLinkAppId());
  }

  function launchDeepLinkIfNeeded() {
    var presetId = getDeepLinkPresetId();
    var appId = presetId ? "" : getDeepLinkAppId();
    if (!presetId && !appId) return;

    var openTargetApp = function () {
      var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var waitMs = reducedMotion ? 120 : 760;

      window.setTimeout(function () {
        if (!window.AppWindow || typeof window.AppWindow.open !== "function") return;

        if (presetId) {
          var baseApp = (window.AppRegistry && typeof window.AppRegistry.getById === "function" && window.AppRegistry.getById("preset")) || {
            id: "preset",
            title: "Preset",
            icon: "preset.svg",
            entry: "apps/preset/index.html"
          };

          var entry = baseApp.entry || "apps/preset/index.html";
          var sep = entry.indexOf("?") === -1 ? "?" : "&";
          var deepLinkApp = {
            id: baseApp.id,
            title: baseApp.title,
            icon: baseApp.icon,
            entry: entry + sep + "preset=" + encodeURIComponent(presetId),
            description: baseApp.description
          };

          var presetBtn = document.querySelector('#desktop-shortcuts [data-shortcut-id="preset"]');
          window.AppWindow.open(deepLinkApp, presetBtn);
          return;
        }

        if (appId && window.AppRegistry && typeof window.AppRegistry.getById === "function") {
          var targetApp = window.AppRegistry.getById(appId);
          if (!targetApp) return;
          var triggerEl = document.querySelector('#desktop-shortcuts [data-shortcut-id="' + appId + '"]')
            || document.querySelector('#dock [data-app-id="' + appId + '"]');
          window.AppWindow.open(targetApp, triggerEl);
        }
      }, waitMs);
    };

    if (document.readyState === "complete") {
      openTargetApp();
    } else {
      window.addEventListener("load", openTargetApp, { once: true });
    }
  }

  window.DesktopShell = {
    setClockCentered: setClockCentered,
    setShortcutsDocked: setShortcutsDocked,
    collectShortcutCards: collectShortcutCards,
    getDeepLinkPresetId: getDeepLinkPresetId,
    getDeepLinkAppId: getDeepLinkAppId,
    hasDeepLink: hasDeepLink
  };

  // Boot Desktop Shell
  initIndonesiaClock();
  if (window.DesktopDock && typeof window.DesktopDock.init === "function") {
    window.DesktopDock.init();
  }
  renderDesktopShortcuts();
  launchDeepLinkIfNeeded();
})();
