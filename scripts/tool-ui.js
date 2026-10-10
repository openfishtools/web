/**
 * OpenFishTools Universal ToolUI Component Kit
 * Provides a declarative, modular API for tools to construct UI elements (inputs, sliders, selects, pills, toggles)
 * without writing raw HTML tags or hardcoded class names.
 */

(function (window) {
    'use strict';

    class ToolUI {
        constructor(container) {
            if (!container) {
                throw new Error('[ToolUI] A valid container element is required.');
            }
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
        }

        /**
         * Clears all content inside the container
         */
        clear() {
            if (this.container) {
                this.container.innerHTML = '';
            }
            return this;
        }

        /**
         * Add a styled text input with icon, label, clear button, and Enter handler
         */
        addInput(options = {}) {
            const {
                id = 'tool-input-' + Math.random().toString(36).substring(2, 9),
                label = '',
                labelKey = '',
                icon = '',
                placeholder = '',
                placeholderKey = '',
                value = '',
                type = 'text',
                clearable = true,
                onInput = null,
                onChange = null,
                onEnter = null
            } = options;

            const group = document.createElement('div');
            group.className = 'tool-input-group';
            if (options.className) group.classList.add(options.className);

            if (label || labelKey) {
                const labelEl = document.createElement('label');
                labelEl.className = 'tool-input-label';
                labelEl.htmlFor = id;
                labelEl.textContent = label;
                if (labelKey) {
                    labelEl.setAttribute('data-i18n', labelKey);
                    if (window.getTranslation) labelEl.textContent = window.getTranslation(labelKey) || label;
                }
                group.appendChild(labelEl);
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'tool-input-wrapper';

            if (icon) {
                const iconEl = document.createElement('span');
                iconEl.className = 'material-symbols-rounded tool-input-icon';
                iconEl.textContent = icon;
                wrapper.appendChild(iconEl);
            }

            const inputEl = document.createElement('input');
            inputEl.id = id;
            inputEl.type = type;
            inputEl.className = 'tool-input-text';
            inputEl.placeholder = placeholder;
            inputEl.value = value;
            inputEl.autocomplete = 'off';
            if (placeholderKey) {
                inputEl.setAttribute('data-i18n-placeholder', placeholderKey);
                if (window.getTranslation) inputEl.placeholder = window.getTranslation(placeholderKey) || placeholder;
            }
            wrapper.appendChild(inputEl);

            let clearBtn = null;
            if (clearable) {
                clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'tool-input-clear-btn' + (value ? '' : ' hidden');
                clearBtn.title = 'Clear';
                clearBtn.innerHTML = '<span class="material-symbols-rounded">close</span>';

                clearBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    inputEl.value = '';
                    clearBtn.classList.add('hidden');
                    inputEl.focus();
                    if (typeof onInput === 'function') onInput('');
                    if (typeof onChange === 'function') onChange('');
                });
                wrapper.appendChild(clearBtn);
            }

            group.appendChild(wrapper);
            this.container.appendChild(group);

            inputEl.addEventListener('input', (e) => {
                const val = e.target.value;
                if (clearBtn) {
                    if (val.trim().length > 0) clearBtn.classList.remove('hidden');
                    else clearBtn.classList.add('hidden');
                }
                if (typeof onInput === 'function') onInput(val);
            });

            inputEl.addEventListener('change', (e) => {
                if (typeof onChange === 'function') onChange(e.target.value);
            });

            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (typeof onEnter === 'function') onEnter(inputEl.value, e);
                }
            });

            return {
                group,
                wrapper,
                input: inputEl,
                getValue: () => inputEl.value.trim(),
                setValue: (v) => {
                    inputEl.value = v;
                    if (clearBtn) {
                        if (String(v).trim().length > 0) clearBtn.classList.remove('hidden');
                        else clearBtn.classList.add('hidden');
                    }
                },
                focus: () => inputEl.focus(),
                clear: () => {
                    inputEl.value = '';
                    if (clearBtn) clearBtn.classList.add('hidden');
                },
                onInput: (cb) => { onInput = cb; },
                onChange: (cb) => { onChange = cb; },
                onEnter: (cb) => { onEnter = cb; }
            };
        }

        /**
         * Add an interactive range slider with dynamic value badge
         */
        addSlider(options = {}) {
            const {
                id = 'tool-slider-' + Math.random().toString(36).substring(2, 9),
                label = '',
                min = 0,
                max = 100,
                step = 1,
                value = 50,
                unit = '',
                format = null,
                onChange = null
            } = options;

            const group = document.createElement('div');
            group.className = 'tool-ui-group tool-ui-slider-group';

            const labelRow = document.createElement('div');
            labelRow.className = 'tool-ui-label-row';

            const labelEl = document.createElement('label');
            labelEl.className = 'tool-input-label';
            labelEl.htmlFor = id;
            labelEl.textContent = label;
            labelRow.appendChild(labelEl);

            const badgeEl = document.createElement('span');
            badgeEl.className = 'tool-ui-badge';
            const renderBadge = (v) => {
                if (typeof format === 'function') return format(v);
                return `${v}${unit ? ' ' + unit : ''}`;
            };
            badgeEl.textContent = renderBadge(value);
            labelRow.appendChild(badgeEl);
            group.appendChild(labelRow);

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = id;
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value;
            slider.className = 'tool-ui-slider';

            slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                badgeEl.textContent = renderBadge(val);
                if (typeof onChange === 'function') onChange(val);
            });

            group.appendChild(slider);
            this.container.appendChild(group);

            return {
                group,
                slider,
                badge: badgeEl,
                getValue: () => parseFloat(slider.value),
                setValue: (v) => {
                    slider.value = v;
                    badgeEl.textContent = renderBadge(v);
                },
                onChange: (cb) => { onChange = cb; }
            };
        }

        /**
         * Add a styled Select / Dropdown menu
         */
        addSelect(options = {}) {
            const {
                id = 'tool-select-' + Math.random().toString(36).substring(2, 9),
                label = '',
                options: opts = [],
                value = null,
                icon = '',
                onChange = null
            } = options;

            const group = document.createElement('div');
            group.className = 'tool-input-group';

            if (label) {
                const labelEl = document.createElement('label');
                labelEl.className = 'tool-input-label';
                labelEl.htmlFor = id;
                labelEl.textContent = label;
                group.appendChild(labelEl);
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'tool-input-wrapper tool-ui-select-wrapper';

            if (icon) {
                const iconEl = document.createElement('span');
                iconEl.className = 'material-symbols-rounded tool-input-icon';
                iconEl.textContent = icon;
                wrapper.appendChild(iconEl);
            }

            const select = document.createElement('select');
            select.id = id;
            select.className = 'tool-ui-select';

            opts.forEach(opt => {
                const optEl = document.createElement('option');
                if (typeof opt === 'object' && opt !== null) {
                    optEl.value = opt.value;
                    optEl.textContent = opt.label || opt.value;
                    if (opt.disabled) optEl.disabled = true;
                } else {
                    optEl.value = String(opt);
                    optEl.textContent = String(opt);
                }
                select.appendChild(optEl);
            });

            if (value !== null && value !== undefined) {
                select.value = String(value);
            }

            select.addEventListener('change', (e) => {
                if (typeof onChange === 'function') onChange(e.target.value);
            });

            wrapper.appendChild(select);

            const arrowIcon = document.createElement('span');
            arrowIcon.className = 'material-symbols-rounded tool-ui-select-arrow';
            arrowIcon.textContent = 'expand_more';
            wrapper.appendChild(arrowIcon);

            group.appendChild(wrapper);
            this.container.appendChild(group);

            return {
                group,
                select,
                getValue: () => select.value,
                setValue: (v) => { select.value = String(v); },
                onChange: (cb) => { onChange = cb; }
            };
        }

        /**
         * Add a Segmented Pills / Chips selection group
         */
        addSegmentedPills(options = {}) {
            const {
                label = '',
                labelKey = '',
                options: items = [],
                value = items.length > 0 ? (typeof items[0] === 'object' ? items[0].value : items[0]) : '',
                onChange = null
            } = options;

            const group = document.createElement('div');
            group.className = 'tool-ui-group';

            if (label || labelKey) {
                const labelEl = document.createElement('div');
                labelEl.className = 'tool-input-label';
                labelEl.textContent = label;
                if (labelKey) {
                    labelEl.setAttribute('data-i18n', labelKey);
                    if (window.getTranslation) {
                        const tr = window.getTranslation(labelKey);
                        if (tr && tr !== labelKey) labelEl.textContent = tr;
                    }
                }
                group.appendChild(labelEl);
            }

            const pillsContainer = document.createElement('div');
            pillsContainer.className = 'tool-ui-pills-row';

            let currentValue = value;
            const buttons = [];

            items.forEach(item => {
                const itemVal = typeof item === 'object' ? item.value : item;
                const itemIcon = typeof item === 'object' ? item.icon : '';
                const itemKey = typeof item === 'object' ? (item.labelKey || '') : '';
                let itemLabel = typeof item === 'object' ? (item.label || item.value) : item;

                if (itemKey && window.getTranslation) {
                    const tr = window.getTranslation(itemKey);
                    if (tr && tr !== itemKey) itemLabel = tr;
                }

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tool-ui-pill' + (itemVal === currentValue ? ' active' : '');
                btn.dataset.value = itemVal;
                if (itemKey) btn.setAttribute('data-i18n', itemKey);

                if (itemIcon) {
                    btn.innerHTML = `<span class="material-symbols-rounded tool-ui-pill-icon">${itemIcon}</span><span>${itemLabel}</span>`;
                } else {
                    btn.textContent = itemLabel;
                }

                btn.addEventListener('click', () => {
                    currentValue = itemVal;
                    buttons.forEach(b => b.classList.toggle('active', b.dataset.value === itemVal));
                    if (typeof onChange === 'function') onChange(itemVal);
                });

                buttons.push(btn);
                pillsContainer.appendChild(btn);
            });

            group.appendChild(pillsContainer);
            this.container.appendChild(group);

            return {
                group,
                getValue: () => currentValue,
                setValue: (v) => {
                    currentValue = v;
                    buttons.forEach(b => b.classList.toggle('active', b.dataset.value === v));
                },
                onChange: (cb) => { onChange = cb; }
            };
        }

        /**
         * Add a Toggle Switch
         */
        addToggle(options = {}) {
            const {
                id = 'tool-toggle-' + Math.random().toString(36).substring(2, 9),
                label = '',
                description = '',
                checked = false,
                onChange = null
            } = options;

            const row = document.createElement('div');
            row.className = 'tool-ui-toggle-row';

            const textWrap = document.createElement('div');
            textWrap.className = 'tool-ui-toggle-text';

            const labelEl = document.createElement('label');
            labelEl.className = 'tool-ui-toggle-label';
            labelEl.htmlFor = id;
            labelEl.textContent = label;
            textWrap.appendChild(labelEl);

            if (description) {
                const descEl = document.createElement('div');
                descEl.className = 'tool-ui-toggle-desc';
                descEl.textContent = description;
                textWrap.appendChild(descEl);
            }
            row.appendChild(textWrap);

            const switchEl = document.createElement('label');
            switchEl.className = 'tool-ui-switch';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.checked = !!checked;

            const slider = document.createElement('span');
            slider.className = 'tool-ui-switch-slider';

            input.addEventListener('change', (e) => {
                if (typeof onChange === 'function') onChange(e.target.checked);
            });

            switchEl.appendChild(input);
            switchEl.appendChild(slider);
            row.appendChild(switchEl);

            this.container.appendChild(row);

            return {
                row,
                input,
                getValue: () => input.checked,
                setValue: (v) => { input.checked = !!v; },
                onChange: (cb) => { onChange = cb; }
            };
        }

        /**
         * Add a styled secondary button
         */
        addButton(options = {}) {
            const {
                label = 'Button',
                icon = '',
                variant = 'tonal', // 'primary', 'tonal', 'outlined'
                onClick = null
            } = options;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `tool-ui-btn tool-ui-btn-${variant}`;

            if (icon) {
                btn.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${label}</span>`;
            } else {
                btn.textContent = label;
            }

            if (typeof onClick === 'function') {
                btn.addEventListener('click', onClick);
            }

            this.container.appendChild(btn);

            return {
                btn,
                setDisabled: (d) => { btn.disabled = !!d; },
                setText: (txt) => {
                    if (icon) {
                        btn.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${txt}</span>`;
                    } else {
                        btn.textContent = txt;
                    }
                },
                onClick: (cb) => { btn.addEventListener('click', cb); }
            };
        }

        /**
         * Add an info/warning/success alert banner
         */
        addAlert(options = {}) {
            const {
                type = 'info', // 'info', 'warning', 'error', 'success'
                message = '',
                icon = ''
            } = options;

            const defaultIcons = {
                info: 'info',
                warning: 'warning',
                error: 'error',
                success: 'check_circle'
            };

            const alertEl = document.createElement('div');
            alertEl.className = `tool-ui-alert tool-ui-alert-${type}`;
            if (!message) alertEl.classList.add('hidden');

            const iconName = icon || defaultIcons[type] || 'info';
            alertEl.innerHTML = `
                <span class="material-symbols-rounded tool-ui-alert-icon">${iconName}</span>
                <span class="tool-ui-alert-text">${message}</span>
            `;

            this.container.appendChild(alertEl);

            return {
                el: alertEl,
                setMessage: (msg, newType = null) => {
                    if (newType) {
                        alertEl.className = `tool-ui-alert tool-ui-alert-${newType}`;
                        const i = alertEl.querySelector('.tool-ui-alert-icon');
                        if (i) i.textContent = defaultIcons[newType] || 'info';
                    }
                    const text = alertEl.querySelector('.tool-ui-alert-text');
                    if (text) text.textContent = msg;
                    if (msg) alertEl.classList.remove('hidden');
                    else alertEl.classList.add('hidden');
                },
                hide: () => alertEl.classList.add('hidden'),
                show: () => alertEl.classList.remove('hidden')
            };
        }

        /**
         * Add a sub-section container card that returns another nested ToolUI instance
         */
        addSection(options = {}) {
            const { title = '', description = '' } = options;

            const card = document.createElement('div');
            card.className = 'tool-ui-section-card';

            if (title) {
                const titleEl = document.createElement('h5');
                titleEl.className = 'tool-ui-section-title';
                titleEl.textContent = title;
                card.appendChild(titleEl);
            }

            if (description) {
                const descEl = document.createElement('p');
                descEl.className = 'tool-ui-section-desc';
                descEl.textContent = description;
                card.appendChild(descEl);
            }

            const body = document.createElement('div');
            body.className = 'tool-ui-section-body';
            card.appendChild(body);

            this.container.appendChild(card);

            return new ToolUI(body);
        }

        /**
         * Add a clean custom area container for Canvas, WebGL, custom HTML
         */
        addCustomArea(options = {}) {
            const { className = '', html = '' } = options;
            const customDiv = document.createElement('div');
            customDiv.className = 'tool-ui-custom-area ' + className;
            if (html) customDiv.innerHTML = html;
            this.container.appendChild(customDiv);
            return customDiv;
        }

        /**
         * Add a styled multiline textarea
         */
        addTextarea(options = {}) {
            const {
                id = 'tool-textarea-' + Math.random().toString(36).substring(2, 9),
                label = '',
                placeholder = '',
                value = '',
                rows = 4,
                onChange = null
            } = options;

            const group = document.createElement('div');
            group.className = 'tool-input-group';

            if (label) {
                const labelEl = document.createElement('label');
                labelEl.className = 'tool-input-label';
                labelEl.htmlFor = id;
                labelEl.textContent = label;
                group.appendChild(labelEl);
            }

            const textarea = document.createElement('textarea');
            textarea.id = id;
            textarea.className = 'tool-input-text tool-input-textarea';
            textarea.placeholder = placeholder;
            textarea.value = value;
            textarea.rows = rows;

            textarea.addEventListener('input', (e) => {
                if (typeof onChange === 'function') onChange(e.target.value);
            });

            group.appendChild(textarea);
            this.container.appendChild(group);

            return {
                group,
                textarea,
                getValue: () => textarea.value,
                setValue: (v) => { textarea.value = v; },
                onChange: (cb) => { onChange = cb; }
            };
        }
    }

    window.ToolUI = ToolUI;
})(window);
