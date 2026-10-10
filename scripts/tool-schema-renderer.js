/**
 * OpenFishTools Universal Tool Schema Renderer
 * Compiles a declarative tool schema into interactive DOM controls using ToolUI.
 * Provides two-way value bindings, validation, previewing, and lifecycle management.
 */

(function (window) {
    'use strict';

    class ToolSchemaRenderer {
        constructor(tool, container, options = {}) {
            if (!container) {
                throw new Error('[ToolSchemaRenderer] A valid container is required.');
            }
            this.tool = tool;
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.ui = new window.ToolUI(this.container);
            this.options = options;
            this.fieldControls = new Map();
            this.values = {};
            this.primaryFileInput = null;
            this.previewContainer = null;
            this.logsContainer = null;
            this.logsEl = null;
        }

        render() {
            this.ui.clear();
            this.fieldControls.clear();
            this.values = {};
            this.primaryFileInput = null;
            this.previewContainer = null;
            this.logsContainer = null;
            this.logsEl = null;

            const schema = this.tool.schema || {};
            const inputs = Array.isArray(schema.inputs) ? schema.inputs : [];

            inputs.forEach(inputDef => {
                this.renderField(inputDef);
            });

            return this;
        }

        renderField(inputDef) {
            const id = inputDef.id;
            const type = inputDef.type || 'text';
            const label = this.getLabel(inputDef);
            const defaultValue = inputDef.default !== undefined ? inputDef.default : '';

            this.values[id] = defaultValue;

            // Primary file input binds to the modal's main dropzone
            if (type === 'file') {
                if (inputDef.primary !== false && !this.primaryFileInput) {
                    this.primaryFileInput = inputDef;
                    this.fieldControls.set(id, {
                        getValue: () => this.values[id] || null,
                        setValue: (val) => { this.values[id] = val; },
                        inputDef
                    });
                    return;
                }

                // Secondary file input (rendered inline)
                const fileGroup = this.ui.addInput({
                    id: `tool-field-${id}`,
                    label,
                    type: 'file',
                    accept: Array.isArray(inputDef.accept) ? inputDef.accept.join(',') : (inputDef.accept || '*/*'),
                    onChange: (file) => {
                        this.values[id] = file;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(file, this.values);
                    }
                });
                this.fieldControls.set(id, fileGroup);
                return;
            }

            if (type === 'text' || type === 'url') {
                const ctrl = this.ui.addInput({
                    id: `tool-field-${id}`,
                    label,
                    icon: inputDef.icon || (type === 'url' ? 'link' : ''),
                    placeholder: inputDef.placeholder || '',
                    placeholderKey: inputDef.placeholderKey || '',
                    value: defaultValue,
                    onInput: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onInput === 'function') inputDef.onInput(val, this.values);
                    },
                    onChange: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(val, this.values);
                    },
                    onEnter: (val) => {
                        if (typeof this.options.onEnter === 'function') this.options.onEnter(val);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'select') {
                const ctrl = this.ui.addSelect({
                    id: `tool-field-${id}`,
                    label,
                    icon: inputDef.icon || '',
                    options: inputDef.options || [],
                    value: defaultValue,
                    onChange: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(val, this.values);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'segmented') {
                const ctrl = this.ui.addSegmentedPills({
                    label,
                    options: inputDef.options || [],
                    value: defaultValue,
                    onChange: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(val, this.values);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'slider') {
                const ctrl = this.ui.addSlider({
                    id: `tool-field-${id}`,
                    label,
                    min: inputDef.min !== undefined ? inputDef.min : 0,
                    max: inputDef.max !== undefined ? inputDef.max : 100,
                    step: inputDef.step !== undefined ? inputDef.step : 1,
                    value: defaultValue,
                    unit: inputDef.unit || '',
                    format: inputDef.format || null,
                    onChange: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(val, this.values);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'toggle') {
                const ctrl = this.ui.addToggle({
                    id: `tool-field-${id}`,
                    label,
                    description: inputDef.description || '',
                    checked: !!defaultValue,
                    onChange: (checked) => {
                        this.values[id] = checked;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(checked, this.values);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'textarea') {
                const ctrl = this.ui.addTextarea({
                    id: `tool-field-${id}`,
                    label,
                    placeholder: inputDef.placeholder || '',
                    rows: inputDef.rows || 4,
                    value: defaultValue,
                    onChange: (val) => {
                        this.values[id] = val;
                        if (typeof inputDef.onChange === 'function') inputDef.onChange(val, this.values);
                    }
                });
                this.fieldControls.set(id, ctrl);
                return;
            }

            if (type === 'custom' && typeof inputDef.render === 'function') {
                const customCtrl = inputDef.render(this.ui, this.container, this.values);
                if (customCtrl) {
                    this.fieldControls.set(id, customCtrl);
                }
            }
        }

        getLabel(inputDef) {
            if (inputDef.labelKey && window.getTranslation) {
                const translated = window.getTranslation(inputDef.labelKey);
                if (translated && translated !== inputDef.labelKey) return translated;
            }
            if (typeof inputDef.label === 'object' && inputDef.label !== null) {
                const lang = window.currentLang || 'id';
                return inputDef.label[lang] || inputDef.label.en || inputDef.label.id || '';
            }
            return inputDef.label || '';
        }

        setFile(file) {
            if (this.primaryFileInput) {
                this.values[this.primaryFileInput.id] = file;
            }
        }

        getValues() {
            const result = { ...this.values };
            this.fieldControls.forEach((ctrl, id) => {
                if (ctrl && typeof ctrl.getValue === 'function') {
                    result[id] = ctrl.getValue();
                }
            });
            return result;
        }

        validate() {
            const schema = this.tool.schema || {};
            const inputs = Array.isArray(schema.inputs) ? schema.inputs : [];
            const values = this.getValues();

            for (const inputDef of inputs) {
                if (inputDef.required) {
                    const val = values[inputDef.id];
                    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                        const label = this.getLabel(inputDef) || inputDef.id;
                        return {
                            valid: false,
                            message: `Harap tentukan ${label} terlebih dahulu.`
                        };
                    }
                }
                if (inputDef.type === 'url' && values[inputDef.id]) {
                    if (typeof inputDef.validate === 'function') {
                        const check = inputDef.validate(values[inputDef.id]);
                        if (check !== true) {
                            return {
                                valid: false,
                                message: typeof check === 'string' ? check : 'URL tidak valid.'
                            };
                        }
                    }
                }
            }
            return { valid: true };
        }

        renderPreview(previewData) {
            if (!this.previewContainer) {
                this.previewContainer = document.createElement('div');
                this.previewContainer.className = 'tool-preview-card';
                this.container.prepend(this.previewContainer);
            }

            const { cover, author, title, subtitle } = previewData || {};
            this.previewContainer.innerHTML = `
                <div class="stats-preview-container">
                    ${cover ? `<div class="stats-video-cover-wrapper"><img src="${cover}" alt="Cover" class="stats-video-cover"></div>` : ''}
                    <div class="stats-preview-info">
                        ${author ? `<div class="stats-creator-name">${author}</div>` : ''}
                        ${title ? `<div class="stats-caption">${title}</div>` : ''}
                        ${subtitle ? `<div class="stats-subinfo">${subtitle}</div>` : ''}
                    </div>
                </div>
            `;
            this.previewContainer.classList.remove('hidden');

            if (typeof window.updateOpenModalsLayout === 'function') {
                window.updateOpenModalsLayout(true);
            }
        }

        renderDataOutput(data) {
            let dataContainer = document.getElementById('tool-universal-data-output');
            if (!dataContainer) {
                dataContainer = document.createElement('div');
                dataContainer.id = 'tool-universal-data-output';
                dataContainer.className = 'tool-data-output-container';
                this.container.appendChild(dataContainer);
            }

            if (typeof data === 'object' && data !== null) {
                if (data.html) {
                    dataContainer.innerHTML = data.html;
                } else if (Array.isArray(data.items)) {
                    dataContainer.innerHTML = `
                        <div class="stats-grid">
                            ${data.items.map(item => `
                                <div class="stats-metric-card">
                                    <div class="stats-metric-label">${item.label || ''}</div>
                                    <div class="stats-metric-val">${item.value || '—'}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                } else {
                    dataContainer.innerHTML = `<pre class="tool-logs-content">${JSON.stringify(data, null, 2)}</pre>`;
                }
            }
            dataContainer.classList.remove('hidden');

            if (typeof window.updateOpenModalsLayout === 'function') {
                window.updateOpenModalsLayout(true);
            }
        }

        appendLog(msg) {
            if (!this.logsContainer) {
                this.logsContainer = document.createElement('div');
                this.logsContainer.id = 'tool-universal-logs-container';
                this.logsContainer.className = 'process-logs-wrap';
                this.logsContainer.innerHTML = `
                    <div class="process-logs-header">
                        <span class="process-logs-title">${(window.getTranslation && window.getTranslation('patcher_logs_title')) || 'Process Logs'}</span>
                        <button type="button" class="btn-copy-logs" id="tool-universal-copy-logs">
                            <span class="material-symbols-rounded">content_copy</span>
                            <span>${(window.getTranslation && window.getTranslation('res_modal_copy')) || 'Copy'}</span>
                        </button>
                    </div>
                    <pre id="tool-universal-logs" class="process-logs-pre"></pre>
                `;
                this.container.appendChild(this.logsContainer);
                this.logsEl = this.logsContainer.querySelector('#tool-universal-logs');

                const copyBtn = this.logsContainer.querySelector('#tool-universal-copy-logs');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        if (this.logsEl && this.logsEl.textContent) {
                            navigator.clipboard.writeText(this.logsEl.textContent);
                            if (typeof window.showToast === 'function') {
                                window.showToast((window.getTranslation && window.getTranslation('logs_copied')) || 'Logs copied to clipboard');
                            }
                        }
                    });
                }
            }
            this.logsContainer.classList.remove('hidden');
            if (this.logsEl) {
                this.logsEl.textContent += (this.logsEl.textContent ? '\n' : '') + msg;
                this.logsEl.scrollTop = this.logsEl.scrollHeight;
            }
        }

        clearLogs() {
            if (this.logsEl) {
                this.logsEl.textContent = '';
            }
            if (this.logsContainer) {
                this.logsContainer.classList.add('hidden');
            }
        }
    }

    window.ToolSchemaRenderer = ToolSchemaRenderer;

})(window);
