(function () {
  "use strict";

  var windowsContainer = document.getElementById("windows-container");
  if (!windowsContainer) {
    windowsContainer = document.createElement("div");
    windowsContainer.id = "windows-container";
    windowsContainer.className = "windows-container";
    document.body.appendChild(windowsContainer);
  }

  var windowsStage = document.getElementById("windows-stage");
  if (!windowsStage) {
    windowsStage = document.createElement("div");
    windowsStage.id = "windows-stage";
    windowsStage.className = "windows-stage";
    windowsContainer.appendChild(windowsStage);
  }

  // Edge hover sensors for sliding between zones
  var sensorLeft = document.createElement("div");
  sensorLeft.className = "stage-edge-sensor sensor-left";
  sensorLeft.setAttribute("aria-hidden", "true");
  windowsContainer.appendChild(sensorLeft);

  var sensorRight = document.createElement("div");
  sensorRight.className = "stage-edge-sensor sensor-right";
  sensorRight.setAttribute("aria-hidden", "true");
  windowsContainer.appendChild(sensorRight);

  // Mobile edge arrow buttons for sliding between zones
  var navLeftBtn = document.createElement("button");
  navLeftBtn.type = "button";
  navLeftBtn.className = "stage-nav-btn nav-left";
  navLeftBtn.setAttribute("aria-label", "Geser ke kiri");
  navLeftBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_left</span>';
  windowsContainer.appendChild(navLeftBtn);

  var navRightBtn = document.createElement("button");
  navRightBtn.type = "button";
  navRightBtn.className = "stage-nav-btn nav-right";
  navRightBtn.setAttribute("aria-label", "Geser ke kanan");
  navRightBtn.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">chevron_right</span>';
  windowsContainer.appendChild(navRightBtn);

  function getZoneCapacity() {
    return window.innerWidth < 768 ? 2 : 4;
  }

  var openWindows = [];
  var topZIndex = 1;
  var currentZoneIndex = 0;
  var maxZoneIndex = 0;
  var stageShift = 0;
  var activeDragWin = null;
  var hasHistoryGuard = false;
  var ignoringNextPopstate = false;
  var closingFromPopstate = false;

  function getStageOffsetX() {
    return maxZoneIndex > 0 ? (currentZoneIndex * stageShift) : 0;
  }

  function getZoneWindows(zoneIdx, excludeWin) {
    return openWindows.filter(function (it) {
      return !it.isFullscreen && it !== excludeWin && (it.zone || 0) === zoneIdx;
    });
  }

  function ensureZoneHasRoom(zoneIdx, excludeWin) {
    var cap = getZoneCapacity();
    var cur = zoneIdx;
    while (true) {
      var list = getZoneWindows(cur, excludeWin);
      if (list.length < cap) break;
      var overflow = list[list.length - 1];
      overflow.zone = cur + 1;
      cur += 1;
    }
  }

  function normalizeZonesForCapacity() {
    var cap = getZoneCapacity();
    var nonFullscreen = openWindows.filter(function (it) { return !it.isFullscreen; });
    if (nonFullscreen.length === 0) {
      maxZoneIndex = 0;
      currentZoneIndex = 0;
      return;
    }

    var zoneMap = new Map();
    nonFullscreen.forEach(function (it) {
      var z = typeof it.zone === "number" ? Math.max(0, it.zone) : 0;
      it.zone = z;
      if (!zoneMap.has(z)) zoneMap.set(z, []);
      zoneMap.get(z).push(it);
    });

    var keys = Array.from(zoneMap.keys()).sort(function (a, b) { return a - b; });
    var changed = true;
    while (changed) {
      changed = false;
      keys = Array.from(zoneMap.keys()).sort(function (a, b) { return a - b; });
      for (var i = 0; i < keys.length; i++) {
        var z = keys[i];
        var arr = zoneMap.get(z);
        if (arr && arr.length > cap) {
          var extras = arr.splice(cap);
          if (!zoneMap.has(z + 1)) zoneMap.set(z + 1, []);
          var nextArr = zoneMap.get(z + 1);
          extras.forEach(function (item) {
            item.zone = z + 1;
            nextArr.push(item);
          });
          changed = true;
          break;
        }
      }
    }
  }

  function compactZones(followWin) {
    normalizeZonesForCapacity();
    var nonFullscreen = openWindows.filter(function (it) { return !it.isFullscreen; });
    if (nonFullscreen.length === 0) {
      maxZoneIndex = 0;
      currentZoneIndex = 0;
      return;
    }

    var occupiedSet = new Set();
    nonFullscreen.forEach(function (it) {
      occupiedSet.add(typeof it.zone === "number" ? Math.max(0, it.zone) : 0);
    });
    var occupied = Array.from(occupiedSet).sort(function (a, b) { return a - b; });

    var remap = new Map();
    occupied.forEach(function (oldZ, newZ) {
      remap.set(oldZ, newZ);
    });

    nonFullscreen.forEach(function (it) {
      it.zone = remap.get(it.zone || 0);
    });

    maxZoneIndex = Math.max(0, occupied.length - 1);

    if (followWin && !followWin.isFullscreen) {
      currentZoneIndex = followWin.zone || 0;
    } else if (remap.has(currentZoneIndex)) {
      currentZoneIndex = remap.get(currentZoneIndex);
    } else {
      // Find nearest remaining zone to previous currentZoneIndex
      var nearest = 0;
      for (var i = 0; i < occupied.length; i++) {
        if (occupied[i] <= currentZoneIndex) nearest = i;
      }
      currentZoneIndex = Math.max(0, Math.min(maxZoneIndex, nearest));
    }
  }

  function ensureHistoryGuard() {
    if (window.innerWidth >= 768) return;
    if (!hasHistoryGuard && window.history && window.history.pushState) {
      try {
        window.history.pushState({ cutefishWindow: true }, "");
        hasHistoryGuard = true;
      } catch (err) {}
    }
  }

  function bringToFront(winItem) {
    topZIndex += 1;
    winItem.el.style.zIndex = topZIndex;
    winItem.lastFocusedAt = Date.now();
  }

  function goToZone(zoneIdx) {
    zoneIdx = Math.max(0, Math.min(maxZoneIndex, zoneIdx));
    currentZoneIndex = zoneIdx;
    applyStageTransform(true);
    updateSensorClasses();
  }

  function applyStageTransform(animate) {
    if (!windowsStage) return;
    if (!animate) {
      windowsStage.style.transition = "none";
    } else {
      windowsStage.style.transition = "transform 420ms cubic-bezier(0.16, 1, 0.3, 1)";
    }
    var tx = -(currentZoneIndex * stageShift);
    windowsStage.style.transform = "translateX(" + tx + "px)";
  }

  function updateSensorClasses() {
    if (!windowsContainer) return;
    if (currentZoneIndex < maxZoneIndex) {
      windowsContainer.classList.add("has-right-zone");
      sensorRight.style.display = "block";
    } else {
      windowsContainer.classList.remove("has-right-zone");
      sensorRight.style.display = "none";
    }
    if (currentZoneIndex > 0) {
      windowsContainer.classList.add("has-left-zone");
      sensorLeft.style.display = "block";
    } else {
      windowsContainer.classList.remove("has-left-zone");
      sensorLeft.style.display = "none";
    }
  }

  sensorRight.addEventListener("mouseenter", function () {
    if (activeDragWin) return;
    if (currentZoneIndex < maxZoneIndex) {
      goToZone(currentZoneIndex + 1);
    }
  });

  sensorRight.addEventListener("click", function () {
    if (currentZoneIndex < maxZoneIndex) {
      goToZone(currentZoneIndex + 1);
    }
  });

  sensorLeft.addEventListener("mouseenter", function () {
    if (activeDragWin) return;
    if (currentZoneIndex > 0) {
      goToZone(currentZoneIndex - 1);
    }
  });

  sensorLeft.addEventListener("click", function () {
    if (currentZoneIndex > 0) {
      goToZone(currentZoneIndex - 1);
    }
  });

  navRightBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (currentZoneIndex < maxZoneIndex) {
      goToZone(currentZoneIndex + 1);
    }
  });

  navLeftBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (currentZoneIndex > 0) {
      goToZone(currentZoneIndex - 1);
    }
  });

  // Trackpad / wheel horizontal scroll
  window.addEventListener("wheel", function (e) {
    if (maxZoneIndex === 0) return;
    if (Math.abs(e.deltaX) > 20) {
      if (e.deltaX > 0 && currentZoneIndex < maxZoneIndex) {
        goToZone(currentZoneIndex + 1);
      } else if (e.deltaX < 0 && currentZoneIndex > 0) {
        goToZone(currentZoneIndex - 1);
      }
    }
  }, { passive: true });

  function syncDockState() {
    var dock = document.getElementById("dock");
    if (dock) {
      dock.classList.remove("is-hidden-mobile");
    }

    var activeIds = new Set(openWindows.map(function (it) { return it.id; }));
    var folderAppItems = document.querySelectorAll(".folder-app-item");
    folderAppItems.forEach(function (btn) {
      if (btn.dataset.appId && activeIds.has(btn.dataset.appId)) {
        btn.classList.add("is-running");
      } else {
        btn.classList.remove("is-running");
      }
    });

    if (window.DesktopDock && typeof window.DesktopDock.setAppsMode === "function") {
      window.DesktopDock.setAppsMode(openWindows.length > 0);
    }
  }

  function fitAspectWindow(maxW, maxH, ratio, topbarH) {
    var bodyMaxH = Math.max(180, maxH - topbarH);
    var bodyW = maxW;
    var bodyH = bodyW / ratio;
    if (bodyH > bodyMaxH) {
      bodyH = bodyMaxH;
      bodyW = bodyH * ratio;
    }
    bodyW = Math.max(240, Math.round(bodyW));
    bodyH = Math.max(160, Math.round(bodyH));
    return {
      width: bodyW,
      height: Math.round(bodyH + topbarH)
    };
  }

  function calculateLayout() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var isMobile = w < 768;

    var dockEl = document.getElementById("dock");
    var dockTop = (dockEl && dockEl.offsetHeight) ? dockEl.getBoundingClientRect().top : (h - 96);
    var availW = w;
    var availH = Math.max(200, dockTop);

    var nonFullscreen = openWindows.filter(function (it) { return !it.isFullscreen; });
    var count = nonFullscreen.length;

    var targets = new Map();

    openWindows.forEach(function (it) {
      if (it.isFullscreen) {
        var fsGap = isMobile ? 10 : 12;
        var fsLeft = fsGap;
        var fsTop = fsGap;
        var fsWidth = Math.max(240, w - fsGap * 2);
        var fsHeight = Math.max(200, dockTop - fsGap * 2);
        targets.set(it, { left: fsLeft, top: fsTop, width: fsWidth, height: fsHeight });
      }
    });

    if (count === 0) {
      maxZoneIndex = 0;
      stageShift = 0;
      currentZoneIndex = 0;
      return targets;
    }

    var zoneMap = new Map();
    var highestZone = 0;
    nonFullscreen.forEach(function (it) {
      var z = typeof it.zone === "number" ? Math.max(0, it.zone) : 0;
      it.zone = z;
      if (z > highestZone) highestZone = z;
      if (!zoneMap.has(z)) zoneMap.set(z, []);
      zoneMap.get(z).push(it);
    });
    maxZoneIndex = highestZone;
    if (currentZoneIndex > maxZoneIndex) {
      currentZoneIndex = maxZoneIndex;
    }

    if (isMobile) {
      var mGap = 10;
      var mMargin = 10;
      var mFullH = Math.round(availH - mMargin - 8);
      var mHalfH = Math.round((mFullH - mGap) / 2);

      if (maxZoneIndex === 0) {
        stageShift = 0;
        currentZoneIndex = 0;
        var mFullW = availW - mMargin * 2;
        var mWins0 = zoneMap.get(0) || [];
        var mSlowWin = mWins0.length === 2
          ? mWins0.find(function (it) { return it.id === "slowtime"; })
          : null;

        if (mWins0.length === 1) {
          targets.set(mWins0[0], { left: mMargin, top: mMargin, width: mFullW, height: mFullH, zone: 0 });
        } else if (mSlowWin) {
          var mTopWin = (Number(mWins0[0].el.style.zIndex || 0) >= Number(mWins0[1].el.style.zIndex || 0))
            ? mWins0[0]
            : mWins0[1];
          var mBackWin = mTopWin === mWins0[0] ? mWins0[1] : mWins0[0];
          targets.set(mBackWin, {
            left: mMargin,
            top: mMargin,
            width: mFullW,
            height: mFullH,
            zone: 0,
            mobilePeek: true
          });
          targets.set(mTopWin, {
            left: mMargin + 12,
            top: mMargin,
            width: Math.max(240, mFullW - 12),
            height: mFullH,
            zone: 0
          });
        } else if (mWins0.length >= 2) {
          targets.set(mWins0[0], { left: mMargin, top: mMargin, width: mFullW, height: mHalfH, zone: 0 });
          targets.set(mWins0[1], { left: mMargin, top: mMargin + mHalfH + mGap, width: mFullW, height: mHalfH, zone: 0 });
        }
      } else {
        // Mobile multi-zone horizontal chaining: max 2 vertically stacked windows per zone
        var mPeek = 24;
        stageShift = availW - 2 * mPeek - mGap;

        for (var mz = 0; mz <= maxZoneIndex; mz++) {
          var mZoneW = (mz === 0) ? (availW - mPeek - mGap - mMargin) : (availW - 2 * mPeek - 2 * mGap);
          var mZoneBaseX = (mz === 0) ? mMargin : ((availW - mPeek) + (mz - 1) * stageShift);
          var mZoneWins = zoneMap.get(mz) || [];

          if (mZoneWins.length === 1) {
            targets.set(mZoneWins[0], { left: mZoneBaseX, top: mMargin, width: mZoneW, height: mFullH, zone: mz });
          } else if (mZoneWins.length >= 2) {
            targets.set(mZoneWins[0], { left: mZoneBaseX, top: mMargin, width: mZoneW, height: mHalfH, zone: mz });
            targets.set(mZoneWins[1], { left: mZoneBaseX, top: mMargin + mHalfH + mGap, width: mZoneW, height: mHalfH, zone: mz });
          }
        }
      }
    } else {
      var gap = 16;
      var margin = 16;

      if (maxZoneIndex === 0) {
        stageShift = 0;
        currentZoneIndex = 0;
        var wins0 = zoneMap.get(0) || [];
        var c0 = wins0.length;

        if (c0 === 1) {
          var it0 = wins0[0];
          if (it0.customBounds) {
            targets.set(it0, it0.customBounds);
          } else if (it0.aspectRatio > 0) {
            var aMaxW = Math.min(availW - margin * 4, Math.round(availW * 0.78));
            var aMaxH = Math.max(240, availH - margin * 2 - 8);
            var topH1 = it0.id === "slowtime" ? 0 : 48;
            var fitted1 = fitAspectWindow(aMaxW, aMaxH, it0.aspectRatio, topH1);
            var left1 = Math.round((availW - fitted1.width) / 2);
            var top1 = Math.round(Math.max(margin, (availH - fitted1.height) / 2));
            targets.set(it0, { left: left1, top: top1, width: fitted1.width, height: fitted1.height, zone: 0 });
          } else {
            var width = Math.min(440, availW - 48);
            var height = Math.min(680, availH - 32);
            var left = Math.round((availW - width) / 2);
            var top = Math.round(Math.max(16, (availH - height) / 2));
            targets.set(it0, { left: left, top: top, width: width, height: height, zone: 0 });
          }
        } else if (c0 === 2) {
          var wA = wins0[0];
          var wB = wins0[1];
          var totalW2 = availW - margin * 2 - gap;
          var fullH2 = Math.round(availH - margin - 8);
          var hasAspectA = wA.aspectRatio > 0;
          var hasAspectB = wB.aspectRatio > 0;

          if (hasAspectA && !hasAspectB) {
            var maxAspectW = Math.max(260, totalW2 - Math.max(360, Math.round(totalW2 * 0.36)));
            var fitA = fitAspectWindow(maxAspectW, fullH2, wA.aspectRatio, wA.id === "slowtime" ? 0 : 48);
            var flexW = Math.max(260, totalW2 - fitA.width);
            var topA = Math.round(margin + Math.max(0, (fullH2 - fitA.height) / 2));
            targets.set(wA, { left: margin, top: topA, width: fitA.width, height: fitA.height, zone: 0 });
            targets.set(wB, { left: margin + fitA.width + gap, top: margin, width: flexW, height: fullH2, zone: 0 });
          } else if (!hasAspectA && hasAspectB) {
            var maxAspectWB = Math.max(260, totalW2 - Math.max(360, Math.round(totalW2 * 0.36)));
            var fitB = fitAspectWindow(maxAspectWB, fullH2, wB.aspectRatio, wB.id === "slowtime" ? 0 : 48);
            var flexWA = Math.max(260, totalW2 - fitB.width);
            var topB = Math.round(margin + Math.max(0, (fullH2 - fitB.height) / 2));
            targets.set(wA, { left: margin, top: margin, width: flexWA, height: fullH2, zone: 0 });
            targets.set(wB, { left: margin + flexWA + gap, top: topB, width: fitB.width, height: fitB.height, zone: 0 });
          } else if (hasAspectA && hasAspectB) {
            var halfMax = Math.round(totalW2 / 2);
            var fitBothA = fitAspectWindow(halfMax, fullH2, wA.aspectRatio, wA.id === "slowtime" ? 0 : 48);
            var fitBothB = fitAspectWindow(halfMax, fullH2, wB.aspectRatio, wB.id === "slowtime" ? 0 : 48);
            var groupW = fitBothA.width + gap + fitBothB.width;
            var startX = Math.round((availW - groupW) / 2);
            targets.set(wA, {
              left: startX,
              top: Math.round(margin + Math.max(0, (fullH2 - fitBothA.height) / 2)),
              width: fitBothA.width,
              height: fitBothA.height,
              zone: 0
            });
            targets.set(wB, {
              left: startX + fitBothA.width + gap,
              top: Math.round(margin + Math.max(0, (fullH2 - fitBothB.height) / 2)),
              width: fitBothB.width,
              height: fitBothB.height,
              zone: 0
            });
          } else {
            var width = Math.round(totalW2 / 2);
            targets.set(wA, { left: margin, top: margin, width: width, height: fullH2, zone: 0 });
            targets.set(wB, { left: margin + width + gap, top: margin, width: width, height: fullH2, zone: 0 });
          }
        } else if (c0 === 3) {
          var halfW = Math.round((availW - margin * 2 - gap) / 2);
          var halfH = Math.round((availH - margin - 8 - gap) / 2);
          var top0 = margin;
          var top1 = margin + halfH + gap;

          targets.set(wins0[0], { left: margin, top: top0, width: halfW, height: halfH, zone: 0 });
          targets.set(wins0[1], { left: margin + halfW + gap, top: top0, width: halfW, height: halfH, zone: 0 });
          var bottomW = availW - margin * 2;
          targets.set(wins0[2], { left: margin, top: top1, width: bottomW, height: halfH, zone: 0 });
        } else if (c0 >= 4) {
          var halfW = Math.round((availW - margin * 2 - gap) / 2);
          var halfH = Math.round((availH - margin - 8 - gap) / 2);
          var top0 = margin;
          var top1 = margin + halfH + gap;

          targets.set(wins0[0], { left: margin, top: top0, width: halfW, height: halfH, zone: 0 });
          targets.set(wins0[1], { left: margin + halfW + gap, top: top0, width: halfW, height: halfH, zone: 0 });
          targets.set(wins0[2], { left: margin, top: top1, width: halfW, height: halfH, zone: 0 });
          targets.set(wins0[3], { left: margin + halfW + gap, top: top1, width: halfW, height: halfH, zone: 0 });
        }
      } else {
        // Multi-zone horizontal layout: infinite zones chained to the right
        var peek = 54;
        stageShift = availW - 2 * peek - gap;

        var halfH = Math.round((availH - margin - 8 - gap) / 2);
        var top0 = margin;
        var top1 = margin + halfH + gap;

        for (var z = 0; z <= maxZoneIndex; z++) {
          var zoneW = (z === 0) ? (availW - peek - gap - margin) : (availW - 2 * peek - 2 * gap);
          var zoneBaseX = (z === 0) ? margin : ((availW - peek) + (z - 1) * stageShift);
          var zoneWindows = zoneMap.get(z) || [];
          var zCount = zoneWindows.length;
          var halfW = Math.round((zoneW - gap) / 2);

          if (zCount === 1) {
            targets.set(zoneWindows[0], { left: zoneBaseX, top: top0, width: zoneW, height: Math.round(availH - margin - 8), zone: z });
          } else if (zCount === 2) {
            var hFull = Math.round(availH - margin - 8);
            targets.set(zoneWindows[0], { left: zoneBaseX, top: top0, width: halfW, height: hFull, zone: z });
            targets.set(zoneWindows[1], { left: zoneBaseX + halfW + gap, top: top0, width: halfW, height: hFull, zone: z });
          } else if (zCount === 3) {
            targets.set(zoneWindows[0], { left: zoneBaseX, top: top0, width: halfW, height: halfH, zone: z });
            targets.set(zoneWindows[1], { left: zoneBaseX + halfW + gap, top: top0, width: halfW, height: halfH, zone: z });
            targets.set(zoneWindows[2], { left: zoneBaseX, top: top1, width: zoneW, height: halfH, zone: z });
          } else if (zCount >= 4) {
            targets.set(zoneWindows[0], { left: zoneBaseX, top: top0, width: halfW, height: halfH, zone: z });
            targets.set(zoneWindows[1], { left: zoneBaseX + halfW + gap, top: top0, width: halfW, height: halfH, zone: z });
            targets.set(zoneWindows[2], { left: zoneBaseX, top: top1, width: halfW, height: halfH, zone: z });
            targets.set(zoneWindows[3], { left: zoneBaseX + halfW + gap, top: top1, width: halfW, height: halfH, zone: z });
          }
        }
      }
    }

    return targets;
  }

  function updateWindowsLayout(animate, skipWinItem) {
    var targets = calculateLayout();
    targets.forEach(function (bounds, winItem) {
      if (winItem === skipWinItem) return;
      var el = winItem.el;
      if (!animate) {
        el.style.transition = "none";
      } else {
        el.style.transition = "";
      }

      if (winItem.isFullscreen) {
        el.classList.add("is-fullscreen");
      } else {
        el.classList.remove("is-fullscreen");
      }

      if (bounds.mobilePeek) {
        el.classList.add("is-mobile-peek");
      } else {
        el.classList.remove("is-mobile-peek");
      }

      el.style.left = bounds.left + "px";
      el.style.top = bounds.top + "px";
      el.style.width = bounds.width + "px";
      el.style.height = bounds.height + "px";
    });

    updateSensorClasses();
    applyStageTransform(animate);
  }

  function createWindowElement(app) {
    var el = document.createElement("div");
    el.className = "app-window";
    el.dataset.appId = app.id;
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", app.title);

    var iconHtml = (window.AppRegistry && typeof window.AppRegistry.getIconHtml === "function")
      ? window.AppRegistry.getIconHtml(app.icon)
      : "";

    var splashHtml =
      '<div class="window-splash" aria-hidden="true">' +
        '<div class="window-splash-icon">' + iconHtml + '</div>' +
      '</div>';

    // Create window with splash first; append iframe with src already set after launch frames stabilize
    el.innerHTML =
      '<div class="window-topbar window-drag-area">' +
        '<button type="button" class="window-ctl-btn btn-fullscreen" aria-label="Toggle Fullscreen">' +
          '<span class="material-symbols-rounded" aria-hidden="true">fullscreen</span>' +
        '</button>' +
        '<div class="window-title-pill">' +
          '<span class="pill-app-title">' + app.title + '</span>' +
        '</div>' +
        '<button type="button" class="window-ctl-btn window-ctl-close btn-close" aria-label="Close App">' +
          '<span class="material-symbols-rounded" aria-hidden="true">close</span>' +
        '</button>' +
      '</div>' +
      '<div class="app-window-body">' + splashHtml + '</div>' +
      '<div class="window-resize-handle handle-e" data-handle="e"></div>' +
      '<div class="window-resize-handle handle-s" data-handle="s"></div>' +
      '<div class="window-resize-handle handle-w" data-handle="w"></div>' +
      '<div class="window-resize-handle handle-se" data-handle="se">' +
        '<svg class="resize-corner-arc" viewBox="0 0 36 36" aria-hidden="true">' +
          '<path d="M 6 30 A 24 24 0 0 0 30 6" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none" />' +
        '</svg>' +
      '</div>' +
      '<div class="window-resize-handle handle-sw" data-handle="sw">' +
        '<svg class="resize-corner-arc" viewBox="0 0 36 36" aria-hidden="true">' +
          '<path d="M 30 30 A 24 24 0 0 1 6 6" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none" />' +
        '</svg>' +
      '</div>';

    var bodyEl = el.querySelector(".app-window-body");
    var splashEl = el.querySelector(".window-splash");
    if (app.entry && bodyEl) {
      var revealed = false;
      var openedAt = performance.now();
      var frameEl = null;

      var revealFrame = function () {
        if (revealed) return;
        revealed = true;
        var waitMs = Math.max(0, 180 - (performance.now() - openedAt));
        setTimeout(function () {
          requestAnimationFrame(function () {
            if (frameEl) frameEl.classList.add("is-revealed");
            if (splashEl) {
              splashEl.classList.add("is-leaving");
              setTimeout(function () {
                if (splashEl.parentNode) splashEl.remove();
              }, 280);
            }
          });
        }, waitMs);
      };

      setTimeout(function () {
        if (!el.isConnected) return;
        frameEl = document.createElement("iframe");
        frameEl.className = "app-window-frame";
        frameEl.title = app.title;
        var entryUrl = app.entry;
        try {
          var hostLang = new URLSearchParams(window.location.search).get("lang");
          if (hostLang === "id" || hostLang === "en") {
            entryUrl += (entryUrl.indexOf("?") === -1 ? "?" : "&") + "lang=" + hostLang;
          }
        } catch (_) {}
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          entryUrl += (entryUrl.indexOf("?") === -1 ? "?" : "&") + "_t=" + Date.now();
        }
        frameEl.src = entryUrl;
        frameEl.addEventListener("load", revealFrame, { once: true });
        bodyEl.appendChild(frameEl);
      }, 110);

      setTimeout(revealFrame, 2500);
    }

    return el;
  }

  function openApp(app, originBtn) {
    var existing = openWindows.find(function (it) { return it.id === app.id; });
    if (existing) {
      bringToFront(existing);
      if (!existing.isFullscreen) {
        goToZone(existing.zone || 0);
      }
      if (window.innerWidth < 768 && openWindows.length === 2 && openWindows.some(function (it) { return it.id === "slowtime"; })) {
        updateWindowsLayout(true);
      }
      return;
    }

    var originRect = { left: window.innerWidth / 2 - 28, top: window.innerHeight - 70, width: 56, height: 56 };
    if (originBtn) {
      originRect = originBtn.getBoundingClientRect();
    }

    var winEl = createWindowElement(app);
    windowsStage.appendChild(winEl);

    var targetZone = Math.max(0, currentZoneIndex);
    var cap = getZoneCapacity();
    while (getZoneWindows(targetZone, null).length >= cap) {
      targetZone += 1;
    }

    var winItem = {
      id: app.id,
      app: app,
      el: winEl,
      zone: targetZone,
      isFullscreen: false,
      customBounds: null,
      aspectRatio: app.id === "slowtime" ? 1.5 : null,
      lastFocusedAt: Date.now()
    };

    openWindows.push(winItem);
    ensureHistoryGuard();
    bringToFront(winItem);

    if (openWindows.length === 1) {
      currentZoneIndex = 0;
    }

    syncDockState();

    var targets = calculateLayout();
    var targetRect = targets.get(winItem) || {
      left: Math.round((window.innerWidth - 800) / 2),
      top: 40,
      width: 800,
      height: 560
    };

    updateWindowsLayout(true);

    winEl.style.transition = "none";
    winEl.style.left = targetRect.left + "px";
    winEl.style.top = targetRect.top + "px";
    winEl.style.width = targetRect.width + "px";
    winEl.style.height = targetRect.height + "px";
    winEl.style.transformOrigin = "0 0";

    var deltaX = originRect.left - targetRect.left;
    var deltaY = originRect.top - targetRect.top;
    var scaleX = Math.max(0.04, originRect.width / Math.max(1, targetRect.width));
    var scaleY = Math.max(0.04, originRect.height / Math.max(1, targetRect.height));

    var openAnim = winEl.animate([
      {
        opacity: 0.2,
        transform: "translate(" + deltaX + "px, " + deltaY + "px) scale(" + scaleX + ", " + scaleY + ")"
      },
      {
        opacity: 1,
        transform: "translate(0px, 0px) scale(1, 1)"
      }
    ], {
      duration: 280,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)"
    });

    openAnim.onfinish = function () {
      winEl.style.transition = "";
      winEl.style.transform = "";
    };

    setupWindowEvents(winItem);
  }

  function closeWindow(winItem) {
    if (!winItem || !winItem.el || winItem.isClosing) return;
    winItem.isClosing = true;

    var remaining = openWindows.filter(function (it) { return it !== winItem; });
    var activeRemaining = remaining.filter(function (it) { return !it.isClosing; });
    if (activeRemaining.length === 0 && hasHistoryGuard && !closingFromPopstate) {
      hasHistoryGuard = false;
      ignoringNextPopstate = true;
      try {
        window.history.back();
      } catch (err) {
        ignoringNextPopstate = false;
      }
    }

    winItem.el.style.transition = "none";
    winItem.el.style.transformOrigin = "50% 50%";

    var closeAnim = winItem.el.animate([
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.85)" }
    ], {
      duration: 220,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)"
    });

    closeAnim.onfinish = function () {
      // Remove window from DOM before releasing iframe so it never pushes an about:blank history entry
      winItem.el.remove();
      var idx = openWindows.indexOf(winItem);
      if (idx !== -1) {
        openWindows.splice(idx, 1);
      }
      compactZones();
      syncDockState();
      updateWindowsLayout(true);
    };
  }

  function setupWindowEvents(winItem) {
    var winEl = winItem.el;

    winEl.addEventListener("pointerdown", function () {
      if (!winItem.isFullscreen) {
        var targetZone = winItem.zone || 0;
        if (targetZone !== currentZoneIndex) {
          goToZone(targetZone);
        }
      }
      bringToFront(winItem);
      if (window.innerWidth < 768 && openWindows.length === 2 && openWindows.some(function (it) { return it.id === "slowtime"; })) {
        updateWindowsLayout(true);
      }
    });

    winEl.addEventListener("mouseenter", function () {
      if (window.innerWidth < 768 || activeDragWin) return;
      if (!winItem.isFullscreen) {
        var targetZone = winItem.zone || 0;
        if (targetZone !== currentZoneIndex) {
          goToZone(targetZone);
        }
      }
    });

    var btnFullscreen = winEl.querySelector(".btn-fullscreen");
    var iconFullscreen = btnFullscreen ? btnFullscreen.querySelector(".material-symbols-rounded") : null;
    var btnClose = winEl.querySelector(".btn-close");

    if (btnFullscreen) {
      btnFullscreen.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        winItem.isFullscreen = !winItem.isFullscreen;
        if (iconFullscreen) {
          iconFullscreen.textContent = winItem.isFullscreen ? "close_fullscreen" : "fullscreen";
        }
        updateWindowsLayout(true);
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeWindow(winItem);
      });
    }

    var topbarEl = winEl.querySelector(".window-topbar");
    if (topbarEl && winItem.id === "slowtime") {
      topbarEl.addEventListener("pointerenter", function () {
        winEl.classList.remove("is-player-idle");
      });
      topbarEl.addEventListener("pointermove", function () {
        winEl.classList.remove("is-player-idle");
      });
    }

    var dragArea = winEl.querySelector(".window-drag-area");
    if (dragArea) {
      var isDragging = false;
      var dragOffsetX = 0;
      var dragOffsetY = 0;
      var lastClientX = 0;
      var edgeShiftTimer = null;
      var edgeShiftDir = 0;
      var EDGE_THRESHOLD = 52;
      var EDGE_DWELL_MS = 380;

      function clearEdgeShift() {
        if (edgeShiftTimer) {
          clearTimeout(edgeShiftTimer);
          edgeShiftTimer = null;
        }
        edgeShiftDir = 0;
      }

      function performEdgeShift(dir) {
        if (!isDragging) return;
        var curZone = winItem.zone || 0;
        var nextZone = curZone + dir;
        if (nextZone < 0) return;

        // Allow creating a new desktop on the right only if the current desktop still has other windows,
        // or moving into an already existing desktop.
        if (dir > 0 && nextZone > maxZoneIndex && getZoneWindows(curZone, winItem).length === 0) {
          return;
        }

        ensureZoneHasRoom(nextZone, winItem);
        winItem.zone = nextZone;
        currentZoneIndex = nextZone;
        updateWindowsLayout(true, winItem);

        // Keep dragged window glued to pointer in the new stage coordinate
        var vpX = Math.max(10, Math.min(window.innerWidth - 80, lastClientX - dragOffsetX));
        winEl.style.left = (vpX + getStageOffsetX()) + "px";
      }

      dragArea.addEventListener("pointerdown", function (e) {
        if (winItem.isFullscreen || window.innerWidth < 768) return;
        if (e.target.closest(".window-ctl-btn")) return;

        if ((winItem.zone || 0) !== currentZoneIndex) {
          goToZone(winItem.zone || 0);
        }

        var stageOffsetX = getStageOffsetX();
        var visualLeft = winEl.offsetLeft - stageOffsetX;
        var visualTop = winEl.offsetTop;
        isDragging = true;
        activeDragWin = winItem;
        lastClientX = e.clientX;
        dragOffsetX = e.clientX - visualLeft;
        dragOffsetY = e.clientY - visualTop;

        winEl.classList.add("is-dragging");
        dragArea.setPointerCapture(e.pointerId);
      });

      dragArea.addEventListener("pointermove", function (e) {
        if (!isDragging) return;
        lastClientX = e.clientX;
        var vpX = Math.max(10, Math.min(window.innerWidth - 80, e.clientX - dragOffsetX));
        var newX = vpX + getStageOffsetX();
        var newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffsetY));
        winEl.style.left = newX + "px";
        winEl.style.top = newY + "px";
        winItem.customBounds = {
          left: newX,
          top: newY,
          width: winEl.offsetWidth,
          height: winEl.offsetHeight
        };

        var desiredDir = 0;
        if (e.clientX >= window.innerWidth - EDGE_THRESHOLD) {
          desiredDir = 1;
        } else if (e.clientX <= EDGE_THRESHOLD && (winItem.zone || 0) > 0) {
          desiredDir = -1;
        }

        if (desiredDir === 0) {
          clearEdgeShift();
        } else if (desiredDir !== edgeShiftDir) {
          clearEdgeShift();
          edgeShiftDir = desiredDir;
          edgeShiftTimer = setTimeout(function () {
            var dirToRun = edgeShiftDir;
            edgeShiftTimer = null;
            edgeShiftDir = 0;
            performEdgeShift(dirToRun);
          }, EDGE_DWELL_MS);
        }
      });

      function endDrag(e) {
        if (isDragging) {
          isDragging = false;
          activeDragWin = null;
          clearEdgeShift();
          winEl.classList.remove("is-dragging");
          try { dragArea.releasePointerCapture(e.pointerId); } catch (err) {}

          var nonFullscreen = openWindows.filter(function (it) { return !it.isFullscreen; });
          compactZones(winItem);
          if (nonFullscreen.length > 1 || maxZoneIndex > 0) {
            winItem.customBounds = null;
          }
          updateWindowsLayout(true);
        }
      }

      dragArea.addEventListener("pointerup", endDrag);
      dragArea.addEventListener("pointercancel", endDrag);
    }

    var isResizing = false;
    var resizeHandleType = "";
    var resizeStartX = 0;
    var resizeStartY = 0;
    var resizeStartW = 0;
    var resizeStartH = 0;
    var resizeStartLeft = 0;
    var resizeStartTop = 0;
    var resizeStartViewportLeft = 0;
    var minW = winItem.aspectRatio ? 240 : 340;
    var minH = winItem.aspectRatio ? 200 : 260;

    function onResizeDown(e) {
      if (winItem.isFullscreen || window.innerWidth < 768) return;
      var handle = e.target.closest(".window-resize-handle");
      if (!handle) return;

      var rect = winEl.getBoundingClientRect();
      isResizing = true;
      resizeHandleType = handle.dataset.handle;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = rect.width;
      resizeStartH = rect.height;
      resizeStartLeft = winEl.offsetLeft;
      resizeStartTop = winEl.offsetTop;
      resizeStartViewportLeft = rect.left;

      winEl.classList.add("is-resizing");
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }

    function onResizeMove(e) {
      if (!isResizing) return;
      var dx = e.clientX - resizeStartX;
      var dy = e.clientY - resizeStartY;

      if (resizeHandleType.indexOf("e") !== -1) {
        var newW = Math.max(minW, Math.min(window.innerWidth - resizeStartViewportLeft - 10, resizeStartW + dx));
        winEl.style.width = newW + "px";
      }
      if (resizeHandleType.indexOf("s") !== -1) {
        var newH = Math.max(minH, Math.min(window.innerHeight - resizeStartTop - 10, resizeStartH + dy));
        winEl.style.height = newH + "px";
      }
      if (resizeHandleType.indexOf("w") !== -1) {
        var potW = resizeStartW - dx;
        if (potW >= minW) {
          winEl.style.width = potW + "px";
          winEl.style.left = (resizeStartLeft + dx) + "px";
        }
      }

      winItem.customBounds = {
        left: winEl.offsetLeft,
        top: winEl.offsetTop,
        width: winEl.offsetWidth,
        height: winEl.offsetHeight
      };
    }

    function onResizeUp(e) {
      if (isResizing) {
        isResizing = false;
        winEl.classList.remove("is-resizing");
        try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }

    var handles = winEl.querySelectorAll(".window-resize-handle");
    handles.forEach(function (h) {
      h.addEventListener("pointerdown", onResizeDown);
      h.addEventListener("pointermove", onResizeMove);
      h.addEventListener("pointerup", onResizeUp);
      h.addEventListener("pointercancel", onResizeUp);
    });
  }

  window.addEventListener("resize", function () {
    compactZones();
    syncDockState();
    updateWindowsLayout(true);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openWindows.length > 0) {
      var topWin = openWindows[openWindows.length - 1];
      closeWindow(topWin);
    }
  });

  window.addEventListener("popstate", function () {
    if (ignoringNextPopstate) {
      ignoringNextPopstate = false;
      return;
    }
    var activeWins = openWindows.filter(function (it) { return !it.isClosing; });
    if (activeWins.length > 0) {
      hasHistoryGuard = false;
      closingFromPopstate = true;
      closeWindow(activeWins[activeWins.length - 1]);
      closingFromPopstate = false;
      if (activeWins.length > 1) {
        ensureHistoryGuard();
      }
    }
  });

  window.addEventListener("message", function (e) {
    var data = e && e.data;
    if (!data || !data.type) return;
    var matchWin = openWindows.find(function (it) {
      var frame = it.el && it.el.querySelector(".app-window-frame");
      return frame && frame.contentWindow === e.source;
    });
    if (!matchWin) return;

    if (data.type === "cutefish:window-aspect") {
      var ratio = Number(data.ratio);
      if (!isFinite(ratio) || ratio < 0.2 || ratio > 5) return;
      if (Math.abs((matchWin.aspectRatio || 0) - ratio) < 0.005) return;
      matchWin.aspectRatio = ratio;
      matchWin.customBounds = null;
      updateWindowsLayout(true);
    } else if (data.type === "cutefish:player-idle") {
      matchWin.el.classList.toggle("is-player-idle", Boolean(data.idle));
    }
  });

  window.AppWindow = {
    open: openApp,
    close: function () {
      if (openWindows.length > 0) {
        closeWindow(openWindows[openWindows.length - 1]);
      }
    },
    sync: syncDockState
  };
})();
