(function () {
  "use strict";

  /* ==========================================================
     iPadOS / iOS Folder Modal Controller (home.html)
     Pure Material 3 morphing list overlay, decoupled from Dock
     ========================================================== */
  var folderModal = document.getElementById("folder-modal");
  var folderScrim = document.getElementById("folder-scrim");
  var folderGrid = document.getElementById("folder-modal-grid");
  var folderCloseBtn = document.getElementById("folder-close-btn");
  var folderTitleEl = document.getElementById("folder-modal-title");
  var folderSurface = document.getElementById("folder-modal-surface");
  var folderBg = document.getElementById("folder-modal-bg");

  var isFolderClosing = false;
  var activeFolderState = null;

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function cancelElementAnimations(el) {
    if (!el || typeof el.getAnimations !== "function") return;
    el.getAnimations().forEach(function (anim) {
      try { anim.cancel(); } catch (_) { }
    });
  }

  function cancelFolderItemsAnimations(items) {
    items.forEach(function (item) {
      cancelElementAnimations(item);
      cancelElementAnimations(item.querySelector(".folder-app-card-bg"));
      cancelElementAnimations(item.querySelector(".folder-app-icon-wrap"));
      cancelElementAnimations(item.querySelector(".folder-app-meta"));
      cancelElementAnimations(item.querySelector(".folder-app-arrow"));
    });
  }

  function removeGhostLabels() {
    if (!folderGrid) return;
    folderGrid.querySelectorAll(".folder-app-name-ghost").forEach(function (el) {
      el.remove();
    });
  }

  function restoreOriginVisibility(state) {
    if (!state) return;
    if (state.originCard) {
      state.originCard.style.visibility = "";
    }
    if (state.originTitleEl) {
      state.originTitleEl.style.visibility = "";
    }
  }

  function collectOriginIcons(originCard) {
    var map = {};
    if (!originCard) return map;
    originCard.querySelectorAll("[data-app-id]").forEach(function (node) {
      var id = node.dataset.appId;
      if (!id) return;
      var iconTarget = node.querySelector(".big-folder-app-icon") || node;
      var iconRect = iconTarget.getBoundingClientRect();
      if (iconRect.width > 0 && iconRect.height > 0) {
        map[id] = { iconRect: iconRect };
      }
    });
    return map;
  }

  function computeSurfaceMorph(originRect, originRadius, bgRect, targetRadius) {
    var sx = originRect.width / Math.max(1, bgRect.width);
    var sy = originRect.height / Math.max(1, bgRect.height);
    var originCx = originRect.left + originRect.width / 2;
    var originCy = originRect.top + originRect.height / 2;
    var bgCx = bgRect.left + bgRect.width / 2;
    var bgCy = bgRect.top + bgRect.height / 2;
    var tx = originCx - bgCx;
    var ty = originCy - bgCy;
    var rxStart = (originRadius / Math.max(0.08, sx)).toFixed(1) + "px";
    var ryStart = (originRadius / Math.max(0.08, sy)).toFixed(1) + "px";

    return {
      originCx: originCx,
      originCy: originCy,
      startTransform: "translate(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px) scale(" + sx.toFixed(4) + ", " + sy.toFixed(4) + ")",
      startRadius: rxStart + " / " + ryStart,
      endRadius: targetRadius + "px"
    };
  }

  function computeDirectIconFlip(originIconRect, targetIconRect) {
    var tCx = targetIconRect.left + targetIconRect.width / 2;
    var tCy = targetIconRect.top + targetIconRect.height / 2;
    var oCx = originIconRect.left + originIconRect.width / 2;
    var oCy = originIconRect.top + originIconRect.height / 2;
    var isx = originIconRect.width / Math.max(1, targetIconRect.width);
    var isy = originIconRect.height / Math.max(1, targetIconRect.height);

    return "translate(" + (oCx - tCx).toFixed(2) + "px, " + (oCy - tCy).toFixed(2) + "px) scale(" + isx.toFixed(4) + ", " + isy.toFixed(4) + ")";
  }

  function computeTitleFlip(originTitleRect, targetTitleRect) {
    var oCx = originTitleRect.left + originTitleRect.width / 2;
    var oCy = originTitleRect.top + originTitleRect.height / 2;
    var tCx = targetTitleRect.left + targetTitleRect.width / 2;
    var tCy = targetTitleRect.top + targetTitleRect.height / 2;
    var s = Math.max(0.45, Math.min(1.2, originTitleRect.height / Math.max(1, targetTitleRect.height)));
    return "translate(" + (oCx - tCx).toFixed(2) + "px, " + (oCy - tCy).toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
  }

  function animateFolderItems(items, originIconRects, morph, isOpen, duration, easing) {
    var fillMode = isOpen ? "both" : "forwards";
    items.forEach(function (item) {
      var id = item.dataset.appId;
      var cardBg = item.querySelector(".folder-app-card-bg");
      var iconWrap = item.querySelector(".folder-app-icon-wrap");
      var metaWrap = item.querySelector(".folder-app-meta");
      var arrowSpan = item.querySelector(".folder-app-arrow");
      var originData = originIconRects[id];
      var originIconRect = originData ? originData.iconRect : null;
      var destRect = originIconRect || {
        left: morph.originCx - 16,
        top: morph.originCy - 16,
        width: 32,
        height: 32
      };
      var destCx = destRect.left + destRect.width / 2;
      var destCy = destRect.top + destRect.height / 2;
      var destRadius = originIconRect ? destRect.width * 0.225 : 9;

      cancelElementAnimations(item);
      cancelElementAnimations(cardBg);
      cancelElementAnimations(iconWrap);
      cancelElementAnimations(metaWrap);
      cancelElementAnimations(arrowSpan);

      if (cardBg) {
        var itemRect = item.getBoundingClientRect();
        var cardRadius = parseFloat(window.getComputedStyle(item).borderTopLeftRadius) || 20;
        var cardMorph = computeSurfaceMorph(destRect, destRadius, itemRect, cardRadius);
        var cardFrames = isOpen
          ? [
            { opacity: 0, transform: cardMorph.startTransform, borderRadius: cardMorph.startRadius },
            { opacity: 1, offset: 0.28 },
            { opacity: 1, transform: "translate(0px, 0px) scale(1, 1)", borderRadius: cardMorph.endRadius }
          ]
          : [
            { opacity: 1, transform: "translate(0px, 0px) scale(1, 1)", borderRadius: cardMorph.endRadius },
            { opacity: 1, offset: 0.72 },
            { opacity: 0, transform: cardMorph.startTransform, borderRadius: cardMorph.startRadius }
          ];
        cardBg.animate(cardFrames, { duration: duration, easing: easing, fill: fillMode });
      }

      if (iconWrap) {
        if (originIconRect) {
          var targetIconRect = iconWrap.getBoundingClientRect();
          var edgeTransform = computeDirectIconFlip(originIconRect, targetIconRect);
          var iconFrames = isOpen
            ? [{ transform: edgeTransform }, { transform: "translate(0px, 0px) scale(1, 1)" }]
            : [{ transform: "translate(0px, 0px) scale(1, 1)" }, { transform: edgeTransform }];
          iconWrap.animate(iconFrames, { duration: duration, easing: easing, fill: fillMode });
        } else {
          var tRect = iconWrap.getBoundingClientRect();
          var fx = morph.originCx - (tRect.left + tRect.width / 2);
          var fy = morph.originCy - (tRect.top + tRect.height / 2);
          var collapsed = "translate(" + fx.toFixed(1) + "px, " + fy.toFixed(1) + "px) scale(0.32)";
          var fallbackFrames = isOpen
            ? [
              { opacity: 0, transform: collapsed },
              { opacity: 1, offset: 0.45 },
              { opacity: 1, transform: "translate(0px, 0px) scale(1, 1)" }
            ]
            : [
              { opacity: 1, transform: "translate(0px, 0px) scale(1, 1)" },
              { opacity: 0, offset: 0.65 },
              { opacity: 0, transform: collapsed }
            ];
          iconWrap.animate(fallbackFrames, { duration: duration, easing: easing, fill: fillMode });
        }
      }

      if (metaWrap) {
        var mRect = metaWrap.getBoundingClientRect();
        var mdx = (destCx - (mRect.left + mRect.width / 2)) * 0.72;
        var mdy = (destCy - (mRect.top + mRect.height / 2)) * 0.72;
        var metaCollapsed = "translate(" + mdx.toFixed(1) + "px, " + mdy.toFixed(1) + "px) scale(" + (isOpen ? "0.42" : "0.38") + ")";
        var metaFrames = isOpen
          ? [
            { opacity: 0, transform: metaCollapsed },
            { opacity: 0, offset: 0.14 },
            { opacity: 1, transform: "translate(0px, 0px) scale(1)" }
          ]
          : [
            { opacity: 1, transform: "translate(0px, 0px) scale(1)" },
            { opacity: 0, offset: 0.56, transform: metaCollapsed },
            { opacity: 0, transform: metaCollapsed }
          ];
        metaWrap.animate(metaFrames, { duration: duration, easing: easing, fill: fillMode });
      }

      if (arrowSpan) {
        var aRect = arrowSpan.getBoundingClientRect();
        var adx = (destCx - (aRect.left + aRect.width / 2)) * 0.68;
        var ady = (destCy - (aRect.top + aRect.height / 2)) * 0.68;
        var arrowCollapsed = "translate(" + adx.toFixed(1) + "px, " + ady.toFixed(1) + "px) scale(0.45)";
        var arrowFrames = isOpen
          ? [
            { opacity: 0, transform: arrowCollapsed },
            { opacity: 0, offset: 0.25 },
            { opacity: 0.65, transform: "translate(0px, 0px) scale(1)" }
          ]
          : [
            { opacity: 0.65, transform: "translate(0px, 0px) scale(1)" },
            { opacity: 0, offset: 0.45, transform: arrowCollapsed },
            { opacity: 0, transform: arrowCollapsed }
          ];
        arrowSpan.animate(arrowFrames, { duration: duration, easing: easing, fill: fillMode });
      }
    });
  }

  function renderFolderItem(app) {
    var appBtn = document.createElement("button");
    appBtn.type = "button";
    appBtn.className = "folder-app-item";
    appBtn.setAttribute("aria-label", app.title);
    appBtn.dataset.appId = app.id;

    var cardBg = document.createElement("span");
    cardBg.className = "folder-app-card-bg";
    cardBg.setAttribute("aria-hidden", "true");

    var iconWrap = document.createElement("div");
    iconWrap.className = "folder-app-icon-wrap";
    iconWrap.innerHTML = window.AppRegistry ? window.AppRegistry.getItemIconHtml(app) : "";

    var metaWrap = document.createElement("div");
    metaWrap.className = "folder-app-meta";

    var nameSpan = document.createElement("span");
    nameSpan.className = "folder-app-name";
    nameSpan.textContent = app.title;
    metaWrap.appendChild(nameSpan);

    if (app.description) {
      var descSpan = document.createElement("span");
      descSpan.className = "folder-app-desc";
      descSpan.textContent = app.description;
      metaWrap.appendChild(descSpan);
    }

    var arrowSpan = document.createElement("span");
    arrowSpan.className = "material-symbols-rounded folder-app-arrow";
    arrowSpan.setAttribute("aria-hidden", "true");
    arrowSpan.textContent = "chevron_right";

    appBtn.appendChild(cardBg);
    appBtn.appendChild(iconWrap);
    appBtn.appendChild(metaWrap);
    appBtn.appendChild(arrowSpan);

    appBtn.addEventListener("click", function () {
      if (folderScrim) folderScrim.classList.remove("is-above-windows");
      if (folderModal) folderModal.classList.remove("is-above-windows");
      if (window.AppRegistry && typeof window.AppRegistry.launch === "function") {
        window.AppRegistry.launch(app, iconWrap);
      }
      closeFolder();
    });

    return appBtn;
  }

  function openFolder(title, items, originEl) {
    if (!folderModal || !folderScrim || !folderGrid || isFolderClosing) return;
    if (activeFolderState) {
      restoreOriginVisibility(activeFolderState);
      activeFolderState = null;
    }

    var list = Array.isArray(items) ? items : [];
    if (folderTitleEl) {
      folderTitleEl.textContent = title || "More Apps";
    }

    var originCard = (originEl && originEl.querySelector && originEl.querySelector(".dock-folder-box")) || originEl;
    var originTitleEl = null;
    if (originCard && originCard.closest) {
      var bigFolderWrap = originCard.closest(".big-folder");
      if (bigFolderWrap) {
        originTitleEl = bigFolderWrap.querySelector(".big-folder-title");
      }
    }

    var originRect = {
      left: window.innerWidth / 2 - 80,
      top: window.innerHeight / 2 - 80,
      width: 160,
      height: 160
    };
    var originRadius = 28;
    var originIconRects = {};

    if (originCard && originCard.getBoundingClientRect) {
      originRect = originCard.getBoundingClientRect();
      originRadius = parseFloat(window.getComputedStyle(originCard).borderTopLeftRadius) || 28;
      originIconRects = collectOriginIcons(originCard);
    }

    folderGrid.innerHTML = "";
    list.forEach(function (app) {
      folderGrid.appendChild(renderFolderItem(app));
    });

    if (window.AppWindow && typeof window.AppWindow.sync === "function") {
      window.AppWindow.sync();
    }

    folderScrim.classList.add("is-above-windows");
    folderModal.classList.add("is-above-windows");
    folderScrim.hidden = false;
    folderModal.hidden = false;
    var needsScrollClip = folderGrid.scrollHeight > folderGrid.clientHeight + 2;
    folderModal.classList.toggle("is-scrollable", needsScrollClip);
    folderGrid.scrollTop = 0;

    var bgEl = folderBg || folderSurface;
    var modalHeader = folderModal.querySelector(".folder-modal-header");
    cancelElementAnimations(folderScrim);
    cancelElementAnimations(bgEl);
    cancelElementAnimations(modalHeader);
    cancelElementAnimations(folderTitleEl);
    cancelElementAnimations(folderCloseBtn);

    var originTitleRect = originTitleEl ? originTitleEl.getBoundingClientRect() : null;

    if (originCard) originCard.style.visibility = "hidden";
    if (originTitleEl) originTitleEl.style.visibility = "hidden";

    activeFolderState = {
      originCard: originCard,
      originTitleEl: originTitleEl,
      originRect: originRect,
      originRadius: originRadius,
      originTitleRect: originTitleRect
    };

    if (prefersReducedMotion() || !bgEl || typeof bgEl.animate !== "function") {
      folderModal.classList.add("is-scrollable");
      return;
    }

    var bgRect = bgEl.getBoundingClientRect();
    var targetRadius = parseFloat(window.getComputedStyle(bgEl).borderTopLeftRadius) || 34;
    var morph = computeSurfaceMorph(originRect, originRadius, bgRect, targetRadius);
    var OPEN_MS = 360;
    var SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

    folderScrim.animate([
      { opacity: 0 },
      { opacity: 1 }
    ], {
      duration: 240,
      easing: "ease-out",
      fill: "both"
    });

    if (originTitleRect && folderTitleEl) {
      var targetTitleRect = folderTitleEl.getBoundingClientRect();
      var startTitleTransform = computeTitleFlip(originTitleRect, targetTitleRect);
      folderTitleEl.animate([
        { transform: startTitleTransform },
        { transform: "translate(0px, 0px) scale(1)" }
      ], {
        duration: OPEN_MS,
        easing: SPRING,
        fill: "both"
      });
      if (folderCloseBtn) {
        folderCloseBtn.animate([
          { opacity: 0, transform: "translateY(-50%) scale(0.65)" },
          { opacity: 1, transform: "translateY(-50%) scale(1)" }
        ], {
          duration: 240,
          delay: 80,
          easing: SPRING,
          fill: "both"
        });
      }
    } else if (modalHeader) {
      modalHeader.animate([
        { opacity: 0, transform: "translateY(14px) scale(0.94)" },
        { opacity: 1, transform: "translateY(0px) scale(1)" }
      ], {
        duration: 300,
        delay: 40,
        easing: SPRING,
        fill: "both"
      });
    }

    var bgAnim = bgEl.animate([
      { transform: morph.startTransform, borderRadius: morph.startRadius },
      { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: morph.endRadius }
    ], {
      duration: OPEN_MS,
      easing: SPRING,
      fill: "both"
    });

    removeGhostLabels();
    var renderedItems = folderGrid.querySelectorAll(".folder-app-item");
    animateFolderItems(renderedItems, originIconRects, morph, true, OPEN_MS, SPRING);

    bgAnim.onfinish = function () {
      cancelElementAnimations(bgEl);
      cancelElementAnimations(folderScrim);
      cancelElementAnimations(modalHeader);
      cancelElementAnimations(folderTitleEl);
      cancelElementAnimations(folderCloseBtn);
      removeGhostLabels();
      cancelFolderItemsAnimations(renderedItems);
      if (!isFolderClosing && !folderModal.hidden) {
        folderModal.classList.add("is-scrollable");
      }
    };
  }

  function closeFolder() {
    if (!folderModal || folderModal.hidden || isFolderClosing) return;
    isFolderClosing = true;

    folderModal.classList.remove("is-scrollable");
    folderGrid.scrollTop = 0;

    var state = activeFolderState;
    var bgEl = folderBg || folderSurface;
    var modalHeader = folderModal.querySelector(".folder-modal-header");
    var renderedItems = folderGrid.querySelectorAll(".folder-app-item");

    function finalizeClose() {
      cancelElementAnimations(bgEl);
      cancelElementAnimations(folderScrim);
      cancelElementAnimations(modalHeader);
      cancelElementAnimations(folderTitleEl);
      cancelElementAnimations(folderCloseBtn);
      removeGhostLabels();
      cancelFolderItemsAnimations(renderedItems);
      folderModal.classList.remove("is-above-windows");
      folderScrim.classList.remove("is-above-windows");
      folderModal.hidden = true;
      folderScrim.hidden = true;
      restoreOriginVisibility(state);
      activeFolderState = null;
      isFolderClosing = false;
    }

    if (prefersReducedMotion() || !bgEl || typeof bgEl.animate !== "function") {
      finalizeClose();
      return;
    }

    var originCard = state && state.originCard && document.body.contains(state.originCard) ? state.originCard : null;
    var originRect = originCard ? originCard.getBoundingClientRect() : (state && state.originRect) || {
      left: window.innerWidth / 2 - 80,
      top: window.innerHeight / 2 - 80,
      width: 160,
      height: 160
    };
    var originRadius = originCard
      ? (parseFloat(window.getComputedStyle(originCard).borderTopLeftRadius) || 28)
      : ((state && state.originRadius) || 28);
    var originIconRects = collectOriginIcons(originCard);
    var originTitleEl = state && state.originTitleEl && document.body.contains(state.originTitleEl) ? state.originTitleEl : null;
    var originTitleRect = originTitleEl ? originTitleEl.getBoundingClientRect() : (state && state.originTitleRect) || null;

    var bgRect = bgEl.getBoundingClientRect();
    var targetRadius = parseFloat(window.getComputedStyle(bgEl).borderTopLeftRadius) || 34;
    var morph = computeSurfaceMorph(originRect, originRadius, bgRect, targetRadius);
    var CLOSE_MS = 270;
    var CLOSE_EASE = "cubic-bezier(0.32, 0.08, 0.24, 1)";

    cancelElementAnimations(bgEl);
    cancelElementAnimations(folderScrim);
    cancelElementAnimations(modalHeader);
    cancelElementAnimations(folderTitleEl);
    cancelElementAnimations(folderCloseBtn);
    removeGhostLabels();

    animateFolderItems(renderedItems, originIconRects, morph, false, CLOSE_MS, CLOSE_EASE);

    if (originTitleRect && folderTitleEl) {
      var targetTitleRect = folderTitleEl.getBoundingClientRect();
      var endTitleTransform = computeTitleFlip(originTitleRect, targetTitleRect);
      folderTitleEl.animate([
        { transform: "translate(0px, 0px) scale(1)" },
        { transform: endTitleTransform }
      ], {
        duration: CLOSE_MS,
        easing: CLOSE_EASE,
        fill: "forwards"
      });
      if (folderCloseBtn) {
        folderCloseBtn.animate([
          { opacity: 1, transform: "translateY(-50%) scale(1)" },
          { opacity: 0, transform: "translateY(-50%) scale(0.65)" }
        ], {
          duration: 130,
          easing: "ease-out",
          fill: "forwards"
        });
      }
    } else if (modalHeader) {
      modalHeader.animate([
        { opacity: 1, transform: "translateY(0px) scale(1)" },
        { opacity: 0, transform: "translateY(10px) scale(0.95)" }
      ], {
        duration: 150,
        easing: "ease-out",
        fill: "forwards"
      });
    }

    folderScrim.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], {
      duration: CLOSE_MS,
      easing: "ease-out",
      fill: "forwards"
    });

    var bgCloseAnim = bgEl.animate([
      { transform: "translate(0px, 0px) scale(1, 1)", borderRadius: morph.endRadius },
      { transform: morph.startTransform, borderRadius: morph.startRadius }
    ], {
      duration: CLOSE_MS,
      easing: CLOSE_EASE,
      fill: "forwards"
    });

    bgCloseAnim.onfinish = finalizeClose;
    bgCloseAnim.oncancel = finalizeClose;
  }

  if (folderCloseBtn) {
    folderCloseBtn.addEventListener("click", closeFolder);
  }
  if (folderScrim) {
    folderScrim.addEventListener("click", closeFolder);
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && folderModal && !folderModal.hidden) {
      closeFolder();
    }
  });

  window.FolderModal = {
    open: openFolder,
    close: closeFolder
  };
})();
