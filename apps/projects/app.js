(function () {
  "use strict";

  var API_BASE = "/api/github-repo";
  var DEFAULT_ICON = "https://raw.githubusercontent.com/openfishtools/.github/main/profile/assets/projects/openfishtools.svg";
  var LS_PREFIX = "ofts_store_cache_v2_";

  function readLocalCache(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      return parsed.data;
    } catch (_e) {
      return null;
    }
  }

  function writeLocalCache(key, data) {
    try {
      localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_e) {}
  }

  var ACTION_META = {
    visit: { label: { id: "Visit", en: "Visit" } },
    download: { label: { id: "Download", en: "Download" } },
    install: { label: { id: "Install", en: "Install" } }
  };

  var OS_EXTENSIONS = {
    android: [".apk"],
    windows: [".exe"],
    macos: [".dmg", ".pkg"]
  };

  var UI_TEXT = {
    id: {
      searchPlaceholder: "Cari aplikasi...",
      loading: "Memuat...",
      errorLoad: "Gagal memuat daftar aplikasi dari GitHub.",
      noResults: "Tidak ada aplikasi ditemukan.",
      appsSection: "Aplikasi",
      back: "Kembali",
      platform: "Platform",
      about: "Tentang",
      noDesc: "Repositori open source dari OpenFishTools.",
      whatsNew: "Versi & Changelog",
      noRelease: "Belum ada rilis di GitHub.",
      noChangelog: "Tidak ada catatan perubahan.",
      moreAppsFromDev: "Lainnya dari Developer",
      developer: "Developer",
      visit: "Visit",
      webApp: "Web App",
      showMore: "Lihat selengkapnya",
      showLess: "Tampilkan lebih sedikit",
      chooseFile: "Pilih File Unduhan",
      chooseFileSub: "Tersedia beberapa file untuk"
    },
    en: {
      searchPlaceholder: "Search apps...",
      loading: "Loading...",
      errorLoad: "Failed to load apps from GitHub.",
      noResults: "No apps found.",
      appsSection: "Apps",
      back: "Back",
      platform: "Platform",
      about: "About",
      noDesc: "Open-source repository by OpenFishTools.",
      whatsNew: "Version & Changelog",
      noRelease: "No releases published yet.",
      noChangelog: "No changelog provided.",
      moreAppsFromDev: "More Apps From Developer",
      developer: "Developer",
      visit: "Visit",
      webApp: "Web App",
      showMore: "Show more",
      showLess: "Show less",
      chooseFile: "Choose File to Download",
      chooseFileSub: "Multiple files available for"
    }
  };

  var state = {
    developer: null,
    apps: [],
    loadingList: false,
    query: "",
    activeAppId: null,
    selectedPlatformId: null,
    readmeExpanded: false,
    repoCache: {},
    repoLoading: {}
  };

  var els = {
    homeView: document.getElementById("store-home"),
    detailView: document.getElementById("store-detail"),
    searchInput: document.getElementById("store-search"),
    loading: document.getElementById("store-loading"),
    loadingText: document.getElementById("store-loading-text"),
    error: document.getElementById("store-error"),
    errorText: document.getElementById("store-error-text"),
    banner: document.getElementById("store-banner"),
    listTitle: document.getElementById("store-list-title"),
    list: document.getElementById("store-list"),
    empty: document.getElementById("store-empty"),
    detailBackBtn: document.getElementById("detail-back-btn"),
    detailBackLabel: document.getElementById("detail-back-label"),
    detailScroll: document.getElementById("detail-scroll"),
    detailContent: document.getElementById("detail-content"),
    assetBackdrop: document.getElementById("asset-backdrop"),
    assetTitle: document.getElementById("asset-sheet-title"),
    assetSub: document.getElementById("asset-sheet-sub"),
    assetList: document.getElementById("asset-list"),
    assetClose: document.getElementById("asset-close")
  };

  function getLang() {
    if (window.AppI18n && typeof window.AppI18n.getLang === "function") {
      return window.AppI18n.getLang() === "en" ? "en" : "id";
    }
    var params = new URLSearchParams(window.location.search);
    if (params.get("lang") === "en") return "en";
    if (params.get("lang") === "id") return "id";
    return (navigator.language || "id").toLowerCase().indexOf("id") === 0 ? "id" : "en";
  }

  function t(key) {
    var lang = getLang();
    return (UI_TEXT[lang] && UI_TEXT[lang][key]) || UI_TEXT.id[key] || key;
  }

  function pickLocale(val) {
    if (!val) return "";
    if (typeof val === "string") return val;
    var lang = getLang();
    return val[lang] || val.id || val.en || "";
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBytes(bytes) {
    var n = Number(bytes || 0);
    if (!n || n <= 0) return "";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString(getLang() === "id" ? "id-ID" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (_e) {
      return "";
    }
  }

  function getIconForApp(app) {
    if (app && app.iconUrl) {
      return app.iconUrl;
    }
    return DEFAULT_ICON;
  }

  function detectUserOs() {
    var ua = (navigator.userAgent || "").toLowerCase();
    if (ua.indexOf("android") !== -1) return "android";
    if (ua.indexOf("windows") !== -1) return "windows";
    if (ua.indexOf("mac os") !== -1 || ua.indexOf("macintosh") !== -1) return "macos";
    return "web";
  }

  function getEffectivePlatforms(app, repoData) {
    var list = [];
    if (!repoData) {
      var fallbackUrl = (app && (app.homepage || app.html_url)) || "#";
      return [{ id: "repo", label: "GitHub", action: "visit", url: fallbackUrl }];
    }

    if (repoData.homepage) {
      list.push({ id: "web", label: "Web", action: "visit", url: repoData.homepage });
    }

    var assets = (repoData.release && Array.isArray(repoData.release.assets)) ? repoData.release.assets : [];
    var hasExe = false, hasDmg = false, hasApk = false;
    for (var i = 0; i < assets.length; i++) {
      var n = String(assets[i].name || "").toLowerCase();
      if (n.endsWith(".exe")) hasExe = true;
      else if (n.endsWith(".dmg") || n.endsWith(".pkg")) hasDmg = true;
      else if (n.endsWith(".apk")) hasApk = true;
    }

    if (hasExe) list.push({ id: "windows", label: "Windows", action: "download" });
    if (hasDmg) list.push({ id: "macos", label: "macOS", action: "install" });
    if (hasApk) list.push({ id: "android", label: "Android", action: "install" });

    if (!list.length) {
      list.push({ id: "repo", label: "GitHub", action: "visit", url: (app && app.html_url) || "#" });
    }

    return list;
  }

  function pickDefaultPlatform(platforms) {
    if (!Array.isArray(platforms) || !platforms.length) return null;
    var detected = detectUserOs();
    for (var i = 0; i < platforms.length; i++) {
      if (platforms[i].id === detected) return platforms[i];
    }
    return platforms[0];
  }

  function getActionInfo(actionType) {
    var key = ACTION_META[actionType] ? actionType : "visit";
    return {
      key: key,
      label: pickLocale(ACTION_META[key].label)
    };
  }

  function findAppById(id) {
    for (var i = 0; i < state.apps.length; i++) {
      if (state.apps[i].id === id) return state.apps[i];
    }
    return null;
  }

  function getMatchingAssets(repoData, platformId) {
    if (!repoData || !repoData.release || !Array.isArray(repoData.release.assets)) return [];
    var exts = OS_EXTENSIONS[platformId];
    if (!exts || !exts.length) return [];
    return repoData.release.assets.filter(function (asset) {
      var name = String(asset.name || "").toLowerCase();
      for (var i = 0; i < exts.length; i++) {
        if (name.endsWith(exts[i])) return true;
      }
      return false;
    });
  }

  function resolvePlatformTarget(app, plat, repoData) {
    if (!plat) {
      return { url: (app && app.html_url) || "#", assets: [] };
    }
    if (plat.id === "web" || plat.action === "visit") {
      var liveWebUrl = (repoData && repoData.homepage) || plat.url || (app && app.html_url) || "#";
      return { url: liveWebUrl, assets: [] };
    }
    var assets = getMatchingAssets(repoData, plat.id);
    if (assets.length === 1) {
      return { url: assets[0].url, assets: assets };
    }
    if (assets.length > 1) {
      return { url: "", assets: assets };
    }
    return { url: plat.url || (app && app.html_url) || "#", assets: [] };
  }

  function fetchRepoData(app) {
    var slug = app && app.repo;
    if (!slug) return;
    if (state.repoCache[slug] || state.repoLoading[slug]) return;

    state.repoLoading[slug] = true;
    fetch(API_BASE + "?v=7&repo=" + encodeURIComponent(slug), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        state.repoCache[slug] = json;
        if (!json.rateLimited) {
          writeLocalCache("repo_" + slug.toLowerCase(), json);
        }
      })
      .catch(function () {
        var stale = readLocalCache("repo_" + slug.toLowerCase());
        state.repoCache[slug] = stale || { repo: slug, homepage: app.homepage || "", release: null, error: true };
      })
      .finally(function () {
        delete state.repoLoading[slug];
        if (state.activeAppId === app.id) {
          renderDetail();
        }
      });
  }

  var assetCloseTimer = null;

  function openAssetSheet(app, plat, assets) {
    if (!els.assetBackdrop || !els.assetList) return;
    if (assetCloseTimer) {
      clearTimeout(assetCloseTimer);
      assetCloseTimer = null;
    }
    if (els.assetTitle) els.assetTitle.textContent = t("chooseFile");
    if (els.assetSub) els.assetSub.textContent = t("chooseFileSub") + " " + plat.label + " (" + app.name + ")";

    els.assetList.innerHTML = assets.map(function (asset) {
      var sizeStr = formatBytes(asset.size);
      return (
        '<a class="store-asset-item" href="' + escapeHtml(asset.url) + '" target="_blank" rel="noopener noreferrer" data-close-sheet="1">' +
        '  <div class="store-asset-meta">' +
        '    <span class="store-asset-name">' + escapeHtml(asset.name) + "</span>" +
        (sizeStr ? '<span class="store-asset-size">' + escapeHtml(sizeStr) + "</span>" : "") +
        "  </div>" +
        '  <span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">download</span>' +
        "</a>"
      );
    }).join("");

    els.assetBackdrop.classList.remove("is-closing");
    els.assetBackdrop.classList.remove("is-hidden");
  }

  function closeAssetSheet() {
    if (!els.assetBackdrop || els.assetBackdrop.classList.contains("is-hidden")) return;
    els.assetBackdrop.classList.add("is-closing");
    if (assetCloseTimer) clearTimeout(assetCloseTimer);
    assetCloseTimer = setTimeout(function () {
      els.assetBackdrop.classList.add("is-hidden");
      els.assetBackdrop.classList.remove("is-closing");
      assetCloseTimer = null;
    }, 210);
  }

  function formatInlineMarkdown(raw, repoUrl) {
    var escaped = escapeHtml(raw);
    // Autolinks like <https://...>
    escaped = escaped.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, function (_m, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + "</a>";
    });
    // Markdown links [label](href) including relative repo links
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, href) {
      if (href.charAt(0) === "#") return label;
      var target = href;
      if (!/^https?:\/\//i.test(href)) {
        if (repoUrl) {
          target = repoUrl.replace(/\/+$/, "") + "/blob/HEAD/" + href.replace(/^\.?\//, "");
        } else {
          return label;
        }
      }
      return '<a href="' + target + '" target="_blank" rel="noopener noreferrer">' + label + "</a>";
    });
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return escaped;
  }

  function isTableDivider(line) {
    return /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
  }

  function splitTableRow(line) {
    return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) {
      return c.trim();
    });
  }

  function renderMarkdownHtml(bodyText, opts) {
    opts = opts || {};
    var raw = String(bodyText || "").trim();
    if (!raw) {
      return '<p class="store-changelog-empty">' + escapeHtml(opts.emptyText || t("noChangelog")) + "</p>";
    }
    var lines = raw.split(/\r?\n/);
    var html = ['<div class="store-changelog-body">'];
    var listType = null; // "ul" | "ol"
    var inCode = false;
    var codeBuf = [];

    function closeList() {
      if (listType) {
        html.push(listType === "ol" ? "</ol>" : "</ul>");
        listType = null;
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      // Fenced code blocks ```
      if (/^```/.test(trimmed)) {
        if (!inCode) {
          closeList();
          inCode = true;
          codeBuf = [];
        } else {
          html.push('<pre class="store-md-pre"><code>' + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
          inCode = false;
          codeBuf = [];
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      if (opts.skipVersionHeading) {
        var plainH = trimmed.replace(/^#{1,4}\s+/, "");
        if (/^\[?v?\d+\.\d+(?:\.\d+)*(?:-[a-z0-9.]+)?\]?(?:\s*[-–—]\s*\d{4}-\d{2}-\d{2})?$/i.test(plainH)) {
          continue;
        }
      }

      if (!trimmed) {
        if (html.length === 1) continue;
        closeList();
        html.push('<div class="store-cl-gap"></div>');
        continue;
      }

      // Markdown tables
      if (trimmed.indexOf("|") !== -1 && i + 1 < lines.length && isTableDivider(lines[i + 1].trim())) {
        closeList();
        var headers = splitTableRow(trimmed);
        var tableHtml = ['<div class="store-md-table-wrap"><table class="store-md-table"><thead><tr>'];
        for (var h = 0; h < headers.length; h++) {
          tableHtml.push("<th>" + formatInlineMarkdown(headers[h], opts.repoUrl) + "</th>");
        }
        tableHtml.push("</tr></thead><tbody>");
        i += 2; // skip header & divider
        while (i < lines.length && lines[i].trim().indexOf("|") !== -1) {
          var cells = splitTableRow(lines[i].trim());
          tableHtml.push("<tr>");
          for (var c = 0; c < cells.length; c++) {
            tableHtml.push("<td>" + formatInlineMarkdown(cells[c], opts.repoUrl) + "</td>");
          }
          tableHtml.push("</tr>");
          i++;
        }
        i--; // compensate loop increment
        tableHtml.push("</tbody></table></div>");
        html.push(tableHtml.join(""));
        continue;
      }

      // Headings
      var hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        closeList();
        var level = hMatch[1].length;
        html.push('<div class="store-cl-heading is-h' + level + '">' + formatInlineMarkdown(hMatch[2], opts.repoUrl) + "</div>");
        continue;
      }

      // Blockquotes (group consecutive > lines into one clean blockquote)
      if (/^>\s*/.test(trimmed)) {
        closeList();
        var quoteParas = [[]];
        while (i < lines.length && /^>\s*/.test(lines[i].trim())) {
          var qLine = lines[i].trim().replace(/^>\s*/, "");
          if (!qLine) {
            if (quoteParas[quoteParas.length - 1].length) quoteParas.push([]);
          } else {
            quoteParas[quoteParas.length - 1].push(qLine);
          }
          i++;
        }
        i--;
        var quoteInner = quoteParas
          .filter(function (p) { return p.length > 0; })
          .map(function (p) { return "<p>" + formatInlineMarkdown(p.join(" "), opts.repoUrl) + "</p>"; })
          .join("");
        if (quoteInner) {
          html.push('<blockquote class="store-md-quote">' + quoteInner + "</blockquote>");
        }
        continue;
      }

      // Unordered list
      if (/^[-*+]\s+/.test(trimmed)) {
        if (listType !== "ul") {
          closeList();
          html.push('<ul class="store-cl-list">');
          listType = "ul";
        }
        html.push("<li>" + formatInlineMarkdown(trimmed.replace(/^[-*+]\s+/, ""), opts.repoUrl) + "</li>");
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        if (listType !== "ol") {
          closeList();
          html.push('<ol class="store-cl-list is-ordered">');
          listType = "ol";
        }
        html.push("<li>" + formatInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""), opts.repoUrl) + "</li>");
        continue;
      }

      closeList();
      html.push('<div class="store-cl-line">' + formatInlineMarkdown(trimmed, opts.repoUrl) + "</div>");
    }

    if (inCode && codeBuf.length) {
      html.push('<pre class="store-md-pre"><code>' + escapeHtml(codeBuf.join("\n")) + "</code></pre>");
    }
    closeList();
    html.push("</div>");
    return html.join("");
  }

  function renderStaticCopy() {
    if (els.searchInput) els.searchInput.placeholder = t("searchPlaceholder");
    if (els.loadingText) els.loadingText.textContent = t("loading");
    if (els.listTitle) els.listTitle.textContent = t("appsSection");
    if (els.empty) els.empty.textContent = t("noResults");
    if (els.detailBackLabel) els.detailBackLabel.textContent = t("back");
  }

  function renderHomeSkeleton() {
    if (els.banner) {
      els.banner.classList.remove("is-hidden");
      els.banner.innerHTML = '<div class="store-skel store-skel-banner"></div>';
    }
    if (els.list) {
      els.list.innerHTML =
        '<div class="store-skel store-skel-tile"></div>' +
        '<div class="store-skel store-skel-tile"></div>' +
        '<div class="store-skel store-skel-tile"></div>' +
        '<div class="store-skel store-skel-tile"></div>';
    }
  }

  function getBannerApps() {
    if (!state.apps.length) return [];
    var preferred = ["studio", "cep", "web"];
    var picked = [];
    var seen = {};
    for (var i = 0; i < preferred.length; i++) {
      var found = findAppById(preferred[i]);
      if (found) {
        picked.push(found);
        seen[found.id] = true;
      }
    }
    for (var j = 0; j < state.apps.length && picked.length < 3; j++) {
      if (!seen[state.apps[j].id]) {
        picked.push(state.apps[j]);
        seen[state.apps[j].id] = true;
      }
    }
    return picked;
  }

  function makeBannerDoodleSvg(variant) {
    if (variant === 1) {
      return (
        '<svg class="store-banner-doodle" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '  <path class="store-doodle-a" d="M0 180 V 60 C 120 10, 220 130, 340 180 Z" />' +
        '  <path class="store-doodle-b" d="M600 0 V 180 H 410 C 440 90, 520 50, 480 0 Z" />' +
        '  <circle class="store-doodle-dot" cx="290" cy="42" r="14" />' +
        "</svg>"
      );
    }
    if (variant === 2) {
      return (
        '<svg class="store-banner-doodle" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
        '  <path class="store-doodle-a" d="M0 0 H 190 C 230 70, 150 120, 210 180 H 0 Z" />' +
        '  <path class="store-doodle-b" d="M600 0 V 140 C 500 165, 430 90, 460 0 Z" />' +
        '  <circle class="store-doodle-dot" cx="350" cy="138" r="16" />' +
        "</svg>"
      );
    }
    return (
      '<svg class="store-banner-doodle" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '  <path class="store-doodle-a" d="M0 0 H 210 C 245 55, 130 95, 165 180 H 0 Z" />' +
      '  <path class="store-doodle-b" d="M600 0 V 180 H 390 C 425 120, 505 90, 480 0 Z" />' +
      '  <circle class="store-doodle-dot" cx="515" cy="44" r="16" />' +
      '  <circle class="store-doodle-dot" cx="92" cy="136" r="10" />' +
      "</svg>"
    );
  }

  function renderBanner() {
    if (!els.banner) return;
    var apps = getBannerApps();

    if (!apps.length || state.query.trim()) {
      els.banner.classList.add("is-hidden");
      els.banner.innerHTML = "";
      return;
    }

    els.banner.classList.remove("is-hidden");
    els.banner.innerHTML =
      '<div class="store-banner-track">' +
      apps.map(function (app, idx) {
        return (
          '<article class="store-banner" data-open-app="' + escapeHtml(app.id) + '" tabindex="0" role="button" aria-label="' + escapeHtml(app.name) + '">' +
          makeBannerDoodleSvg(idx % 3) +
          '  <div class="store-banner-canvas">' +
          '    <h2 class="store-banner-title">' + escapeHtml(app.name) + "</h2>" +
          '    <img class="store-banner-icon" src="' + escapeHtml(app.icon) + '" width="108" height="108" alt="">' +
          "  </div>" +
          "</article>"
        );
      }).join("") +
      "</div>";
  }

  function getFilteredApps() {
    var q = state.query.trim().toLowerCase();
    return state.apps.filter(function (app) {
      if (!q) return true;
      var hay = [app.name, app.repoName, app.description, app.developer].join(" ").toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  function renderList() {
    if (!els.list) return;
    var apps = getFilteredApps();

    if (!apps.length && state.query.trim()) {
      els.list.innerHTML = "";
      els.empty.classList.remove("is-hidden");
      return;
    }

    els.empty.classList.add("is-hidden");
    els.list.innerHTML = apps.map(function (app) {
      var sub = app.tagline || app.description || "";
      return (
        '<article class="store-tile" data-open-app="' + escapeHtml(app.id) + '" tabindex="0" role="button" aria-label="' + escapeHtml(app.name) + '">' +
        '  <img class="store-tile-icon" src="' + escapeHtml(app.icon) + '" width="64" height="64" alt="' + escapeHtml(app.name) + '">' +
        '  <div class="store-tile-text">' +
        '    <div class="store-tile-name">' + escapeHtml(app.name) + "</div>" +
        (sub ? '<div class="store-tile-sub">' + escapeHtml(sub) + "</div>" : "") +
        "  </div>" +
        "</article>"
      );
    }).join("");
  }

  function renderDetail() {
    var app = findAppById(state.activeAppId);
    if (!app) {
      closeDetail();
      return;
    }

    var slug = app.repo;
    var repoData = slug ? state.repoCache[slug] : null;
    var isRepoLoading = Boolean(slug && !repoData && state.repoLoading[slug]);

    var platforms = getEffectivePlatforms(app, repoData);
    var currentPlat = null;
    for (var i = 0; i < platforms.length; i++) {
      if (platforms[i].id === state.selectedPlatformId) {
        currentPlat = platforms[i];
        break;
      }
    }
    if (!currentPlat) {
      currentPlat = pickDefaultPlatform(platforms);
      state.selectedPlatformId = currentPlat ? currentPlat.id : null;
    }

    var act = getActionInfo(currentPlat ? currentPlat.action : "visit");
    var otherApps = state.apps.filter(function (item) {
      return item.id !== app.id;
    });

    var osPickerHtml = "";
    if (!isRepoLoading && platforms.length > 1) {
      osPickerHtml =
        '<div class="m3-segmented" role="radiogroup" aria-label="' + escapeHtml(t("platform")) + '">' +
        platforms.map(function (p) {
          var isSelected = currentPlat && p.id === currentPlat.id;
          return (
            '<button type="button" class="m3-segment' + (isSelected ? " is-active" : "") + '" ' +
            'data-select-os="' + escapeHtml(p.id) + '" role="radio" aria-checked="' + (isSelected ? "true" : "false") + '">' +
            escapeHtml(p.label) +
            "</button>"
          );
        }).join("") +
        "</div>";
    }

    var releaseList = repoData && Array.isArray(repoData.releases) && repoData.releases.length
      ? repoData.releases
      : (repoData && repoData.release ? [repoData.release] : []);

    var releaseHtml = "";
    if (isRepoLoading) {
      releaseHtml =
        '<section class="app-card store-detail-release">' +
        '  <div class="store-release-head">' +
        '    <div class="store-skel store-skel-title"></div>' +
        '    <div class="store-skel store-skel-pill"></div>' +
        "  </div>" +
        '  <div class="store-skel store-skel-line"></div>' +
        '  <div class="store-skel store-skel-line is-short"></div>' +
        "</section>";
    } else if (releaseList.length > 1) {
      releaseHtml = releaseList.map(function (rel) {
        var verLabel = rel.tag_name || rel.name || "";
        var dateStr = formatDate(rel.published_at);
        var heading = t("whatsNew") + (rel.source ? " · " + rel.source : "");
        return (
          '<section class="app-card store-detail-release">' +
          '  <div class="store-release-head">' +
          '    <h3 class="store-subhead">' + escapeHtml(heading) + "</h3>" +
          '    <div class="store-release-meta">' +
          (verLabel ? '<span class="store-version-pill">' + escapeHtml(verLabel) + "</span>" : "") +
          (dateStr ? '<span class="store-release-date">' + escapeHtml(dateStr) + "</span>" : "") +
          "    </div>" +
          "  </div>" +
          renderMarkdownHtml(rel.body, { skipVersionHeading: true, repoUrl: app.html_url, emptyText: t("noChangelog") }) +
          "</section>"
        );
      }).join("");
    } else if (releaseList.length === 1) {
      var rel = releaseList[0];
      var verLabel = rel.tag_name || rel.name || "";
      var dateStr = formatDate(rel.published_at);
      releaseHtml =
        '<section class="app-card store-detail-release">' +
        '  <div class="store-release-head">' +
        '    <h3 class="store-subhead">' + escapeHtml(t("whatsNew")) + "</h3>" +
        '    <div class="store-release-meta">' +
        (verLabel ? '<span class="store-version-pill">' + escapeHtml(verLabel) + "</span>" : "") +
        (dateStr ? '<span class="store-release-date">' + escapeHtml(dateStr) + "</span>" : "") +
        "    </div>" +
        "  </div>" +
        renderMarkdownHtml(rel.body, { skipVersionHeading: true, repoUrl: app.html_url, emptyText: t("noChangelog") }) +
        "</section>";
    } else if (slug) {
      releaseHtml =
        '<section class="app-card store-detail-release">' +
        '  <h3 class="store-subhead">' + escapeHtml(t("whatsNew")) + "</h3>" +
        '  <p class="store-changelog-empty">' + escapeHtml(t("noRelease")) + "</p>" +
        "</section>";
    }

    var dev = state.developer;
    var devSectionHtml = "";
    if (dev || otherApps.length) {
      var devHeaderHtml = dev
        ? '<div class="store-dev-row">' +
          '  <img class="store-dev-icon" src="' + escapeHtml(DEFAULT_ICON) + '" width="36" height="36" alt="' + escapeHtml(dev.name) + '">' +
          '  <div class="store-dev-text">' +
          '    <span class="store-dev-name">' + escapeHtml(dev.name) + "</span>" +
          '    <span class="store-dev-sub">' + escapeHtml(t("developer")) + "</span>" +
          "  </div>" +
          '  <a class="app-btn app-btn-secondary store-dev-btn" href="' + escapeHtml(dev.url) + '" target="_blank" rel="noopener noreferrer">' +
          "    <span>" + escapeHtml(t("visit")) + "</span>" +
          "  </a>" +
          "</div>"
        : "";

      var moreGridHtml = otherApps.length
        ? '<h3 class="store-subhead">' + escapeHtml(t("moreAppsFromDev")) + "</h3>" +
          '<div class="store-more-grid">' +
          otherApps.map(function (item) {
            return (
              '<button type="button" class="store-more-card" data-open-app="' + escapeHtml(item.id) + '">' +
              '  <img src="' + escapeHtml(item.icon) + '" width="38" height="38" alt="' + escapeHtml(item.name) + '">' +
              '  <span class="store-more-name">' + escapeHtml(item.name) + "</span>" +
              "</button>"
            );
          }).join("") +
          "</div>"
        : "";

      devSectionHtml =
        '<section class="app-card store-detail-dev-section">' +
        devHeaderHtml +
        moreGridHtml +
        "</section>";
    }

    var doodleSvg =
      '<svg class="store-detail-doodle" viewBox="0 0 600 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '  <path class="store-doodle-a" d="M0 0 H 210 C 245 55, 130 95, 165 180 H 0 Z" />' +
      '  <path class="store-doodle-b" d="M600 0 V 180 H 390 C 425 120, 505 90, 480 0 Z" />' +
      '  <circle class="store-doodle-dot" cx="515" cy="44" r="16" />' +
      '  <circle class="store-doodle-dot" cx="92" cy="136" r="10" />' +
      "</svg>";

    var appTitle = (repoData && repoData.title) || app.name;
    var appTagline = (repoData && repoData.tagline) || app.tagline || app.description || "";
    var readmeText = repoData && repoData.readme ? pickLocale(repoData.readme) : "";
    var aboutHtml = "";
    if (isRepoLoading) {
      aboutHtml =
        '<div class="store-skel store-skel-line"></div>' +
        '<div class="store-skel store-skel-line"></div>' +
        '<div class="store-skel store-skel-line is-short"></div>';
    } else if (readmeText) {
      aboutHtml = renderMarkdownHtml(readmeText, { repoUrl: app.html_url, emptyText: t("noDesc") });
    } else {
      aboutHtml = '<p class="store-about-text">' + escapeHtml((repoData && repoData.description) || app.description || t("noDesc")) + "</p>";
    }

    var readmeLink = app.html_url ? app.html_url.replace(/\/+$/, "") + "#readme" : "#";

    var bannerVersion = repoData && repoData.release && (repoData.release.tag_name || repoData.release.name)
      ? (repoData.release.tag_name || repoData.release.name)
      : "";

    var resolved = isRepoLoading ? null : resolvePlatformTarget(app, currentPlat, repoData);
    var statBoxes = [];
    if (!isRepoLoading) {
      if (bannerVersion) {
        statBoxes.push({ label: getLang() === "id" ? "Versi" : "Version", value: bannerVersion });
      }
      if (currentPlat && currentPlat.id === "web") {
        statBoxes.push({ label: "Platform", value: t("webApp") });
      } else if (resolved && resolved.assets.length === 1) {
        var singleExt = (resolved.assets[0].name || "").split(".").pop();
        if (resolved.assets[0].size) {
          statBoxes.push({ label: getLang() === "id" ? "Ukuran" : "Size", value: formatBytes(resolved.assets[0].size) });
        }
        if (singleExt) {
          statBoxes.push({ label: "Format", value: "." + singleExt.toUpperCase() });
        }
      } else if (resolved && resolved.assets.length > 1) {
        var multiExt = (resolved.assets[0].name || "").split(".").pop();
        statBoxes.push({
          label: "Files",
          value: resolved.assets.length + " " + (getLang() === "id" ? "file" : "files")
        });
        if (multiExt) {
          statBoxes.push({ label: "Format", value: "." + multiExt.toUpperCase() });
        }
      } else {
        statBoxes.push({ label: getLang() === "id" ? "Sumber" : "Source", value: "GitHub" });
      }
    }

    var statBoxesHtml = statBoxes.length
      ? '<div class="store-stat-row">' +
        statBoxes.map(function (b) {
          return (
            '<div class="app-stat-box store-stat-box">' +
            '  <span class="app-stat-label">' + escapeHtml(b.label) + "</span>" +
            '  <span class="store-stat-val">' + escapeHtml(b.value) + "</span>" +
            "</div>"
          );
        }).join("") +
        "</div>"
      : "";

    var actionBlockHtml = "";
    if (isRepoLoading) {
      actionBlockHtml = '<div class="store-detail-action-area"><div class="store-skel store-skel-cta" aria-hidden="true"></div></div>';
    } else if (resolved && resolved.assets.length > 1) {
      actionBlockHtml =
        '<div class="store-detail-action-area">' +
        osPickerHtml +
        '<button type="button" class="app-btn app-btn-primary store-detail-cta" data-pick-assets="1">' +
        "  <span>" + escapeHtml(act.label) + "</span>" +
        "</button>" +
        "</div>";
    } else {
      actionBlockHtml =
        '<div class="store-detail-action-area">' +
        osPickerHtml +
        '<a class="app-btn app-btn-primary store-detail-cta" href="' + escapeHtml(resolved ? resolved.url : (app.html_url || "#")) + '" target="_blank" rel="noopener noreferrer">' +
        "  <span>" + escapeHtml(act.label) + "</span>" +
        "</a>" +
        "</div>";
    }

    var isLongReadme = Boolean(!isRepoLoading && readmeText && readmeText.length > 360);
    var readmeCollapsed = isLongReadme && !state.readmeExpanded;

    els.detailContent.innerHTML =
      '<section class="app-card store-detail-card">' +
      '  <div class="store-detail-banner">' +
      doodleSvg +
      (bannerVersion ? '<span class="store-detail-banner-ver" aria-hidden="true">' + escapeHtml(bannerVersion) + "</span>" : "") +
      '    <div class="store-detail-banner-inner">' +
      '      <img class="store-detail-banner-icon" src="' + escapeHtml(app.icon) + '" width="56" height="56" alt="' + escapeHtml(appTitle) + '">' +
      '      <h1 class="store-detail-banner-name">' + escapeHtml(appTitle) + "</h1>" +
      "    </div>" +
      "  </div>" +
      '  <div class="store-detail-info-bar">' +
      (appTagline ? '<p class="store-detail-sub">' + escapeHtml(appTagline) + "</p>" : "") +
      statBoxesHtml +
      actionBlockHtml +
      "  </div>" +
      "</section>" +
      '<section class="app-card store-detail-about">' +
      '  <div class="store-about-head">' +
      '    <h3 class="store-subhead">readme.md</h3>' +
      '    <a class="app-icon-btn store-readme-visit" href="' + escapeHtml(readmeLink) + '" target="_blank" rel="noopener noreferrer" aria-label="Visit readme.md" title="readme.md">' +
      '      <span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">arrow_outward</span>' +
      "    </a>" +
      "  </div>" +
      '  <div class="store-readme-clip' + (readmeCollapsed ? " is-collapsed" : "") + '">' +
      aboutHtml +
      "  </div>" +
      (isLongReadme
        ? '<button type="button" class="store-readme-toggle" data-toggle-readme="1">' +
          escapeHtml(state.readmeExpanded ? t("showLess") : t("showMore")) +
          "</button>"
        : "") +
      "</section>" +
      releaseHtml +
      devSectionHtml;
  }

  function openDetail(appId) {
    var app = findAppById(appId);
    if (!app) return;
    state.activeAppId = app.id;
    state.selectedPlatformId = null;
    state.readmeExpanded = false;
    els.homeView.classList.add("is-hidden");
    els.detailView.classList.remove("is-hidden");
    fetchRepoData(app);
    renderDetail();
    if (els.detailScroll) els.detailScroll.scrollTop = 0;
  }

  function closeDetail() {
    closeAssetSheet();
    state.activeAppId = null;
    state.selectedPlatformId = null;
    els.detailView.classList.add("is-hidden");
    els.homeView.classList.remove("is-hidden");
  }

  function renderAll() {
    renderStaticCopy();
    renderBanner();
    renderList();
    if (state.activeAppId) renderDetail();
  }

  function bindEvents() {
    if (els.searchInput) {
      els.searchInput.addEventListener("input", function () {
        state.query = els.searchInput.value || "";
        renderBanner();
        renderList();
      });
    }

    if (els.assetClose) {
      els.assetClose.addEventListener("click", closeAssetSheet);
    }

    if (els.assetBackdrop) {
      els.assetBackdrop.addEventListener("click", function (e) {
        if (e.target === els.assetBackdrop || e.target.closest("[data-close-sheet]")) {
          closeAssetSheet();
        }
      });
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-stop-card]")) return;

      var pickBtn = e.target.closest("[data-pick-assets]");
      if (pickBtn) {
        var app = findAppById(state.activeAppId);
        if (!app) return;
        var repoData = app.repo ? state.repoCache[app.repo] : null;
        var plats = getEffectivePlatforms(app, repoData);
        var plat = plats.find(function (p) { return p.id === state.selectedPlatformId; }) || plats[0];
        if (!plat) return;
        var assets = getMatchingAssets(repoData, plat.id);
        if (assets.length > 1) {
          openAssetSheet(app, plat, assets);
        }
        return;
      }

      var toggleReadme = e.target.closest("[data-toggle-readme]");
      if (toggleReadme) {
        state.readmeExpanded = !state.readmeExpanded;
        renderDetail();
        return;
      }

      var osBtn = e.target.closest("[data-select-os]");
      if (osBtn) {
        state.selectedPlatformId = osBtn.getAttribute("data-select-os");
        renderDetail();
        return;
      }

      var openTarget = e.target.closest("[data-open-app]");
      if (openTarget) {
        openDetail(openTarget.getAttribute("data-open-app"));
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (els.assetBackdrop && !els.assetBackdrop.classList.contains("is-hidden")) {
          closeAssetSheet();
          return;
        }
        if (state.activeAppId) {
          closeDetail();
          return;
        }
      }
      if ((e.key === "Enter" || e.key === " ") && document.activeElement) {
        var card = document.activeElement.closest("[data-open-app]");
        if (card && card.tagName !== "BUTTON" && card.tagName !== "A") {
          e.preventDefault();
          openDetail(card.getAttribute("data-open-app"));
        }
      }
    });

    if (els.detailBackBtn) {
      els.detailBackBtn.addEventListener("click", closeDetail);
    }
  }

  function loadCatalog() {
    renderStaticCopy();
    els.error.classList.add("is-hidden");

    state.loadingList = true;
    renderHomeSkeleton();

    fetch(API_BASE + "?v=5", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.loadingList = false;
        state.developer = data.developer || null;
        state.apps = (Array.isArray(data.apps) ? data.apps : []).map(function (a) {
          return Object.assign({}, a, { icon: getIconForApp(a) });
        });
        if (!data.fallback && state.apps.length) {
          writeLocalCache("org_list", data);
        }
        renderAll();
      })
      .catch(function (err) {
        state.loadingList = false;
        var stale = readLocalCache("org_list");
        if (stale && Array.isArray(stale.apps) && stale.apps.length) {
          state.developer = stale.developer || null;
          state.apps = stale.apps.map(function (a) {
            return Object.assign({}, a, { icon: getIconForApp(a) });
          });
          renderAll();
          return;
        }
        if (els.banner) els.banner.classList.add("is-hidden");
        if (els.list) els.list.innerHTML = "";
        els.errorText.textContent = t("errorLoad") + " (" + (err && err.message ? err.message : "Error") + ")";
        els.error.classList.remove("is-hidden");
      });
  }

  bindEvents();
  loadCatalog();
})();
