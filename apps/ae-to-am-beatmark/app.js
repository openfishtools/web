(function () {
  "use strict";

  var U = window.AppUtils;

  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("file-input");
  var workspace = document.getElementById("workspace");
  var fileNameEl = document.getElementById("file-name");
  var fileDetailsEl = document.getElementById("file-details");
  var btnChangeFile = document.getElementById("btn-change-file");

  var compSelect = document.getElementById("comp-select");
  var statBeats = document.getElementById("stat-beats");
  var statFps = document.getElementById("stat-fps");
  var statTimebase = document.getElementById("stat-timebase");

  var titleInput = document.getElementById("title-input");
  var widthInput = document.getElementById("width-input");
  var heightInput = document.getElementById("height-input");
  var fpsInput = document.getElementById("fps-input");
  var durationInput = document.getElementById("duration-input");
  var btnStart = document.getElementById("btn-start");

  var logger = U.createLogger(
    document.getElementById("logs-output"),
    document.getElementById("logs-badge")
  );

  var foundCompositions = [];
  var parsedBeats = [];

  U.bindDropzone(dropzone, fileInput, handleFile);

  btnChangeFile.addEventListener("click", function () {
    fileInput.value = "";
    fileInput.click();
  });

  compSelect.addEventListener("change", function () {
    selectComposition(parseInt(compSelect.value, 10));
  });

  function extractBeatsFromComp(compElement) {
    var timebase = 30720;
    var detectedFps = 30;

    var cdtaNode = compElement.querySelector("cdta");
    if (cdtaNode) {
      var bdata = cdtaNode.getAttribute("bdata");
      if (bdata && bdata.length >= 24) {
        var frameDurationTicks = parseInt(bdata.substring(8, 16), 16);
        var extractedTimebase = parseInt(bdata.substring(16, 24), 16);
        if (frameDurationTicks > 0 && extractedTimebase > 0) {
          timebase = extractedTimebase;
          detectedFps = Math.round(timebase / frameDurationTicks);
        }
      }
    }

    var beats = [];
    var ldatNodes = compElement.querySelectorAll("mrst list ldat");
    ldatNodes.forEach(function (ldat) {
      var bdata = ldat.getAttribute("bdata");
      if (!bdata) return;
      for (var i = 0; i + 32 <= bdata.length; i += 32) {
        var hexTime = bdata.substring(i, i + 8);
        var val = parseInt(hexTime, 16);
        if (!isNaN(val)) {
          var ms = Math.round((val / timebase) * 1000);
          if (beats.indexOf(ms) === -1) beats.push(ms);
        }
      }
    });

    beats.sort(function (a, b) { return a - b; });
    return { beats: beats, detectedFps: detectedFps, timebase: timebase };
  }

  function selectComposition(id) {
    var comp = foundCompositions.find(function (c) { return c.id === id; });
    if (!comp) return;

    var info = extractBeatsFromComp(comp.element);
    parsedBeats = info.beats;

    titleInput.value = comp.name;
    fpsInput.value = info.detectedFps;
    statBeats.textContent = String(parsedBeats.length);
    statFps.textContent = String(info.detectedFps);
    statTimebase.textContent = String(info.timebase);

    if (parsedBeats.length > 0) {
      var lastBeat = parsedBeats[parsedBeats.length - 1];
      durationInput.value = lastBeat + Math.ceil(1000 / Math.max(1, info.detectedFps));
      btnStart.disabled = false;
      logger.setBadge("Ready");
      logger.append("Komposisi \"" + comp.name + "\": " + parsedBeats.length + " beat (" + info.detectedFps + " FPS)");
    } else {
      durationInput.value = 5000;
      btnStart.disabled = true;
      logger.setBadge("No Beats");
      logger.append("Tidak ada marker beat pada komposisi \"" + comp.name + "\"");
    }
  }

  function handleFile(file) {
    if (!file || !/\.(xml|aepx)$/i.test(file.name)) {
      logger.setBadge("Error");
      logger.append("Pilih file After Effects .xml atau .aepx yang valid.");
      return;
    }

    fileNameEl.textContent = file.name;
    fileDetailsEl.textContent = U.formatBytes(file.size);
    dropzone.classList.add("is-hidden");
    workspace.classList.remove("is-hidden");
    btnStart.disabled = true;

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var xmlDoc = new DOMParser().parseFromString(String(e.target.result || ""), "text/xml");
        if (!xmlDoc.querySelector("AfterEffectsProject")) {
          throw new Error("Bukan file proyek After Effects XML yang valid.");
        }

        foundCompositions = [];
        var items = xmlDoc.querySelectorAll("Fold > Item");
        items.forEach(function (item, idx) {
          var nameNode = item.querySelector("string");
          var hasLayers = item.querySelector("SLay") || item.querySelector("CLay");
          if (nameNode && hasLayers) {
            foundCompositions.push({
              id: idx,
              name: nameNode.textContent,
              element: item
            });
          }
        });

        if (foundCompositions.length === 0) {
          throw new Error("Tidak ada komposisi valid ditemukan di proyek ini.");
        }

        compSelect.innerHTML = "";
        foundCompositions.forEach(function (comp) {
          var opt = document.createElement("option");
          opt.value = comp.id;
          opt.textContent = comp.name;
          compSelect.appendChild(opt);
        });

        fileDetailsEl.textContent = U.formatBytes(file.size) + " \u2022 " + foundCompositions.length + " komposisi";
        selectComposition(foundCompositions[0].id);
        btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">transform</span> Konversi ke AM XML';
      } catch (err) {
        foundCompositions = [];
        parsedBeats = [];
        logger.setBadge("Error");
        logger.append("Gagal membaca proyek: " + (err && err.message ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  }

  function escapeXml(str) {
    return String(str).replace(/[<>&'"]/g, function (c) {
      if (c === "<") return "&lt;";
      if (c === ">") return "&gt;";
      if (c === "&") return "&amp;";
      if (c === "'") return "&apos;";
      return "&quot;";
    });
  }

  function generateAmXml(cfg) {
    var xml = "<?xml version='1.0' encoding='UTF-8' ?>\n";
    xml += '<scene title="' + escapeXml(cfg.title) + '" width="' + cfg.w + '" height="' + cfg.h + '" exportWidth="' + cfg.w + '" exportHeight="' + cfg.h + '" precompose="dynamicResolution" bgcolor="#ff000000" totalTime="' + cfg.duration + '" fps="' + cfg.fps + '" modifiedTime="' + Date.now() + '" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false">\n';

    cfg.beats.forEach(function (ms) {
      xml += '  <bookmark t="' + ms + '" />\n';
    });

    var centerX = (cfg.w / 2).toFixed(6);
    var centerY = (cfg.h / 2).toFixed(6);
    var randomId = Math.floor(Math.random() * 900000000) + 100000000;

    xml += '  <shape id="' + randomId + '" label="placeholder" startTime="0" endTime="' + cfg.duration + '" fillType="color" mediaFillMode="fill" s=".rect">\n';
    xml += "    <transform>\n";
    xml += '      <location value="' + centerX + "," + centerY + ',0.000000" />\n';
    xml += '      <scale value="5.400000,5.400000" />\n';
    xml += "    </transform>\n";
    xml += '    <fillColor value="#ff5f3a8e" />\n';
    xml += '    <property name="size" type="vec2" value="100.000000,100.000000" />\n';
    xml += "  </shape>\n";
    xml += "</scene>";
    return xml;
  }

  btnStart.addEventListener("click", function () {
    if (parsedBeats.length === 0) return;

    var title = (titleInput.value || "").trim() || "Project XML";
    var w = parseInt(widthInput.value, 10) || 1080;
    var h = parseInt(heightInput.value, 10) || 1920;
    var fps = parseInt(fpsInput.value, 10) || 30;
    var duration = parseInt(durationInput.value, 10) || 5000;

    var xmlStr = generateAmXml({
      title: title,
      w: w,
      h: h,
      fps: fps,
      duration: duration,
      beats: parsedBeats
    });

    var blob = new Blob([xmlStr], { type: "text/xml" });
    var outName = title.replace(/[^a-z0-9]/gi, "_").toLowerCase() + "_am.xml";

    logger.setBadge("Done");
    logger.append("Berhasil mengekspor " + parsedBeats.length + " bookmark (" + w + "x" + h + ", " + fps + " FPS)");
    logger.append("Mengunduh otomatis: " + outName);
    U.triggerDownload(blob, outName);

    btnStart.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">transform</span> Konversi Ulang';
  });
})();
