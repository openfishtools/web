(function () {
  "use strict";

  var STORAGE_KEY = "cutefish_tutorial_seen_v1";
  var replayBtn = document.getElementById("tutorial-replay-btn");
  var rootEl = null;
  var spotlightEl = null;
  var cardEl = null;
  var countEl = null;
  var titleEl = null;
  var descEl = null;
  var skipBtn = null;
  var prevBtn = null;
  var nextBtn = null;

  var isActive = false;
  var currentStepIndex = 0;
  var activeSteps = [];
  var positionTimer = null;
  var openedFolderForStep = false;

  function t(text) {
    if (window.AppI18n && typeof window.AppI18n.translateText === "function") {
      return window.AppI18n.translateText(text);
    }
    return text;
  }

  function hasSeenTutorial() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function markTutorialSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch (_) { }
  }

  function ensureOverlayDom() {
    if (rootEl) return;

    rootEl = document.createElement("div");
    rootEl.className = "tutorial-root";
    rootEl.id = "tutorial-root";
    rootEl.hidden = true;
    rootEl.setAttribute("role", "dialog");
    rootEl.setAttribute("aria-modal", "true");
    rootEl.setAttribute("aria-label", t("Panduan Desktop"));

    var backdrop = document.createElement("div");
    backdrop.className = "tutorial-backdrop";

    spotlightEl = document.createElement("div");
    spotlightEl.className = "tutorial-spotlight";

    cardEl = document.createElement("div");
    cardEl.className = "tutorial-card";

    countEl = document.createElement("div");
    countEl.className = "tutorial-step-count";

    titleEl = document.createElement("h3");
    titleEl.className = "tutorial-title";

    descEl = document.createElement("p");
    descEl.className = "tutorial-desc";

    var actions = document.createElement("div");
    actions.className = "tutorial-actions";

    skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "tutorial-btn tutorial-btn-ghost";
    skipBtn.textContent = t("Lewati");

    var navGroup = document.createElement("div");
    navGroup.className = "tutorial-nav-group";

    prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "tutorial-btn tutorial-btn-tonal";
    prevBtn.textContent = t("Kembali");

    nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "tutorial-btn tutorial-btn-primary";
    nextBtn.textContent = t("Lanjut");

    navGroup.appendChild(prevBtn);
    navGroup.appendChild(nextBtn);
    actions.appendChild(skipBtn);
    actions.appendChild(navGroup);

    cardEl.appendChild(countEl);
    cardEl.appendChild(titleEl);
    cardEl.appendChild(descEl);
    cardEl.appendChild(actions);

    rootEl.appendChild(backdrop);
    rootEl.appendChild(spotlightEl);
    rootEl.appendChild(cardEl);
    document.body.appendChild(rootEl);

    skipBtn.addEventListener("click", endTutorial);
    prevBtn.addEventListener("click", function () {
      goToStep(currentStepIndex - 1);
    });
    nextBtn.addEventListener("click", function () {
      if (currentStepIndex >= activeSteps.length - 1) {
        endTutorial();
      } else {
        goToStep(currentStepIndex + 1);
      }
    });
  }

  function closeFolderIfNeeded() {
    var folderModal = document.getElementById("folder-modal");
    if (openedFolderForStep && folderModal && !folderModal.hidden) {
      if (window.FolderModal && typeof window.FolderModal.close === "function") {
        window.FolderModal.close();
      }
    }
    openedFolderForStep = false;
  }

  function buildSteps() {
    var steps = [
      {
        id: "clock",
        title: "Jam Indonesia",
        desc: "Menampilkan waktu saat ini. Klik bagian tanggal di bawah jam untuk mengganti zona waktu antara WIB, WITA, atau WIT.",
        radius: 18,
        padding: 10,
        getTarget: function () {
          return document.getElementById("clock-widget");
        }
      },
      {
        id: "preset",
        title: "Galeri Preset",
        desc: "Klik ikon ini untuk membuka kumpulan preset editing After Effects dan Alight Motion.",
        radius: 22,
        padding: 8,
        getTarget: function () {
          return document.querySelector('[data-shortcut-id="preset"]');
        }
      },
      {
        id: "folder-closed",
        title: "Folder Aplikasi",
        desc: "Aplikasi lainnya dikelompokkan ke dalam folder di desktop agar layar tetap rapi.",
        radius: 24,
        padding: 8,
        getTarget: function () {
          return document.querySelector(".big-folder-card[data-folder-id]");
        }
      },
      {
        id: "folder-open",
        title: "Isi Folder",
        desc: "Saat folder dibuka, semua aplikasi di dalamnya tampil di sini. Pilih salah satu untuk langsung menjalankannya.",
        radius: 26,
        padding: 8,
        delay: 380,
        onEnter: function () {
          var folderModal = document.getElementById("folder-modal");
          if (folderModal && folderModal.hidden) {
            var firstFolder = document.querySelector(".big-folder-card[data-folder-id]");
            if (firstFolder) {
              firstFolder.click();
              openedFolderForStep = true;
            }
          }
        },
        onLeave: closeFolderIfNeeded,
        getTarget: function () {
          return document.getElementById("folder-modal-surface");
        }
      },
      {
        id: "dock",
        title: "Apps Dock",
        desc: "Gunakan dock di bagian bawah untuk membuka aplikasi dengan cepat atau berpindah antar jendela yang sedang aktif.",
        radius: 26,
        padding: 8,
        getTarget: function () {
          return document.getElementById("dock");
        }
      },
      {
        id: "replay",
        title: "Putar Ulang Panduan",
        desc: "Jika ingin melihat panduan ini lagi kapan saja, cukup klik ikon tanda tanya di pojok kanan atas.",
        radius: 999,
        padding: 6,
        getTarget: function () {
          return document.getElementById("tutorial-replay-btn");
        }
      }
    ];

    return steps.filter(function (step) {
      if (step.id === "folder-open") {
        return Boolean(document.querySelector(".big-folder-card[data-folder-id]"));
      }
      return Boolean(step.getTarget());
    });
  }

  function positionStep(step) {
    if (!isActive || !step) return;
    var target = step.getTarget();
    if (!target) return;

    var rect = target.getBoundingClientRect();
    var pad = step.padding || 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var spotLeft = Math.max(6, rect.left - pad);
    var spotTop = Math.max(6, rect.top - pad);
    var spotWidth = Math.min(vw - 12, rect.width + pad * 2);
    var spotHeight = Math.min(vh - 12, rect.height + pad * 2);

    spotlightEl.style.left = spotLeft + "px";
    spotlightEl.style.top = spotTop + "px";
    spotlightEl.style.width = spotWidth + "px";
    spotlightEl.style.height = spotHeight + "px";
    spotlightEl.style.borderRadius = (step.radius || 20) + "px";

    var cardRect = cardEl.getBoundingClientRect();
    var cardW = cardRect.width || Math.min(340, vw - 24);
    var cardH = cardRect.height || 180;
    var gap = 14;

    var spaceBelow = vh - (spotTop + spotHeight);
    var spaceAbove = spotTop;

    var top;
    if (spaceBelow >= cardH + gap + 12) {
      top = spotTop + spotHeight + gap;
    } else if (spaceAbove >= cardH + gap + 12) {
      top = spotTop - cardH - gap;
    } else {
      top = Math.max(12, Math.min(vh - cardH - 12, (vh - cardH) / 2));
    }

    var idealLeft = spotLeft + spotWidth / 2 - cardW / 2;
    var left = Math.max(12, Math.min(vw - cardW - 12, idealLeft));

    cardEl.style.top = Math.round(top) + "px";
    cardEl.style.left = Math.round(left) + "px";
  }

  function goToStep(index) {
    if (!isActive || index < 0 || index >= activeSteps.length) return;

    var prevStep = activeSteps[currentStepIndex];
    if (prevStep && typeof prevStep.onLeave === "function" && currentStepIndex !== index) {
      prevStep.onLeave();
    }

    currentStepIndex = index;
    var step = activeSteps[currentStepIndex];

    if (typeof step.onEnter === "function") {
      step.onEnter();
    }

    countEl.textContent = (currentStepIndex + 1) + " / " + activeSteps.length;
    titleEl.textContent = t(step.title);
    descEl.textContent = t(step.desc);
    prevBtn.hidden = currentStepIndex === 0;
    nextBtn.textContent = currentStepIndex === activeSteps.length - 1 ? t("Selesai") : t("Lanjut");

    if (positionTimer) {
      window.clearTimeout(positionTimer);
      positionTimer = null;
    }

    var delay = step.delay || 30;
    positionTimer = window.setTimeout(function () {
      positionStep(step);
    }, delay);
  }

  function startTutorial() {
    ensureOverlayDom();
    activeSteps = buildSteps();
    if (!activeSteps.length) return;

    isActive = true;
    rootEl.hidden = false;
    goToStep(0);
  }

  function endTutorial() {
    if (!isActive) return;
    isActive = false;

    if (positionTimer) {
      window.clearTimeout(positionTimer);
      positionTimer = null;
    }

    closeFolderIfNeeded();
    markTutorialSeen();
    if (rootEl) {
      rootEl.hidden = true;
    }
  }

  if (replayBtn) {
    replayBtn.addEventListener("click", function () {
      startTutorial();
    });
  }

  window.addEventListener("resize", function () {
    if (isActive && activeSteps[currentStepIndex]) {
      positionStep(activeSteps[currentStepIndex]);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (!isActive) return;
    if (e.key === "Escape") {
      endTutorial();
    } else if (e.key === "ArrowRight") {
      if (currentStepIndex >= activeSteps.length - 1) {
        endTutorial();
      } else {
        goToStep(currentStepIndex + 1);
      }
    } else if (e.key === "ArrowLeft") {
      goToStep(currentStepIndex - 1);
    }
  });

  window.addEventListener("load", function () {
    if (!hasSeenTutorial()) {
      window.setTimeout(function () {
        startTutorial();
      }, 780);
    }
  });

  window.DesktopTutorial = {
    start: startTutorial,
    close: endTutorial
  };
})();
