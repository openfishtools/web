document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('tool-fivemb-input');
    const dropArea = document.getElementById('tool-fivemb-drop');
    const dropInner = document.getElementById('tool-fivemb-inner');
    const statusText = document.getElementById('tool-fivemb-status');

    let selectedFile = null;

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
        processAndDownloadXML(file);
    }

    function resetUI() {
        selectedFile = null;
        fileInput.value = '';
        dropInner.innerHTML = `
            <span class="material-symbols-rounded">code</span>
            <span>${window.getTranslation('tool_fivemb_drop')}</span>
        `;
        statusText.innerHTML = '';
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

    function processAndDownloadXML(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const xmlText = e.target.result;
                const modifiedXml = processXml(xmlText);

                // Create download blob
                const blob = new Blob([modifiedXml], { type: 'text/xml' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name.replace('.xml', '_5mb.xml');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showStatusSuccess(window.getTranslation('status_xml_success'));
            } catch (err) {
                console.error('[5MB Generator] Error processing XML:', err);
                showStatusError(window.getTranslation('status_error') + "XML");
            }
        };

        reader.readAsText(file);
    }

    function processXml(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // 1. Handle <media> tags (remove videos, redirect audios)
        const mediaElements = xmlDoc.getElementsByTagName("media");
        for (let i = mediaElements.length - 1; i >= 0; i--) {
            const media = mediaElements[i];
            const type = media.getAttribute("type") || "";
            if (type.includes("video")) {
                media.parentNode.removeChild(media);
            } else if (type.includes("audio")) {
                media.setAttribute("url", "audio.mp3");
                media.setAttribute("src", "audio.mp3");
                media.setAttribute("path", "audio.mp3");
            }
        }

        // 2. Convert video <shape> to a solid gray color placeholder
        const shapeElements = xmlDoc.getElementsByTagName("shape");
        for (let i = 0; i < shapeElements.length; i++) {
            const shape = shapeElements[i];
            const fillVideo = shape.getAttribute("fillVideo");
            const fillType = shape.getAttribute("fillType");
            const label = shape.getAttribute("label") || "";

            // Detect if the shape refers to a video source
            if (fillVideo || fillType === "media" && (label.toLowerCase().endsWith(".mp4") || label.toLowerCase().endsWith(".mov"))) {
                shape.setAttribute("fillType", "color");
                shape.removeAttribute("fillVideo");
                shape.setAttribute("label", "Placeholder Video");

                // Set fillColor to a solid dark gray (#ff222222)
                let fillColor = shape.getElementsByTagName("fillColor")[0];
                if (!fillColor) {
                    fillColor = xmlDoc.createElement("fillColor");
                    shape.appendChild(fillColor);
                }
                fillColor.setAttribute("value", "#ff222222");
            }
        }

        // 3. Keep <audio> elements but rename to "audio.mp3" and disable them
        const audioElements = xmlDoc.getElementsByTagName("audio");
        for (let i = 0; i < audioElements.length; i++) {
            const audio = audioElements[i];
            audio.setAttribute("name", "audio.mp3");
            audio.setAttribute("audio", "audio.mp3");
            audio.setAttribute("audioVideo", "audio.mp3");
            audio.setAttribute("sound", "audio.mp3");
            audio.setAttribute("enabled", "false");
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(xmlDoc);
    }
});
