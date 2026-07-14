document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-fivemb-input');
    const dropArea = document.getElementById('tool-fivemb-drop');
    const dropInner = document.getElementById('tool-fivemb-inner');
    const statusText = document.getElementById('tool-fivemb-status');

    // Layer selector UI elements
    const layersContainer = document.getElementById('tool-fivemb-layers-container');
    const layersList = document.getElementById('tool-fivemb-layers-list');
    const selectAllBtn = document.getElementById('tool-fivemb-select-all');
    const deselectAllBtn = document.getElementById('tool-fivemb-deselect-all');
    const exportBtn = document.getElementById('tool-fivemb-btn-export');

    let selectedFile = null;
    let loadedXmlText = null;

    // File input selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag & Drop event handlers
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = 'var(--md-sys-color-primary)';
        dropArea.style.background = 'var(--md-sys-color-primary-container)';
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.style.borderColor = '';
        dropArea.style.background = '';
        if (e.dataTransfer.files.length > 0) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    function showStatusError(msg) {
        statusText.innerHTML = `<span style="color: var(--md-sys-color-error);">${msg}</span>`;
    }

    // Green styling for success status
    function showStatusSuccess(msg) {
        statusText.innerHTML = `<span style="color: #4caf50; font-weight: bold;">${msg}</span>`;
    }

    function handleFileSelection(file) {
        if (!file.name.toLowerCase().endsWith('.xml')) {
            showStatusError("Please select a valid Alight Motion XML file.");
            resetUI();
            return;
        }

        selectedFile = file;
        const fileMB = file.size / (1024 * 1024);
        updateUIWithFile(file.name, fileMB);
        loadAndDisplayXML(file);
    }

    function resetUI() {
        selectedFile = null;
        loadedXmlText = null;
        fileInput.value = '';
        dropInner.innerHTML = `
            <span class="material-symbols-rounded">code</span>
            <span>${window.getTranslation('tool_fivemb_drop')}</span>
        `;
        statusText.innerHTML = '';
        if (layersContainer) {
            layersContainer.style.display = 'none';
        }
        if (layersList) {
            layersList.innerHTML = '';
        }
    }

    function updateUIWithFile(filename, sizeMB) {
        dropInner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; min-width: 0; pointer-events: auto;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex-grow: 1;">
                    <span class="material-symbols-rounded" style="color: var(--md-sys-color-primary); font-size: 24px;">code</span>
                    <span style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;" title="${filename}">${filename} (${sizeMB.toFixed(2)} MB)</span>
                </div>
                <button type="button" id="btn-cancel-fivemb" style="background: var(--md-sys-color-surface-container-highest); border: none; color: var(--md-sys-color-error); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 50%; width: 28px; height: 28px; transition: background 0.2s; flex-shrink: 0;">
                    <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
                </button>
            </div>
        `;

        document.getElementById('btn-cancel-fivemb').addEventListener('click', (e) => {
            e.stopPropagation();
            resetUI();
        });
    }

    function loadAndDisplayXML(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                loadedXmlText = e.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(loadedXmlText, "text/xml");

                const parserError = xmlDoc.getElementsByTagName("parsererror");
                if (parserError.length > 0) {
                    showStatusError("Failed to parse XML file. It might be corrupted.");
                    return;
                }

                const { layers } = extractLayers(xmlDoc);

                if (layers.length === 0) {
                    layersList.innerHTML = `
                        <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant); font-size: 13px;" data-i18n="tool_fivemb_no_layers">
                            ${window.getTranslation('tool_fivemb_no_layers')}
                        </div>
                    `;
                } else {
                    layersList.innerHTML = '';
                    layers.forEach(layer => {
                        const item = createLayerListItem(layer);
                        layersList.appendChild(item);
                    });
                }

                if (layersContainer) {
                    layersContainer.style.display = 'block';
                }
                statusText.innerHTML = '';

                // Translate any newly rendered HTML element with data-i18n
                if (typeof window.translateUI === 'function') {
                    window.translateUI();
                }
            } catch (err) {
                console.error('[5MB Generator] Error loading XML:', err);
                showStatusError("Error reading XML: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    function formatDuration(startTime, endTime) {
        if (startTime === null || endTime === null) return "";
        const start = parseFloat(startTime) || 0;
        const end = parseFloat(endTime) || 0;
        const durationMs = end - start;
        if (durationMs <= 0) return "";
        return `${(durationMs / 1000).toFixed(2)}s`;
    }

    function extractLayers(xmlDoc) {
        const layers = [];
        const mediaMap = {};
        
        const mediaTags = xmlDoc.getElementsByTagName("media");
        for (let i = 0; i < mediaTags.length; i++) {
            const m = mediaTags[i];
            const uri = m.getAttribute("uri") || "";
            if (uri) {
                mediaMap[uri] = {
                    filename: m.getAttribute("filename") || m.getAttribute("title") || "",
                    type: m.getAttribute("type") || "",
                    uri: uri
                };
            }
        }

        // 1. Shapes (Photos & Videos)
        const shapes = xmlDoc.getElementsByTagName("shape");
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            const id = shape.getAttribute("id");
            const fillType = shape.getAttribute("fillType");
            const fillImage = shape.getAttribute("fillImage");
            const fillVideo = shape.getAttribute("fillVideo");
            const label = shape.getAttribute("label") || "";
            const startTime = shape.getAttribute("startTime");
            const endTime = shape.getAttribute("endTime");

            const isMediaFill = (fillType === "media") || fillImage || fillVideo;
            const hasMediaLabel = /\.(png|jpe?g|webp|gif|mp4|mov|3gp|mkv|webm)$/i.test(label);

            if (isMediaFill || hasMediaLabel) {
                let type = "photo";
                let fileInfo = "";

                if (fillVideo) {
                    type = "video";
                    const med = mediaMap[fillVideo];
                    fileInfo = med ? med.filename : fillVideo;
                } else if (fillImage) {
                    type = "photo";
                    const med = mediaMap[fillImage];
                    fileInfo = med ? med.filename : fillImage;
                } else {
                    if (/\.(mp4|mov|3gp|mkv|webm)$/i.test(label)) {
                        type = "video";
                    } else {
                        type = "photo";
                    }
                }

                const duration = formatDuration(startTime, endTime);
                layers.push({
                    id: id,
                    label: label || `Layer ${id}`,
                    type: type,
                    fileInfo: fileInfo || label,
                    duration: duration
                });
            }
        }

        // 2. Audios (Sound tracks)
        const audios = xmlDoc.getElementsByTagName("audio");
        for (let i = 0; i < audios.length; i++) {
            const audio = audios[i];
            const id = audio.getAttribute("id");
            const label = audio.getAttribute("label") || audio.getAttribute("name") || "";
            const src = audio.getAttribute("src") || audio.getAttribute("audio") || "";
            const startTime = audio.getAttribute("startTime");
            const endTime = audio.getAttribute("endTime");

            const med = mediaMap[src];
            const fileInfo = med ? med.filename : src;
            const duration = formatDuration(startTime, endTime);

            layers.push({
                id: id,
                label: label || `Audio ${id}`,
                type: "audio",
                fileInfo: fileInfo || label,
                duration: duration
            });
        }

        return { layers, mediaMap };
    }

    function createLayerListItem(layer) {
        let typeIcon = "image";
        let typeLabelKey = "tool_fivemb_type_photo";
        let badgeClass = "photo";

        if (layer.type === "video") {
            typeIcon = "movie";
            typeLabelKey = "tool_fivemb_type_video";
            badgeClass = "video";
        } else if (layer.type === "audio") {
            typeIcon = "audiotrack";
            typeLabelKey = "tool_fivemb_type_audio";
            badgeClass = "audio";
        }

        const typeLabel = window.getTranslation(typeLabelKey);
        const durationStr = layer.duration ? ` • ${layer.duration}` : "";

        const item = document.createElement("div");
        item.className = "fivemb-layer-item";

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex-grow: 1;">
                <div class="fivemb-checkbox-wrapper">
                    <input type="checkbox" class="layer-checkbox" data-id="${layer.id}" checked>
                    <span class="fivemb-checkbox-custom"></span>
                </div>
                <span class="material-symbols-rounded" style="font-size: 20px; color: var(--md-sys-color-on-surface-variant); flex-shrink: 0;">${typeIcon}</span>
                <div style="display: flex; flex-direction: column; min-width: 0; text-align: left;">
                    <span style="font-size: 13px; font-weight: 600; color: var(--md-sys-color-on-surface); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${layer.label}">${layer.label}</span>
                    <span style="font-size: 11px; color: var(--md-sys-color-on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">ID: ${layer.id}${durationStr} • ${layer.fileInfo}</span>
                </div>
            </div>
            <span class="fivemb-layer-badge ${badgeClass}">${typeLabel}</span>
        `;

        const checkbox = item.querySelector(".layer-checkbox");

        function updateItemVisual() {
            if (checkbox.checked) {
                item.classList.add("selected");
            } else {
                item.classList.remove("selected");
            }
        }

        checkbox.addEventListener("change", updateItemVisual);

        // Toggle checkbox on clicking item
        item.addEventListener("click", (e) => {
            if (e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event("change"));
            }
        });

        updateItemVisual();
        return item;
    }

    // Toggle bulk selections
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = layersList.querySelectorAll('.layer-checkbox');
            checkboxes.forEach(cb => {
                if (!cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            const checkboxes = layersList.querySelectorAll('.layer-checkbox');
            checkboxes.forEach(cb => {
                if (cb.checked) {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        });
    }

    // Export handler
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (!selectedFile || !loadedXmlText) return;

            try {
                const checkedBoxes = layersList.querySelectorAll('.layer-checkbox:checked');
                const selectedIds = new Set();
                checkedBoxes.forEach(cb => {
                    selectedIds.add(cb.getAttribute('data-id'));
                });

                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(loadedXmlText, "text/xml");

                const activeMediaUris = new Set();

                // 1. Process shapes
                const shapes = xmlDoc.getElementsByTagName("shape");
                for (let i = 0; i < shapes.length; i++) {
                    const shape = shapes[i];
                    const id = shape.getAttribute("id");
                    const fillType = shape.getAttribute("fillType");
                    const fillImage = shape.getAttribute("fillImage");
                    const fillVideo = shape.getAttribute("fillVideo");
                    const label = shape.getAttribute("label") || "";

                    const isMediaFill = (fillType === "media") || fillImage || fillVideo;
                    const hasMediaLabel = /\.(png|jpe?g|webp|gif|mp4|mov|3gp|mkv|webm)$/i.test(label);

                    if (isMediaFill || hasMediaLabel) {
                        if (selectedIds.has(id)) {
                            let isVideo = fillVideo || /\.(mp4|mov|3gp|mkv|webm)$/i.test(label);

                            shape.setAttribute("fillType", "color");
                            shape.removeAttribute("fillVideo");
                            shape.removeAttribute("fillImage");

                            if (isVideo) {
                                shape.setAttribute("label", "Placeholder Video");
                            } else {
                                shape.setAttribute("label", "Placeholder Photo");
                            }

                            // Set fillColor to solid gray (#ff222222 for video, #ff444444 for photo)
                            let fillColor = shape.getElementsByTagName("fillColor")[0];
                            if (!fillColor) {
                                fillColor = xmlDoc.createElement("fillColor");
                                shape.appendChild(fillColor);
                            }
                            fillColor.setAttribute("value", isVideo ? "#ff222222" : "#ff444444");
                        } else {
                            if (fillImage) activeMediaUris.add(fillImage);
                            if (fillVideo) activeMediaUris.add(fillVideo);
                        }
                    }
                }

                // 2. Process audios
                const audios = xmlDoc.getElementsByTagName("audio");
                for (let i = 0; i < audios.length; i++) {
                    const audio = audios[i];
                    const id = audio.getAttribute("id");
                    const src = audio.getAttribute("src") || audio.getAttribute("audio") || "";

                    if (selectedIds.has(id)) {
                        audio.setAttribute("name", "audio.mp3");
                        audio.setAttribute("audio", "audio.mp3");
                        audio.setAttribute("audioVideo", "audio.mp3");
                        audio.setAttribute("sound", "audio.mp3");
                        audio.setAttribute("enabled", "false");

                        if (audio.hasAttribute("src")) {
                            audio.setAttribute("src", "audio.mp3");
                        }
                    } else {
                        if (src) activeMediaUris.add(src);
                    }
                }

                // 3. Process <media> elements
                const mediaElements = xmlDoc.getElementsByTagName("media");
                for (let i = mediaElements.length - 1; i >= 0; i--) {
                    const media = mediaElements[i];
                    const uri = media.getAttribute("uri") || "";
                    const type = media.getAttribute("type") || "";

                    if (uri && !activeMediaUris.has(uri)) {
                        if (type.includes("video")) {
                            media.parentNode.removeChild(media);
                        } else if (type.includes("audio")) {
                            media.setAttribute("url", "audio.mp3");
                            media.setAttribute("src", "audio.mp3");
                            media.setAttribute("path", "audio.mp3");
                        } else if (type.includes("image")) {
                            media.parentNode.removeChild(media);
                        }
                    }
                }

                const serializer = new XMLSerializer();
                const modifiedXml = serializer.serializeToString(xmlDoc);

                const blob = new Blob([modifiedXml], { type: 'text/xml' });
                const url = URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = selectedFile.name.replace('.xml', '_5mb.xml');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showStatusSuccess(window.getTranslation('status_xml_success'));
            } catch (err) {
                console.error('[5MB Generator] Error processing XML:', err);
                showStatusError(window.getTranslation('status_error') + "XML");
            }
        });
    }
});
