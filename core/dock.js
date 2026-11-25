(function () {
  "use strict";

  /* ==========================================================
     Desktop Flexible Dock & Mode Transitions (home.html)
     Pure Material 3, 120fps composited animations
     ========================================================== */
  function initHomeDock() {
    var dock = document.getElementById("dock");
    if (!dock || !window.AppRegistry) return;

    var registry = window.AppRegistry;
    var lastVisibleCount = -1;
    var hasAnimatedEntrance = false;
    var isAppsMode = false;
    var modeTransitionToken = 0;
    var cancelDockEntrance = null;
    var activeFlyLayer = null;

    function prefersReducedMotion() {
      return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function springPop(t) {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.15);
    }

    function getEmptyPillWidth(layout) {
      return Math.max(Math.round(layout.finalH), layout.actualPadL + layout.actualPadR + 24);
    }

    function setDesktopDocked(docked) {
      if (window.DesktopShell && typeof window.DesktopShell.setShortcutsDocked === "function") {
        window.DesktopShell.setShortcutsDocked(docked);
      }
    }

    function setDesktopClockCentered(centered) {
      if (window.DesktopShell && typeof window.DesktopShell.setClockCentered === "function") {
        window.DesktopShell.setClockCentered(centered);
      }
    }

    function collectDesktopCards() {
      if (window.DesktopShell && typeof window.DesktopShell.collectShortcutCards === "function") {
        return window.DesktopShell.collectShortcutCards();
      }
      return {};
    }

    function openFolderModal(title, items, originEl) {
      if (window.FolderModal && typeof window.FolderModal.open === "function") {
        window.FolderModal.open(title, items, originEl);
      }
    }

    function clearFlyLayer() {
      if (activeFlyLayer && activeFlyLayer.parentNode) {
        activeFlyLayer.parentNode.removeChild(activeFlyLayer);
      }
      activeFlyLayer = null;
    }

    function stopDockAnimation() {
      if (cancelDockEntrance) {
        cancelDockEntrance();
        cancelDockEntrance = null;
      }
      clearFlyLayer();
    }

    function scopeCloneSvgIds(rootEl, tag) {
      rootEl.querySelectorAll("svg").forEach(function (svg, idx) {
        if (!svg.querySelector("[id]")) return;
        var suffix = "_" + tag + idx;
        var ids = {};
        svg.querySelectorAll("[id]").forEach(function (el) {
          var oldId = el.getAttribute("id");
          if (oldId) {
            ids[oldId] = oldId + suffix;
            el.setAttribute("id", ids[oldId]);
          }
        });
        svg.querySelectorAll("[clip-path], [fill], [href], [xlink\\:href]").forEach(function (el) {
          ["clip-path", "fill"].forEach(function (attr) {
            var val = el.getAttribute(attr);
            if (val && val.indexOf("url(#") !== -1) {
              el.setAttribute(attr, val.replace(/url\(#([^)]+)\)/g, function (m, id) {
                return ids[id] ? "url(#" + ids[id] + ")" : m;
              }));
            }
          });
          ["href", "xlink:href"].forEach(function (attr) {
            var val = el.getAttribute(attr);
            if (val && val.charAt(0) === "#") {
              var id = val.slice(1);
              if (ids[id]) el.setAttribute(attr, "#" + ids[id]);
            }
          });
        });
      });
    }

    function measureDockLayout(buttons) {
      var finalW = dock.offsetWidth;
      var finalH = dock.offsetHeight;
      var dockRect = dock.getBoundingClientRect();
      var metrics = buttons.map(function (el) {
        return {
          el: el,
          shortcutId: el.dataset.shortcutId || "",
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight
        };
      });

      var total = metrics.length;
      var actualPadL = total > 0 ? metrics[0].left : 14;
      var lastM = total > 0 ? metrics[total - 1] : null;
      var actualPadR = lastM ? Math.max(actualPadL, finalW - (lastM.left + lastM.width)) : actualPadL;
      var stepDist = metrics.map(function (m, idx) {
        if (idx === 0) return 0;
        var prev = metrics[idx - 1];
        return Math.max(0, m.left - (prev.left + prev.width));
      });

      return {
        finalW: finalW,
        finalH: finalH,
        finalLeft: dockRect.left,
        finalTop: dockRect.top,
        metrics: metrics,
        actualPadL: actualPadL,
        actualPadR: actualPadR,
        stepDist: stepDist
      };
    }

    function resetDockStyles(layout, keepPillWidth) {
      dock.style.transition = "none";
      layout.metrics.forEach(function (m) {
        m.el.style.transition = "none";
      });

      dock.classList.remove("is-animating");
      if (!keepPillWidth) {
        dock.style.width = "";
        dock.style.height = "";
      }
      dock.style.opacity = "";
      dock.style.transform = "";
      layout.metrics.forEach(function (m) {
        m.el.style.left = "";
        m.el.style.top = "";
        m.el.style.width = "";
        m.el.style.height = "";
        m.el.style.opacity = "";
        m.el.style.transform = "";
        var lbl = m.el.querySelector(".dock-item-label");
        if (lbl) lbl.style.opacity = "";
      });

      void dock.offsetWidth;
      dock.style.transition = "";
      layout.metrics.forEach(function (m) {
        m.el.style.transition = "";
      });
    }

    function animateDockExpand(buttons, startPillW, onDone) {
      dock.classList.remove("is-animating");
      if (prefersReducedMotion() || buttons.length === 0) {
        dock.style.width = "";
        dock.style.height = "";
        dock.style.opacity = "";
        dock.style.transform = "";
        if (onDone) onDone();
        return;
      }

      dock.style.transition = "none";
      dock.style.transform = "none";
      dock.style.width = "";
      dock.style.height = "";
      dock.style.opacity = "";
      void dock.offsetWidth;

      var layout = measureDockLayout(buttons);
      var totalItems = layout.metrics.length;
      var STEP_MS = totalItems <= 5 ? 46 : 32;
      var SLOT_MS = 230;
      var totalDuration = (totalItems - 1) * STEP_MS + SLOT_MS;
      var minPill = getEmptyPillWidth(layout);
      var hasStartPill = typeof startPillW === "number" && startPillW > 0;
      var initialPillW = hasStartPill ? Math.max(minPill, startPillW) : minPill;

      dock.classList.add("is-animating");
      dock.style.height = layout.finalH + "px";
      dock.style.width = initialPillW.toFixed(2) + "px";
      dock.style.opacity = hasStartPill ? "1" : "0";
      dock.style.transform = hasStartPill ? "translate3d(0, 0, 0)" : "translate3d(0, 20px, 0)";

      layout.metrics.forEach(function (m) {
        m.el.style.transition = "none";
        m.el.style.top = m.top + "px";
        m.el.style.width = m.width + "px";
        m.el.style.height = m.height + "px";
        m.el.style.opacity = "0";
      });

      var rafId = 0;
      var startTime = 0;

      function cleanup(skipCallback) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        resetDockStyles(layout, false);
        cancelDockEntrance = null;
        if (!skipCallback && onDone) onDone();
      }

      cancelDockEntrance = function () { cleanup(true); };

      function tick(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;

        if (elapsed >= totalDuration) {
          cleanup(false);
          return;
        }

        var dockFade = hasStartPill ? 1 : Math.min(1, elapsed / 130);
        var dockLift = hasStartPill ? 0 : (1 - easeOutQuart(Math.min(1, elapsed / 240))) * 20;

        var curW = layout.actualPadL + layout.actualPadR;
        var itemSlots = new Array(totalItems);

        for (var i = 0; i < totalItems; i++) {
          var m = layout.metrics[i];
          var u = Math.max(0, Math.min(1, (elapsed - i * STEP_MS) / SLOT_MS));
          var slot = easeOutQuart(u);
          itemSlots[i] = { u: u, slot: slot };
          curW += slot * (m.width + layout.stepDist[i]);
        }

        var clampedW = Math.max(initialPillW, curW);
        var centerOffset = Math.max(0, (clampedW - curW) / 2);
        var cursorX = layout.actualPadL + centerOffset;

        for (var j = 0; j < totalItems; j++) {
          var jm = layout.metrics[j];
          var st = itemSlots[j];
          var pop = springPop(st.u);

          cursorX += st.slot * layout.stepDist[j];
          var itemLeft = cursorX + (st.slot - 1) * jm.width / 2;
          cursorX += st.slot * jm.width;

          var scale = 0.28 + 0.72 * pop;
          var yShift = (1 - pop) * 12;

          jm.el.style.opacity = st.u <= 0 ? "0" : String(Math.min(1, st.u * 2.4));
          jm.el.style.transform =
            "translate3d(" + itemLeft.toFixed(2) + "px, " + yShift.toFixed(2) + "px, 0) scale(" + scale.toFixed(4) + ")";
        }

        dock.style.width = clampedW.toFixed(2) + "px";
        dock.style.opacity = String(dockFade);
        dock.style.transform = "translate3d(0, " + dockLift.toFixed(2) + "px, 0)";

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    function animateDockContract(onDone) {
      var buttons = Array.prototype.slice.call(dock.querySelectorAll(".dock-item, .dock-folder"));
      if (prefersReducedMotion() || buttons.length === 0) {
        if (onDone) onDone(dock.offsetHeight || 77);
        return;
      }

      var layout = measureDockLayout(buttons);
      var totalItems = layout.metrics.length;
      var STEP_MS = totalItems <= 5 ? 32 : 18;
      var SLOT_MS = 140;
      var totalDuration = (totalItems - 1) * STEP_MS + SLOT_MS;
      var minPillW = getEmptyPillWidth(layout);

      dock.style.transition = "none";
      dock.classList.add("is-animating");
      dock.style.height = layout.finalH + "px";

      layout.metrics.forEach(function (m) {
        m.el.style.transition = "none";
        m.el.style.top = m.top + "px";
        m.el.style.width = m.width + "px";
        m.el.style.height = m.height + "px";
      });

      var rafId = 0;
      var startTime = 0;

      function cleanup(skipCallback) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (skipCallback) {
          resetDockStyles(layout, false);
        } else {
          dock.style.transition = "none";
          dock.style.width = minPillW.toFixed(2) + "px";
          dock.style.height = layout.finalH + "px";
          dock.innerHTML = "";
        }
        cancelDockEntrance = null;
        if (!skipCallback && onDone) onDone(minPillW);
      }

      cancelDockEntrance = function () { cleanup(true); };

      function tick(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;

        if (elapsed >= totalDuration) {
          cleanup(false);
          return;
        }

        var curW = layout.actualPadL + layout.actualPadR;
        var itemStates = new Array(totalItems);

        for (var i = 0; i < totalItems; i++) {
          var m = layout.metrics[i];
          var order = totalItems - 1 - i;
          var prog = Math.max(0, Math.min(1, (elapsed - order * STEP_MS) / SLOT_MS));
          var u = 1 - easeInOutCubic(prog);
          itemStates[i] = u;
          curW += u * (m.width + layout.stepDist[i]);
        }

        var clampedW = Math.max(minPillW, curW);
        var centerOffset = Math.max(0, (clampedW - curW) / 2);
        var cursorX = layout.actualPadL + centerOffset;

        for (var j = 0; j < totalItems; j++) {
          var jm = layout.metrics[j];
          var ju = itemStates[j];

          cursorX += ju * layout.stepDist[j];
          var itemLeft = cursorX + (ju - 1) * jm.width / 2;
          cursorX += ju * jm.width;

          var scale = 0.25 + 0.75 * ju;
          var yShift = (1 - ju) * 10;

          jm.el.style.opacity = String(Math.max(0, Math.min(1, (ju - 0.1) / 0.9)));
          jm.el.style.transform =
            "translate3d(" + itemLeft.toFixed(2) + "px, " + yShift.toFixed(2) + "px, 0) scale(" + scale.toFixed(4) + ")";
        }

        dock.style.width = clampedW.toFixed(2) + "px";
        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    function getDockButtonTargetIconRect(btn) {
      var target = btn.querySelector(".dock-item-icon, .dock-folder-box") || btn;
      return target.getBoundingClientRect();
    }

    function spawnFlyCard(desktopCardInfo, uidTag) {
      var clone = desktopCardInfo.el.cloneNode(true);
      clone.classList.add("dock-fly-card");
      clone.removeAttribute("tabindex");
      clone.setAttribute("aria-hidden", "true");
      scopeCloneSvgIds(clone, uidTag);
      var r = desktopCardInfo.rect;
      clone.style.width = r.width.toFixed(2) + "px";
      clone.style.height = r.height.toFixed(2) + "px";
      return clone;
    }

    function animateDockAppsArrive(buttons, desktopCards, startPillW) {
      dock.classList.remove("is-animating");
      if (prefersReducedMotion() || buttons.length === 0) {
        dock.style.width = "";
        dock.style.height = "";
        dock.style.opacity = "";
        dock.style.transform = "";
        return;
      }

      dock.style.transition = "none";
      dock.style.transform = "none";
      dock.style.width = "";
      dock.style.height = "";
      dock.style.opacity = "";
      void dock.offsetWidth;

      var layout = measureDockLayout(buttons);
      var emptyW = getEmptyPillWidth(layout);
      var pillStartW = typeof startPillW === "number" && startPillW > 0 ? Math.max(emptyW, startPillW) : emptyW;

      var pairs = buttons.map(function (btn, idx) {
        var sid = btn.dataset.shortcutId || "";
        return {
          btn: btn,
          label: btn.querySelector(".dock-item-label"),
          targetRect: getDockButtonTargetIconRect(btn),
          originInfo: desktopCards[sid] || null,
          clone: null,
          idx: idx
        };
      });

      var hasAnyOrigin = pairs.some(function (p) { return Boolean(p.originInfo); });
      if (!hasAnyOrigin) {
        animateDockExpand(buttons, pillStartW);
        return;
      }

      clearFlyLayer();
      var flyLayer = document.createElement("div");
      flyLayer.className = "dock-fly-layer";
      pairs.forEach(function (pair, i) {
        if (!pair.originInfo) return;
        var clone = spawnFlyCard(pair.originInfo, "in" + i);
        var oRect = pair.originInfo.rect;
        clone.style.transform =
          "translate3d(" + oRect.left.toFixed(2) + "px, " + oRect.top.toFixed(2) + "px, 0) scale(1)";
        clone.style.opacity = "1";
        pair.clone = clone;
        flyLayer.appendChild(clone);
      });
      document.body.appendChild(flyLayer);
      activeFlyLayer = flyLayer;

      dock.classList.add("is-animating");
      dock.style.height = layout.finalH + "px";
      dock.style.width = pillStartW.toFixed(2) + "px";

      layout.metrics.forEach(function (m, idx) {
        m.el.style.transition = "none";
        m.el.style.left = m.left + "px";
        m.el.style.top = m.top + "px";
        m.el.style.width = m.width + "px";
        m.el.style.height = m.height + "px";
        m.el.style.opacity = "0";
        if (pairs[idx].label) pairs[idx].label.style.opacity = "0";
      });

      var PILL_MS = 250;
      var STEP_MS = 22;
      var FLY_MS = 320;
      var totalDuration = Math.max(PILL_MS, (pairs.length - 1) * STEP_MS + FLY_MS);
      var rafId = 0;
      var startTime = 0;

      function cleanup() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        clearFlyLayer();
        resetDockStyles(layout, false);
        cancelDockEntrance = null;
      }

      cancelDockEntrance = cleanup;

      function tick(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;

        if (elapsed >= totalDuration) {
          cleanup();
          return;
        }

        var pillP = easeOutQuart(Math.min(1, elapsed / PILL_MS));
        var curW = pillStartW + (layout.finalW - pillStartW) * pillP;
        dock.style.width = curW.toFixed(2) + "px";

        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          var u = Math.max(0, Math.min(1, (elapsed - i * STEP_MS) / FLY_MS));
          var p = easeOutQuart(u);

          if (pair.clone && pair.originInfo) {
            var oRect = pair.originInfo.rect;
            var tRect = pair.targetRect;
            var oCx = oRect.left + oRect.width / 2;
            var oCy = oRect.top + oRect.height / 2;
            var tCx = tRect.left + tRect.width / 2;
            var tCy = tRect.top + tRect.height / 2;
            var endScale = tRect.width / Math.max(1, oRect.width);

            var curCx = oCx + (tCx - oCx) * p;
            var curCy = oCy + (tCy - oCy) * p;
            var curScale = 1 + (endScale - 1) * p;
            var tx = curCx - oRect.width / 2;
            var ty = curCy - oRect.height / 2;

            pair.clone.style.transform =
              "translate3d(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px, 0) scale(" + curScale.toFixed(4) + ")";

            if (u >= 0.86) {
              var fadeOut = (u - 0.86) / 0.14;
              pair.btn.style.opacity = "1";
              pair.clone.style.opacity = String(Math.max(0, 1 - fadeOut));
            } else {
              pair.btn.style.opacity = "0";
              pair.clone.style.opacity = "1";
            }
          } else {
            pair.btn.style.opacity = String(Math.min(1, u * 2));
          }

          if (pair.label) {
            pair.label.style.opacity = String(Math.max(0, Math.min(1, (u - 0.55) / 0.45)));
          }
        }

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    function animateDockAppsReturn(desktopCards, onDone) {
      var buttons = Array.prototype.slice.call(dock.querySelectorAll(".dock-item, .dock-folder"));
      if (prefersReducedMotion() || buttons.length === 0) {
        if (onDone) onDone(dock.offsetHeight || 77);
        return;
      }

      var layout = measureDockLayout(buttons);
      var minPillW = getEmptyPillWidth(layout);

      var pairs = buttons.map(function (btn, idx) {
        var sid = btn.dataset.shortcutId || "";
        return {
          btn: btn,
          startRect: getDockButtonTargetIconRect(btn),
          originInfo: desktopCards[sid] || null,
          clone: null,
          idx: idx
        };
      });

      var hasAnyOrigin = pairs.some(function (p) { return Boolean(p.originInfo); });
      if (!hasAnyOrigin) {
        animateDockContract(onDone);
        return;
      }

      clearFlyLayer();
      var flyLayer = document.createElement("div");
      flyLayer.className = "dock-fly-layer";
      pairs.forEach(function (pair, i) {
        if (!pair.originInfo) return;
        var clone = spawnFlyCard(pair.originInfo, "out" + i);
        var tRect = pair.startRect;
        var oRect = pair.originInfo.rect;
        var tCx = tRect.left + tRect.width / 2;
        var tCy = tRect.top + tRect.height / 2;
        var startScale = tRect.width / Math.max(1, oRect.width);
        var sx = tCx - oRect.width / 2;
        var sy = tCy - oRect.height / 2;
        clone.style.transform =
          "translate3d(" + sx.toFixed(2) + "px, " + sy.toFixed(2) + "px, 0) scale(" + startScale.toFixed(4) + ")";
        clone.style.opacity = "1";
        pair.clone = clone;
        flyLayer.appendChild(clone);
      });
      document.body.appendChild(flyLayer);
      activeFlyLayer = flyLayer;

      dock.style.transition = "none";
      dock.classList.add("is-animating");
      dock.style.height = layout.finalH + "px";
      dock.style.width = layout.finalW + "px";

      pairs.forEach(function (pair) {
        pair.btn.style.transition = "none";
        pair.btn.style.opacity = "0";
      });

      var STEP_MS = 18;
      var FLY_MS = 270;
      var totalDuration = (pairs.length - 1) * STEP_MS + FLY_MS;
      var PILL_MS = totalDuration;
      var rafId = 0;
      var startTime = 0;

      function cleanup(skipCallback) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (!skipCallback) {
          setDesktopDocked(false);
        }
        clearFlyLayer();
        if (skipCallback) {
          resetDockStyles(layout, false);
        } else {
          dock.style.transition = "none";
          dock.style.width = minPillW.toFixed(2) + "px";
          dock.style.height = layout.finalH + "px";
          dock.innerHTML = "";
        }
        cancelDockEntrance = null;
        if (!skipCallback && onDone) onDone(minPillW);
      }

      cancelDockEntrance = function () { cleanup(true); };

      function tick(now) {
        if (!startTime) startTime = now;
        var elapsed = now - startTime;

        if (elapsed >= totalDuration) {
          cleanup(false);
          return;
        }

        var pillP = easeInOutCubic(Math.min(1, elapsed / PILL_MS));
        var curW = layout.finalW + (minPillW - layout.finalW) * pillP;
        dock.style.width = curW.toFixed(2) + "px";

        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i];
          if (!pair.clone || !pair.originInfo) continue;

          var u = Math.max(0, Math.min(1, (elapsed - i * STEP_MS) / FLY_MS));
          var p = easeOutQuart(u);

          var tRect = pair.startRect;
          var oRect = pair.originInfo.rect;
          var tCx = tRect.left + tRect.width / 2;
          var tCy = tRect.top + tRect.height / 2;
          var oCx = oRect.left + oRect.width / 2;
          var oCy = oRect.top + oRect.height / 2;
          var startScale = tRect.width / Math.max(1, oRect.width);

          var curCx = tCx + (oCx - tCx) * p;
          var curCy = tCy + (oCy - tCy) * p;
          var curScale = startScale + (1 - startScale) * p;
          var tx = curCx - oRect.width / 2;
          var ty = curCy - oRect.height / 2;

          pair.clone.style.opacity = "1";
          pair.clone.style.transform =
            "translate3d(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px, 0) scale(" + curScale.toFixed(4) + ")";
        }

        rafId = requestAnimationFrame(tick);
      }

      rafId = requestAnimationFrame(tick);
    }

    function createDockItemButton(item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dock-item";
      btn.setAttribute("aria-label", item.title);
      btn.dataset.appId = item.id;
      btn.innerHTML =
        '<span class="dock-item-icon">' + registry.getItemIconHtml(item) + '</span>' +
        '<span class="dock-item-label">' + item.title + '</span>' +
        '<span class="dock-tooltip">' + item.title + '</span>';
      btn.addEventListener("click", function () {
        registry.launch(item, btn);
      });
      return btn;
    }

    function createDockFolderButton(title, items, tooltipText) {
      var folderBtn = document.createElement("button");
      folderBtn.type = "button";
      folderBtn.className = "dock-folder";
      folderBtn.setAttribute("aria-label", "Folder " + title);

      var folderBox = document.createElement("span");
      folderBox.className = "dock-folder-box";

      var previewGrid = document.createElement("div");
      previewGrid.className = "folder-preview-grid";

      items.slice(0, 4).forEach(function (item) {
        var itemEl = document.createElement("div");
        itemEl.className = "folder-preview-item";
        itemEl.dataset.appId = item.id;
        itemEl.innerHTML = registry.getItemIconHtml(item);
        previewGrid.appendChild(itemEl);
      });

      folderBox.appendChild(previewGrid);
      folderBtn.appendChild(folderBox);

      var lbl = document.createElement("span");
      lbl.className = "dock-item-label";
      lbl.textContent = title;
      folderBtn.appendChild(lbl);

      var tip = document.createElement("span");
      tip.className = "dock-tooltip";
      tip.textContent = tooltipText || title;
      folderBtn.appendChild(tip);

      folderBtn.addEventListener("click", function () {
        openFolderModal(title, items, folderBtn);
      });

      return folderBtn;
    }

    function renderDockSocials() {
      var contacts = typeof registry.getContacts === "function" ? registry.getContacts() : [];
      var socials = typeof registry.getSocialLinks === "function" ? registry.getSocialLinks() : [];
      lastVisibleCount = contacts.length;

      dock.innerHTML = "";
      var dockButtons = [];

      contacts.forEach(function (item) {
        var btn = createDockItemButton(item);
        dock.appendChild(btn);
        dockButtons.push(btn);
      });

      if (socials.length > 0) {
        var folderBtn = createDockFolderButton(
          "Social Media",
          socials,
          "Social Media (" + socials.length + ")"
        );
        dock.appendChild(folderBtn);
        dockButtons.push(folderBtn);
      }

      return dockButtons;
    }

    function renderDockApps() {
      var allApps = registry.getAll();
      var byId = {};
      allApps.forEach(function (app) { byId[app.id] = app; });
      var folders = typeof registry.getFolders === "function" ? registry.getFolders() : [];

      dock.innerHTML = "";
      var dockButtons = [];

      ["preset", "projects"].forEach(function (standaloneId) {
        var standaloneApp = byId[standaloneId];
        if (!standaloneApp) return;
        var standaloneBtn = createDockItemButton(standaloneApp);
        standaloneBtn.dataset.shortcutId = standaloneApp.id;
        dock.appendChild(standaloneBtn);
        dockButtons.push(standaloneBtn);
      });

      folders.forEach(function (folder) {
        var apps = folder.ids.map(function (id) { return byId[id]; }).filter(Boolean);
        if (apps.length === 0) return;

        var folderBtn = createDockFolderButton(folder.title, apps, folder.title);
        folderBtn.dataset.shortcutId = folder.id || folder.title;
        dock.appendChild(folderBtn);
        dockButtons.push(folderBtn);
      });

      return dockButtons;
    }

    function setAppsMode(nextIsApps) {
      var targetApps = Boolean(nextIsApps);
      if (targetApps === isAppsMode) return;
      isAppsMode = targetApps;

      var token = ++modeTransitionToken;
      stopDockAnimation();

      if (prefersReducedMotion()) {
        setDesktopDocked(isAppsMode);
        setDesktopClockCentered(isAppsMode);
        if (isAppsMode) {
          renderDockApps();
        } else {
          lastVisibleCount = -1;
          renderDockSocials();
        }
        return;
      }

      if (isAppsMode) {
        var desktopCards = collectDesktopCards();
        animateDockContract(function (startPillW) {
          if (token !== modeTransitionToken || !isAppsMode) return;
          setDesktopDocked(true);
          setDesktopClockCentered(true);
          var appButtons = renderDockApps();
          animateDockAppsArrive(appButtons, desktopCards, startPillW);
        });
      } else {
        setDesktopClockCentered(false);
        var desktopTargetCards = collectDesktopCards();
        animateDockAppsReturn(desktopTargetCards, function (startPillW) {
          if (token !== modeTransitionToken || isAppsMode) return;
          setDesktopDocked(false);
          lastVisibleCount = -1;
          var socialButtons = renderDockSocials();
          animateDockExpand(socialButtons, startPillW);
        });
      }
    }

    function render() {
      if (isAppsMode) {
        lastVisibleCount = -1;
        return;
      }

      var targetCount = typeof registry.getContacts === "function" ? registry.getContacts().length : 0;
      if (targetCount === lastVisibleCount) return;

      stopDockAnimation();
      var dockButtons = renderDockSocials();

      if (!hasAnimatedEntrance) {
        hasAnimatedEntrance = true;
        animateDockExpand(dockButtons, null);
      }
    }

    var resizeTicking = false;
    window.addEventListener("resize", function () {
      if (!resizeTicking) {
        resizeTicking = true;
        requestAnimationFrame(function () {
          render();
          if (isAppsMode) {
            setDesktopClockCentered(true);
          }
          resizeTicking = false;
        });
      }

      if (window.AppWindow && typeof window.AppWindow.sync === "function") {
        window.AppWindow.sync();
      }
    });

    render();
    window.DesktopDock.setAppsMode = setAppsMode;
    window.DesktopDock.openFolder = openFolderModal;
  }

  window.DesktopDock = {
    init: initHomeDock,
    openFolder: function (title, items, originEl) {
      if (window.FolderModal && typeof window.FolderModal.open === "function") {
        window.FolderModal.open(title, items, originEl);
      }
    },
    setAppsMode: function () { }
  };
})();
