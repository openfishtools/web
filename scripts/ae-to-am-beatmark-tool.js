document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('tool-ae-am-drop');
    const fileInput = document.getElementById('tool-ae-am-input');
    const configSection = document.getElementById('tool-ae-am-config');
    const compSelect = document.getElementById('tool-ae-am-comp');
    const compTitle = document.getElementById('tool-ae-am-title');
    const compWidth = document.getElementById('tool-ae-am-width');
    const compHeight = document.getElementById('tool-ae-am-height');
    const compFps = document.getElementById('tool-ae-am-fps');
    const compDuration = document.getElementById('tool-ae-am-duration');
    const beatSummary = document.getElementById('tool-ae-am-beat-summary');
    const btnConvert = document.getElementById('btn-ae-am-convert');
    const statusText = document.getElementById('tool-ae-am-status');

    if (!dropArea || !fileInput) return;

    let foundCompositions = [];
    let parsedBeats = [];

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('active');
    });
    dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropArea.classList.remove('active');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('active');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    compSelect.addEventListener('change', (e) => selectComposition(parseInt(e.target.value, 10)));

    btnConvert.addEventListener('click', () => {
        const title = compTitle.value.trim() || 'Project XML';
        const w = parseInt(compWidth.value, 10) || 1080;
        const h = parseInt(compHeight.value, 10) || 1920;
        const fps = parseInt(compFps.value, 10) || 30;
        const duration = parseInt(compDuration.value, 10) || 5000;

        if (parsedBeats.length === 0) {
            showStatus(window.getTranslation('tool_ae_am_no_beats_alert'), 'var(--md-sys-color-error)');
            return;
        }

        let xmlStr = `<?xml version='1.0' encoding='UTF-8' ?>\n`;
        xmlStr += `<scene title="${escapeXml(title)}" width="${w}" height="${h}" exportWidth="${w}" exportHeight="${h}" precompose="dynamicResolution" bgcolor="#ff000000" totalTime="${duration}" fps="${fps}" modifiedTime="${Date.now()}" amver="1028425" ffver="106" am="com.alightcreative.motion/5.0.273.1028425" amplatform="android" retime="freeze" retimeAdaptFPS="false">\n`;

        parsedBeats.forEach((ms) => {
            xmlStr += `  <bookmark t="${ms}" />\n`;
        });

        const centerX = (w / 2).toFixed(6);
        const centerY = (h / 2).toFixed(6);
        const randomId = Math.floor(Math.random() * 900000000) + 100000000;

        xmlStr += `  <shape id="${randomId}" label="placeholder" startTime="0" endTime="${duration}" fillType="color" mediaFillMode="fill" s=".rect">\n`;
        xmlStr += `    <transform>\n`;
        xmlStr += `      <location value="${centerX},${centerY},0.000000" />\n`;
        xmlStr += `      <scale value="5.400000,5.400000" />\n`;
        xmlStr += `    </transform>\n`;
        xmlStr += `    <fillColor value="#ff5f3a8e" />\n`;
        xmlStr += `    <property name="size" type="vec2" value="100.000000,100.000000" />\n`;
        xmlStr += `  </shape>\n`;
        xmlStr += `</scene>`;

        const blob = new Blob([xmlStr], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus(window.getTranslation('tool_ae_am_success'));
    });

    function showStatus(message, color = 'var(--md-sys-color-primary)') {
        statusText.textContent = message;
        statusText.style.color = color;
    }

    function handleFile(file) {
        showStatus(window.getTranslation('tool_ae_am_analyzing'));

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(e.target.result, 'text/xml');
                if (!xmlDoc.querySelector('AfterEffectsProject')) {
                    throw new Error(window.getTranslation('tool_ae_am_error_invalid'));
                }

                foundCompositions = [];
                const items = xmlDoc.querySelectorAll('Fold > Item');

                items.forEach((item, index) => {
                    const nameNode = item.querySelector('string');
                    const hasLayers = item.querySelector('SLay') || item.querySelector('CLay');

                    if (nameNode && hasLayers) {
                        foundCompositions.push({
                            id: index,
                            name: nameNode.textContent,
                            element: item
                        });
                    }
                });

                if (foundCompositions.length === 0) {
                    throw new Error(window.getTranslation('tool_ae_am_error_no_comp'));
                }

                compSelect.innerHTML = '';
                foundCompositions.forEach((comp) => {
                    const opt = document.createElement('option');
                    opt.value = comp.id;
                    opt.textContent = comp.name;
                    compSelect.appendChild(opt);
                });

                selectComposition(foundCompositions[0].id);
                showStatus('');
                configSection.classList.remove('hidden');
                btnConvert.classList.remove('hidden');
            } catch (err) {
                showStatus(`${window.getTranslation('status_error')}${err.message}`, 'var(--md-sys-color-error)');
                configSection.classList.add('hidden');
                btnConvert.classList.add('hidden');
            }
        };
        reader.readAsText(file);
    }

    function selectComposition(index) {
        const comp = foundCompositions.find((c) => c.id === index);
        if (!comp) return;

        let timebase = 30720;
        let detectedFps = 30;

        const cdtaNode = comp.element.querySelector('cdta');
        if (cdtaNode) {
            const bdata = cdtaNode.getAttribute('bdata');
            if (bdata && bdata.length >= 24) {
                const frameDurationTicks = parseInt(bdata.substring(8, 16), 16);
                const extractedTimebase = parseInt(bdata.substring(16, 24), 16);

                if (frameDurationTicks > 0 && extractedTimebase > 0) {
                    timebase = extractedTimebase;
                    detectedFps = Math.round(timebase / frameDurationTicks);
                }
            }
        }

        parsedBeats = [];
        const ldatNodes = comp.element.querySelectorAll('mrst list ldat');

        ldatNodes.forEach((ldat) => {
            const bdata = ldat.getAttribute('bdata');
            if (bdata) {
                for (let i = 0; i < bdata.length; i += 32) {
                    if (i + 32 > bdata.length) break;
                    const chunk = bdata.substring(i, i + 32);
                    const hexTime = chunk.substring(0, 8);
                    const val = parseInt(hexTime, 16);
                    if (!isNaN(val)) {
                        const ms = Math.round((val / timebase) * 1000);
                        if (!parsedBeats.includes(ms)) parsedBeats.push(ms);
                    }
                }
            }
        });

        parsedBeats.sort((a, b) => a - b);

        compTitle.value = comp.name;
        compFps.value = detectedFps;

        if (parsedBeats.length > 0) {
            const lastBeat = parsedBeats[parsedBeats.length - 1];
            const frameDurationMs = Math.ceil(1000 / detectedFps);
            compDuration.value = lastBeat + frameDurationMs;

            beatSummary.innerHTML = `
                <span class="ae-am-beat-count">${window.getTranslation('tool_ae_am_beats_loaded').replace('{count}', parsedBeats.length)}</span>
                <span class="ae-am-beat-meta">${detectedFps} FPS · timebase ${timebase}</span>
            `;
        } else {
            compDuration.value = 5000;
            beatSummary.innerHTML = `<span class="ae-am-beat-warn">${window.getTranslation('tool_ae_am_no_beats')}</span>`;
        }
    }

    function escapeXml(str) {
        return str.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }
});
