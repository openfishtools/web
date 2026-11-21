(function () {
  "use strict";

  var LANGUAGES = [
    "Welcome to",
    "Selamat datang di",
    "Bienvenue sur",
    "ようこそ",
    "환영합니다",
    "مرحباً بكم في",
    "Добро пожаловать в",
    "Bem-vindo ao"
  ];

  var word = document.querySelector(".greeting-word");
  var index = 0;

  if (LANGUAGES.length > 1 && word &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setInterval(function () {
      word.classList.add("is-out");
      window.setTimeout(function () {
        index = (index + 1) % LANGUAGES.length;
        word.textContent = LANGUAGES[index];
        word.classList.remove("is-out");
        word.classList.add("is-in");
        void word.offsetWidth;
        word.classList.remove("is-in");
      }, 260);
    }, 2600);
  }

  function splitChars() {
    document.querySelectorAll(".split").forEach(function (el) {
      var text = el.textContent;
      el.textContent = "";
      for (var i = 0; i < text.length; i++) {
        var ch = document.createElement("span");
        ch.className = "ch";
        ch.style.setProperty("--i", i);
        ch.textContent = text[i] === " " ? "\u00a0" : text[i];
        el.appendChild(ch);
      }
    });
  }

  splitChars();

  document.querySelectorAll(".squiggle .split").forEach(function (el) {
    el.addEventListener("animationend", drawSquiggle, { once: true });
  });

  function drawSquiggle() {
    document.querySelectorAll(".squiggle-svg").forEach(function (svg) {
      var host = svg.parentElement;
      if (!host) return;

      var w = host.offsetWidth;
      var h = svg.getBoundingClientRect().height || 10;
      if (!w || !h) return;

      svg.setAttribute("viewBox", "0 0 " + w + " " + h);

      var amp = h * 0.42;
      var mid = h * 0.5;
      var step = Math.max(16, w / 8);
      var d = "M 0 " + mid.toFixed(2);
      var up = true;
      var x = 0;
      var prev = 0;

      while (x < w) {
        x = Math.min(x + step, w);
        var y = up ? mid - amp : mid + amp;
        var cx = ((prev + x) / 2).toFixed(2);
        d += " Q " + cx + " " + y.toFixed(2) + " " + x.toFixed(2) + " " + mid.toFixed(2);
        up = !up;
        prev = x;
      }

      var path = svg.querySelector("path");
      if (!path) {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        svg.appendChild(path);
      }
      path.setAttribute("d", d);

      if (path.classList.contains("draw")) {
        path.style.setProperty("--len", path.getTotalLength() + "px");
      } else if (!path.dataset.ready) {
        path.style.setProperty("--len", path.getTotalLength() + "px");
        path.classList.add("draw");
        path.dataset.ready = "1";
        path.addEventListener("animationend", function () {
          path.classList.remove("draw");
          path.style.removeProperty("--len");
        }, { once: true });
      }
    });
  }

  drawSquiggle();
  window.addEventListener("resize", drawSquiggle);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(drawSquiggle);
  }

  var SHAPE_NS = "http://www.w3.org/2000/svg";

  function cookiePath(w, h) {
    var r = Math.min(18, h * 0.34);
    var d = r * 0.5;
    var x1 = r, x2 = w - r, y1 = r, y2 = h - r;
    var cx = w / 2, cy = h / 2;
    return [
      "M", cx - d, 0,
      "Q", cx, d, cx + d, 0,
      "L", x2, 0,
      "A", r, r, 0, 0, 1, w, y1,
      "L", w, cy - d,
      "Q", w - d, cy, w, cy + d,
      "L", w, y2,
      "A", r, r, 0, 0, 1, x2, h,
      "L", cx + d, h,
      "Q", cx, h - d, cx - d, h,
      "L", x1, h,
      "A", r, r, 0, 0, 1, 0, y2,
      "L", 0, cy + d,
      "Q", d, cy, 0, cy - d,
      "L", 0, y1,
      "A", r, r, 0, 0, 1, x1, 0,
      "Z"
    ].join(" ");
  }

  function shapeButtons() {
    var buttons = document.querySelectorAll(".btn");
    if (!buttons.length) return;

    var svg = document.createElementNS(SHAPE_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    var defs = document.createElementNS(SHAPE_NS, "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);

    buttons.forEach(function (btn, i) {
      var id = "cookie-" + i;
      var clip = document.createElementNS(SHAPE_NS, "clipPath");
      clip.setAttribute("id", id);
      clip.setAttribute("clipPathUnits", "userSpaceOnUse");
      var path = document.createElementNS(SHAPE_NS, "path");
      clip.appendChild(path);
      defs.appendChild(clip);

      function render() {
        var w = btn.offsetWidth;
        var h = btn.offsetHeight;
        if (!w || !h) return;
        path.setAttribute("d", cookiePath(w, h));
        btn.style.clipPath = "url(#" + id + ")";
        btn.style.webkitClipPath = "url(#" + id + ")";
      }

      render();
      window.addEventListener("resize", render);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(render);
      }
    });
  }

  shapeButtons();

  var drawerDefault = document.querySelector('[data-popup="default"]');
  var drawerRecent = document.querySelector('[data-popup="recent"]');
  var drawerAep = document.querySelector('[data-popup="cutefishaep"]');
  var scrim = document.querySelector(".scrim");
  var active = null;
  var countEl = null;
  var waveSvg = null;
  var wavePath = null;
  var raf = null;
  var redirectTimer = null;
  var DEFAULT_DEST = "https://cutefish.org";
  var DURATION = 5000;
  var WAVELENGTH = 32;
  var CHOICE_KEY = "cutefish_choice";
  var LEGACY_KEY = "cutefishos_seen";

  function getSavedChoice() {
    try {
      var saved = localStorage.getItem(CHOICE_KEY);
      if (saved) return saved;
      if (localStorage.getItem(LEGACY_KEY) === "1") return "cutefishos";
    } catch (e) {}
    return null;
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(CHOICE_KEY, choice);
      if (choice === "cutefishos") {
        localStorage.setItem(LEGACY_KEY, "1");
      }
    } catch (e) {}
  }

  function clearChoice() {
    try {
      localStorage.removeItem(CHOICE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}
  }

  function redirect() {
    var dest = (active && active.dataset.dest) ? active.dataset.dest : DEFAULT_DEST;
    document.body.classList.add("page-is-exiting");
    window.setTimeout(function () {
      location.href = dest;
    }, 220);
  }

  function drawWave(ratio, now) {
    if (!waveSvg || !wavePath) return;
    var w = waveSvg.clientWidth;
    var h = waveSvg.clientHeight;
    if (!w || !h) return;

    waveSvg.setAttribute("viewBox", "0 0 " + w + " " + h);

    var mid = h / 2;
    var amp = 2.5;
    if (ratio <= 0.02 || ratio >= 0.98) amp = 0;

    var end = Math.max(2, w * ratio);
    var phase = (now / 1000) * Math.PI * 2;
    var step = WAVELENGTH / 8;

    var pts = [];
    for (var x = 0; x <= end; x += step) {
      var y = mid + amp * Math.sin((x / WAVELENGTH) * Math.PI * 2 + phase);
      pts.push([x, y]);
    }
    if (pts.length < 2) return;

    var d = "M " + pts[0][0].toFixed(2) + " " + pts[0][1].toFixed(2);
    for (var i = 1; i < pts.length; i++) {
      var cx = (pts[i - 1][0] + pts[i][0]) / 2;
      var cy = (pts[i - 1][1] + pts[i][1]) / 2;
      d += " Q " + cx.toFixed(2) + " " + cy.toFixed(2) + " " +
           pts[i][0].toFixed(2) + " " + pts[i][1].toFixed(2);
    }
    wavePath.setAttribute("d", d);
  }

  function stopCountdown() {
    if (raf) cancelAnimationFrame(raf);
    if (redirectTimer) clearTimeout(redirectTimer);
    raf = null;
    redirectTimer = null;
    if (countEl) countEl.textContent = "5";
    drawWave(0, 0);
  }

  function startCountdown() {
    stopCountdown();
    var start = performance.now();

    function tick(now) {
      var elapsed = now - start;
      var ratio = Math.min(elapsed / DURATION, 1);
      var left = Math.max(0, Math.ceil((DURATION - elapsed) / 1000));
      if (countEl) countEl.textContent = left;
      drawWave(ratio, now);
      if (ratio < 1) {
        raf = requestAnimationFrame(tick);
      }
    }

    raf = requestAnimationFrame(tick);
    redirectTimer = setTimeout(redirect, DURATION);
  }

  function openDialog(drawerType) {
    if (!scrim) return;
    if (active && !active.hidden) return;

    var target = drawerType;
    if (!target) {
      target = getSavedChoice() || "cutefishos";
    }

    var next = null;
    if (target === "cutefishaep") {
      next = drawerAep;
    } else {
      var saved = getSavedChoice();
      next = (saved === "cutefishos" && drawerRecent) ? drawerRecent : drawerDefault;
    }
    if (!next) return;

    if (drawerDefault) drawerDefault.hidden = true;
    if (drawerRecent) drawerRecent.hidden = true;
    if (drawerAep) drawerAep.hidden = true;

    active = next;
    countEl = active.querySelector("[data-count]");
    waveSvg = active.querySelector(".visit-wave-svg");
    wavePath = active.querySelector(".visit-wave-active");

    document.body.classList.add("has-overlay");
    active.classList.remove("is-closing");
    scrim.classList.remove("is-closing");
    active.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(drawSquiggle);
    startCountdown();
    saveChoice(target);

    var focusable = active.querySelector("[data-visit]");
    if (focusable) focusable.focus();
  }

  function closeDialog() {
    if (!active || !scrim || active.hidden || active.classList.contains("is-closing")) return;
    stopCountdown();
    clearChoice();
    active.classList.add("is-closing");
    scrim.classList.add("is-closing");
    document.body.classList.remove("has-overlay");

    var popup = active;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      popup.hidden = true;
      scrim.hidden = true;
      popup.classList.remove("is-closing");
      scrim.classList.remove("is-closing");
      var triggerSelector = popup === drawerAep ? '[data-drawer="cutefishaep"]' : '[data-drawer="cutefishos"]';
      var trigger = document.querySelector(triggerSelector);
      if (trigger) trigger.focus();
      active = null;
    }

    popup.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, 320);
  }

  document.querySelectorAll("[data-drawer]").forEach(function (el) {
    el.addEventListener("click", function () {
      openDialog(el.dataset.drawer);
    });
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (el) {
    el.addEventListener("click", closeDialog);
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest && e.target.closest("[data-visit]")) {
      redirect();
      return;
    }

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

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && active && !active.hidden) closeDialog();
  });

  window.setTimeout(function () {
    var saved = getSavedChoice();
    if (saved) openDialog(saved);
  }, 900);
})();
