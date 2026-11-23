(function () {
  "use strict";

  var U = window.AppUtils;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnChangeFile = document.getElementById("btn-change-file");
  var btnSelectAll = document.getElementById("btn-select-all");
  var btnDeselectAll = document.getElementById("btn-deselect-all");
  var filterTabsEl = document.getElementById("filter-tabs");
  var layersListEl = document.getElementById("layers-list");
  var btnStart = document.getElementById("btn-start");

  var statsGrid = document.getElementById("stats-grid");
  var statOriginal = document.getElementById("stat-original");
  var statOutput = document.getElementById("stat-output");
  var statReplaced = document.getElementById("stat-replaced");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var currentFile = null;
  var loadedXmlText = "";
  var currentFilter = "all";

  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    fileInput.value = "";
    fileInput.click();
  });

  btnSelectAll.addEventListener("click", function () {
    layersListEl.querySelectorAll(".app-list-item").forEach(function (item) {
      if (item.classList.contains("is-hidden")) return;
      var cb = item.querySelector(".layer-checkbox");
      if (cb) {
        cb.checked = true;
        item.classList.add("is-selected");
      }
    });
  });

  btnDeselectAll.addEventListener("click", function () {
    layersListEl.querySelectorAll(".app-list-item").forEach(function (item) {
      if (item.classList.contains("is-hidden")) return;
      var cb = item.querySelector(".layer-checkbox");
      if (cb) {
        cb.checked = false;
        item.classList.remove("is-selected");
      }
    });
  });

  function extractLayers(xmlDoc) {
    var layers = [];
    var mediaMap = {};

    var mediaTags = xmlDoc.getElementsByTagName("media");
    for (var i = 0; i < mediaTags.length; i++) {
      var m = mediaTags[i];
      var uri = m.getAttribute("uri") || "";
      if (uri) {
        mediaMap[uri] = {
          filename: m.getAttribute("filename") || m.getAttribute("title") || "",
          type: m.getAttribute("type") || "",
          uri: uri
        };
      }
    }

    var shapes = xmlDoc.getElementsByTagName("shape");
    for (var s = 0; s < shapes.length; s++) {
      var shape = shapes[s];
      var id = shape.getAttribute("id");
      var fillType = shape.getAttribute("fillType");
      var fillImage = shape.getAttribute("fillImage");
      var fillVideo = shape.getAttribute("fillVideo");
      var label = shape.getAttribute("label") || "";
      var startTime = shape.getAttribute("startTime");
      var endTime = shape.getAttribute("endTime");

      var isMediaFill = fillType === "media" || fillImage || fillVideo;
      var hasMediaLabel = /\.(png|jpe?g|webp|gif|mp4|mov|3gp|mkv|webm)$/i.test(label);

      if (isMediaFill || hasMediaLabel) {
        var type = "photo";
        var fileInfo = "";
        if (fillVideo) {
          type = "video";
          fileInfo = mediaMap[fillVideo] ? mediaMap[fillVideo].filename : fillVideo;
        } else if (fillImage) {
          type = "photo";
          fileInfo = mediaMap[fillImage] ? mediaMap[fillImage].filename : fillImage;
        } else {
          type = /\.(mp4|mov|3gp|mkv|webm)$/i.test(label) ? "video" : "photo";
        }

        var durationStr = "";
        if (startTime !== null && endTime !== null) {
          var diff = (parseFloat(endTime) || 0) - (parseFloat(startTime) || 0);
          if (diff > 0) durationStr = (diff / 1000).toFixed(2) + "s";
        }

        layers.push({
          id: id,
          label: label || ("Layer " + id),
          type: type,
          fileInfo: fileInfo || label,
          duration: durationStr
        });
      }
    }

    var audios = xmlDoc.getElementsByTagName("audio");
    for (var a = 0; a < audios.length; a++) {
      var audio = audios[a];
      var aid = audio.getAttribute("id");
      var alabel = audio.getAttribute("label") || audio.getAttribute("name") || "";
      var src = audio.getAttribute("src") || audio.getAttribute("audio") || "";
      var aStart = audio.getAttribute("startTime");
      var aEnd = audio.getAttribute("endTime");

      var med = mediaMap[src];
      var aInfo = med ? med.filename : src;
      var aDur = "";
      if (aStart !== null && aEnd !== null) {
        var aDiff = (parseFloat(aEnd) || 0) - (parseFloat(aStart) || 0);
        if (aDiff > 0) aDur = (aDiff / 1000).toFixed(2) + "s";
      }

      layers.push({
        id: aid,
        label: alabel || ("Audio " + aid),
        type: "audio",
        fileInfo: aInfo || alabel,
        duration: aDur
      });
    }

    return layers;
  }

  function renderFilterTabs(layers) {
    var counts = { all: layers.length, photo: 0, video: 0, audio: 0 };
    layers.forEach(function (l) {
      if (counts[l.type] !== undefined) counts[l.type]++;
    });

    var tabs = [
      { key: "all", label: "Semua" },
      { key: "photo", label: "Foto" },
      { key: "video", label: "Video" },
      { key: "audio", label: "Audio" }
    ];

    filterTabsEl.innerHTML = "";
    currentFilter = "all";

    tabs.forEach(function (tab) {
      if (tab.key !== "all" && counts[tab.key] === 0) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m3-segment" + (tab.key === "all" ? " is-active" : "");
      btn.dataset.filter = tab.key;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", tab.key === "all" ? "true" : "false");
      btn.textContent = tab.label + " (" + counts[tab.key] + ")";

      btn.addEventListener("click", function () {
        currentFilter = tab.key;
        filterTabsEl.querySelectorAll(".m3-segment").forEach(function (b) {
          var active = b.dataset.filter === currentFilter;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-checked", active ? "true" : "false");
        });
        layersListEl.querySelectorAll(".app-list-item").forEach(function (item) {
          var visible = currentFilter === "all" || item.dataset.type === currentFilter;
          item.classList.toggle("is-hidden", !visible);
        });
      });

      filterTabsEl.appendChild(btn);
    });
  }

  function createLayerItem(layer) {
    var icon = layer.type === "video" ? "movie" : (layer.type === "audio" ? "audiotrack" : "image");
    var badge = layer.type === "video" ? "Video" : (layer.type === "audio" ? "Audio" : "Foto");
    var subParts = ["ID: " + layer.id];
    if (layer.duration) subParts.push(layer.duration);
    if (layer.fileInfo) subParts.push(layer.fileInfo);

    var item = document.createElement("div");
    item.className = "app-list-item is-selected";
    item.dataset.type = layer.type;
    item.dataset.id = layer.id;

    var left = document.createElement("div");
    left.className = "app-list-left";

    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "app-checkbox layer-checkbox";
    cb.checked = true;
    cb.dataset.id = layer.id;

    var ic = document.createElement("span");
    ic.className = "material-symbols-rounded notranslate";
    ic.setAttribute("translate", "no");
    ic.setAttribute("aria-hidden", "true");
    ic.textContent = icon;

    var textBox = document.createElement("div");
    textBox.className = "app-list-text";

    var title = document.createElement("span");
    title.className = "app-list-title";
    title.textContent = layer.label;

    var sub = document.createElement("span");
    sub.className = "app-list-sub";
    sub.textContent = subParts.join(" \u2022 ");

    textBox.appendChild(title);
    textBox.appendChild(sub);
    left.appendChild(cb);
    left.appendChild(ic);
    left.appendChild(textBox);

    var badgeEl = document.createElement("span");
    badgeEl.className = "app-list-badge";
    badgeEl.textContent = badge;

    item.appendChild(left);
    item.appendChild(badgeEl);

    cb.addEventListener("change", function () {
      item.classList.toggle("is-selected", cb.checked);
    });

    item.addEventListener("click", function (e) {
      if (e.target === cb) return;
      cb.checked = !cb.checked;
      item.classList.toggle("is-selected", cb.checked);
    });

    return item;
  }

  function getPlaceholderFilename(type, originalLabel) {
    if (type === "video") {
      if (/\.mov$/i.test(originalLabel)) return "placeholder.mov";
      if (/\.3gp$/i.test(originalLabel)) return "placeholder.3gp";
      if (/\.mkv$/i.test(originalLabel)) return "placeholder.mkv";
      if (/\.webm$/i.test(originalLabel)) return "placeholder.webm";
      return "placeholder.mp4";
    }
    if (type === "photo") {
      if (/\.jpe?g$/i.test(originalLabel)) return "placeholder.jpg";
      if (/\.webp$/i.test(originalLabel)) return "placeholder.webp";
      if (/\.gif$/i.test(originalLabel)) return "placeholder.gif";
      return "placeholder.png";
    }
    if (type === "audio") {
      if (/\.wav$/i.test(originalLabel)) return "placeholder.wav";
      if (/\.ogg$/i.test(originalLabel)) return "placeholder.ogg";
      if (/\.aac$/i.test(originalLabel)) return "placeholder.aac";
      return "placeholder.mp3";
    }
    return "placeholder";
  }

  function handleFile(file) {
    if (!file || !/\.xml$/i.test(file.name)) {
      logger.setBadge("Error");
      logger.append("Pilih file XML Alight Motion (.xml) yang valid.");
      return;
    }

    currentFile = file;
    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    statsGrid.classList.add("is-hidden");
    btnStart.disabled = true;

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        loadedXmlText = String(e.target.result || "");
        var xmlDoc = new DOMParser().parseFromString(loadedXmlText, "text/xml");
        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
          throw new Error("Format XML rusak atau tidak valid.");
        }

        var layers = extractLayers(xmlDoc);
        renderFilterTabs(layers);
        layersListEl.innerHTML = "";

        if (layers.length === 0) {
          var empty = document.createElement("div");
          empty.className = "app-list-empty";
          empty.textContent = "Tidak ada layer media ditemukan di XML ini.";
          layersListEl.appendChild(empty);
        } else {
          layers.forEach(function (l) {
            layersListEl.appendChild(createLayerItem(l));
          });
        }

        fileDetailsEl.textContent = U.formatBytes(file.size) + " \u2022 " + layers.length + " layer media";
        btnStart.disabled = false;
        btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Buat XML 5MB';
        logger.setBadge("Ready");
        logger.append("XML dimuat: " + file.name + " (" + layers.length + " layer media)");
      } catch (err) {
        loadedXmlText = "";
        logger.setBadge("Error");
        logger.append("Gagal membaca XML: " + (err && err.message ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  }

  btnStart.addEventListener("click", function () {
    if (!currentFile || !loadedXmlText) return;
    generateXml();
  });

  function generateXml() {
    try {
      logger.setBadge("Running");
      var selectedIds = new Set();
      layersListEl.querySelectorAll(".layer-checkbox:checked").forEach(function (cb) {
        selectedIds.add(cb.dataset.id);
      });

      var xmlDoc = new DOMParser().parseFromString(loadedXmlText, "text/xml");
      var activeMediaUris = new Set();
      var replacedCount = 0;

      var shapes = xmlDoc.getElementsByTagName("shape");
      for (var i = 0; i < shapes.length; i++) {
        var shape = shapes[i];
        var id = shape.getAttribute("id");
        var fillType = shape.getAttribute("fillType");
        var fillImage = shape.getAttribute("fillImage");
        var fillVideo = shape.getAttribute("fillVideo");
        var label = shape.getAttribute("label") || "";

        var isMediaFill = fillType === "media" || fillImage || fillVideo;
        var hasMediaLabel = /\.(png|jpe?g|webp|gif|mp4|mov|3gp|mkv|webm)$/i.test(label);

        if (isMediaFill || hasMediaLabel) {
          var isVideo = Boolean(fillVideo || /\.(mp4|mov|3gp|mkv|webm)$/i.test(label));
          if (selectedIds.has(id)) {
            var placeholder = getPlaceholderFilename(isVideo ? "video" : "photo", label);
            shape.setAttribute("fillType", "media");
            if (isVideo) {
              shape.setAttribute("fillVideo", placeholder);
              shape.removeAttribute("fillImage");
            } else {
              shape.setAttribute("fillImage", placeholder);
              shape.removeAttribute("fillVideo");
            }
            shape.setAttribute("label", placeholder);
            var existingColor = shape.getElementsByTagName("fillColor")[0];
            if (existingColor && existingColor.parentNode) {
              existingColor.parentNode.removeChild(existingColor);
            }
            replacedCount++;
          } else {
            if (fillImage) activeMediaUris.add(fillImage);
            if (fillVideo) activeMediaUris.add(fillVideo);
          }
        }
      }

      var audios = xmlDoc.getElementsByTagName("audio");
      for (var j = 0; j < audios.length; j++) {
        var audio = audios[j];
        var aid = audio.getAttribute("id");
        var src = audio.getAttribute("src") || audio.getAttribute("audio") || "";
        var alabel = audio.getAttribute("label") || audio.getAttribute("name") || "";

        if (selectedIds.has(aid)) {
          var aPlaceholder = getPlaceholderFilename("audio", alabel);
          audio.setAttribute("name", aPlaceholder);
          audio.setAttribute("audio", aPlaceholder);
          audio.setAttribute("audioVideo", aPlaceholder);
          audio.setAttribute("sound", aPlaceholder);
          audio.setAttribute("enabled", "false");
          if (audio.hasAttribute("src")) audio.setAttribute("src", aPlaceholder);
          replacedCount++;
        } else if (src) {
          activeMediaUris.add(src);
        }
      }

      var mediaElements = xmlDoc.getElementsByTagName("media");
      for (var k = mediaElements.length - 1; k >= 0; k--) {
        var media = mediaElements[k];
        var uri = media.getAttribute("uri") || "";
        var type = media.getAttribute("type") || "";
        if (uri && !activeMediaUris.has(uri)) {
          if (type.indexOf("video") !== -1 || type.indexOf("image") !== -1) {
            if (media.parentNode) media.parentNode.removeChild(media);
          } else if (type.indexOf("audio") !== -1) {
            media.setAttribute("url", "placeholder.mp3");
            media.setAttribute("src", "placeholder.mp3");
            media.setAttribute("path", "placeholder.mp3");
          }
        }
      }

      var modifiedXml = new XMLSerializer().serializeToString(xmlDoc);
      var blob = new Blob([modifiedXml], { type: "text/xml" });
      var outName = currentFile.name.replace(/\.xml$/i, "") + "_5mb.xml";

      statOriginal.textContent = U.formatBytes(currentFile.size);
      statOutput.textContent = U.formatBytes(blob.size);
      statReplaced.textContent = String(replacedCount);
      statsGrid.classList.remove("is-hidden");

      logger.setBadge("Done");
      logger.append("Berhasil mengganti " + replacedCount + " layer (" + U.formatBytes(blob.size) + ")");
      logger.append("Mengunduh otomatis: " + outName);
      U.triggerDownload(blob, outName);

      btnStart.innerHTML = '<span class="material-symbols-rounded notranslate" translate="no" aria-hidden="true">auto_fix_high</span> Buat Ulang';
    } catch (err) {
      logger.setBadge("Error");
      logger.append("Gagal membuat XML: " + (err && err.message ? err.message : String(err)));
    }
  }
})();
