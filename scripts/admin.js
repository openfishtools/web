document.addEventListener('DOMContentLoaded', async () => {
    const adminLogin = document.getElementById('admin-login');
    const adminApp = document.getElementById('admin-app');
    const loginBtn = document.getElementById('admin-login-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    const API_URL = (location.protocol === 'file:' || (location.port && !['5000', '80', '443', ''].includes(location.port)))
        ? 'http://localhost:5000/api'
        : '/api';
    const ensureProtocol = (url) => {
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) return url;
        return `https://${url}`;
    };
    const TOKEN_KEY = 'chros_admin_token';
    let adminToken = sessionStorage.getItem(TOKEN_KEY);

    const persistToken = (token) => {
        adminToken = token;
        if (token) sessionStorage.setItem(TOKEN_KEY, token);
        else sessionStorage.removeItem(TOKEN_KEY);
    };

    const showLoginUI = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        adminLogin.classList.remove('d-none');
        adminLogin.dataset.loading = 'false';
        adminApp.classList.add('d-none');
    };

    const showLoadingUI = () => {
        adminLogin.classList.remove('d-none');
        adminLogin.dataset.loading = 'true';
        adminApp.classList.add('d-none');
    };

    const showAppUI = () => {
        adminLogin.classList.add('d-none');
        adminLogin.dataset.loading = 'false';
        adminApp.classList.remove('d-none');
    };

    const adminAuthHeaders = (base = {}) => ({
        ...base,
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    });

    const jsonHeaders = () => adminAuthHeaders({ 'Content-Type': 'application/json' });

    const formatIconUrl = (url) => {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('assets/') || url.startsWith('/')) {
            return url;
        }
        if (url.includes('.')) {
            return `https://${url}`;
        }
        return url;
    };

    const thumbUrl = (url, width = 64) => {
        return formatIconUrl(url);
    };

    let isUnauthorizedAlertShowing = false;

    const onUnauthorized = () => {
        if (isUnauthorizedAlertShowing) return;
        isUnauthorizedAlertShowing = true;
        persistToken(null);
        showLoginUI();
        alert('Session expired or unauthorized. Please log in again.');
        isUnauthorizedAlertShowing = false;
    };

    const handleHashNavigation = () => {
        const hash = window.location.hash.substring(1) || 'social';
        const targetTab = document.querySelector(`.nav-item[data-tab="${hash}"]`);
        if (targetTab) {
            navItems.forEach(nav => nav.classList.remove('active'));
            targetTab.classList.add('active');
            const target = targetTab.getAttribute('data-tab');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === target) sec.classList.add('active');
            });
        }
    };

    const check401 = (res) => {
        if (res.status === 401) {
            onUnauthorized();
            return true;
        }
        return false;
    };

    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('admin-user').value.trim();
        const password = document.getElementById('admin-pass').value;
        try {
            const res = await fetch(`${API_URL}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Login failed');
                return;
            }
            persistToken(data.token);
            showAppUI();
            await initAdmin();
        } catch (err) {
            alert('Connection error. Is the server running?');
        }
    });

    document.getElementById('admin-pass')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
    });

    document.getElementById('admin-logout-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('Are you sure you want to logout?')) return;
        try {
            await fetch(`${API_URL}/admin/logout`, {
                method: 'POST',
                headers: adminAuthHeaders()
            });
        } catch (err) {}
        persistToken(null);
        showLoginUI();
    });

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModal(btn.getAttribute('data-modal'));
        });
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-tab');
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === target) sec.classList.add('active');
            });
            if (history.pushState) {
                history.pushState(null, null, `#${target}`);
            } else {
                location.hash = `#${target}`;
            }
            const isContactTab = target === 'contact';
        });
    });

    const initIconSourceToggles = () => {
        const btnSocialStock = document.getElementById('btn-social-icon-stock');
        const btnSocialCustom = document.getElementById('btn-social-icon-custom');
        const socialStockContainer = document.getElementById('social-stock-icon-container');
        const socialCustomContainer = document.getElementById('social-custom-icon-container');

        if (btnSocialStock && btnSocialCustom) {
            btnSocialStock.onclick = () => {
                btnSocialStock.classList.add('active');
                btnSocialCustom.classList.remove('active');
                socialStockContainer.classList.remove('d-none');
                socialCustomContainer.classList.add('d-none');
            };
            btnSocialCustom.onclick = () => {
                btnSocialCustom.classList.add('active');
                btnSocialStock.classList.remove('active');
                socialStockContainer.classList.add('d-none');
                socialCustomContainer.classList.remove('d-none');
            };
        }

        const btnContactStock = document.getElementById('btn-contact-icon-stock');
        const btnContactCustom = document.getElementById('btn-contact-icon-custom');
        const contactStockContainer = document.getElementById('contact-stock-icon-container');
        const contactCustomContainer = document.getElementById('contact-custom-icon-container');

        if (btnContactStock && btnContactCustom) {
            btnContactStock.onclick = () => {
                btnContactStock.classList.add('active');
                btnContactCustom.classList.remove('active');
                contactStockContainer.classList.remove('d-none');
                contactCustomContainer.classList.add('d-none');
            };
            btnContactCustom.onclick = () => {
                btnContactCustom.classList.add('active');
                btnContactStock.classList.remove('active');
                contactStockContainer.classList.add('d-none');
                contactCustomContainer.classList.remove('d-none');
            };
        }
    };

    let heartbeatInterval = null;
    let lastActivityTime = Date.now();

    const resetActivityTimer = () => {
        lastActivityTime = Date.now();
    };

    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'].forEach(evt => {
        window.addEventListener(evt, resetActivityTimer, { passive: true });
    });

    const startHeartbeat = () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        lastActivityTime = Date.now();

        heartbeatInterval = setInterval(async () => {
            if (!adminToken) {
                clearInterval(heartbeatInterval);
                return;
            }

            const idleMs = Date.now() - lastActivityTime;
            if (idleMs >= 28800000) {
                clearInterval(heartbeatInterval);
                persistToken(null);
                showLoginUI();
                alert('Session expired due to inactivity.');
                return;
            }

            try {
                const res = await fetch(`${API_URL}/admin/heartbeat`, {
                    method: 'POST',
                    headers: adminAuthHeaders()
                });
                if (res.status === 401) {
                    clearInterval(heartbeatInterval);
                    onUnauthorized();
                }
            } catch (err) {}
        }, 60000);
    };

    window.addEventListener('hashchange', handleHashNavigation);

    const verifySession = async () => {
        if (!adminToken) return false;
        try {
            const res = await fetch(`${API_URL}/admin/session`, { headers: adminAuthHeaders() });
            if (!res.ok) {
                persistToken(null);
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    };

    const initAdmin = async () => {
        const valid = await verifySession();
        if (!valid) {
            persistToken(null);
            showLoginUI();
            return;
        }
        await loadSocials();
        await loadPresets();
        await loadResources();
        await loadContacts();
        initModalTriggers();
        initBadgePickers();
        initCustomBadgePopups();
        initResourceBadgePickers();
        initIconSourceToggles();

        handleHashNavigation();
        startHeartbeat();
    };

    const initModalTriggers = () => {
        document.getElementById('open-social-modal').onclick = () => openModal('social-modal');
        document.getElementById('open-contact-modal').onclick = () => openModal('contact-modal');
        document.getElementById('open-preset-modal').onclick = () => {
            resetPresetModal();
            openModal('preset-modal');
        };
        document.getElementById('open-resource-modal').onclick = () => openModal('resource-modal');
    };

    const STATIC_SW_KEYS = ['FishTools Studio', 'FTS', 'AE', 'AM', 'Blurr', 'CC', 'FM', 'Node'];
    const STATIC_PLUGIN_NAMES = ['After Codecs', 'Animation Composer', 'BCC', 'Element 3D', 'Flow', 'FX Console', 'Red Giant Universe', 'Sapphire', 'Omino', 'Twixtor & RSMB', 'Signal', 'Trapcode', 'Twitch', 'Magic Bullet Suite'];

    const resetPresetModal = () => {
        const swPicker = document.getElementById('sw-badge-picker');
        const pluginPicker = document.getElementById('plugin-badge-picker');

        swPicker?.querySelectorAll('.sw-badge-preset').forEach(b => {
            if (!STATIC_SW_KEYS.includes(b.dataset.sw)) {
                b.remove();
            } else {
                b.classList.remove('selected');
            }
        });

        pluginPicker?.querySelectorAll('.sw-badge-preset').forEach(b => {
            if (!STATIC_PLUGIN_NAMES.includes(b.dataset.plugin)) {
                b.remove();
            } else {
                b.classList.remove('selected');
            }
        });

        const dlContainer = document.getElementById('preset-download-links-container');
        if (dlContainer) dlContainer.innerHTML = '<p class="no-sw-selected-hint">Select software above to add download links.</p>';
        ['modal-preset-name', 'modal-preset-version', 'modal-preset-video', 'modal-preset-size'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const fieldVer = document.getElementById('field-preset-version');
        const fieldSize = document.getElementById('field-preset-size');
        const fieldPlugin = document.getElementById('field-preset-plugin');
        if (fieldVer) fieldVer.style.display = '';
        if (fieldSize) fieldSize.style.display = '';
        if (fieldPlugin) fieldPlugin.style.display = '';
    };

    const attachBadgeRemoveBtn = (badge, isSoftware = true) => {
        let removeBtn = badge.querySelector('.remove-badge-btn');
        if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-badge-btn';
            removeBtn.title = 'Remove';
            removeBtn.innerHTML = '×';
            badge.appendChild(removeBtn);
        }
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            const isStaticSw = STATIC_SW_KEYS.includes(badge.dataset.sw);
            const isStaticPlugin = STATIC_PLUGIN_NAMES.includes(badge.dataset.plugin);
            if (isStaticSw || isStaticPlugin) {
                badge.classList.remove('selected');
                if (isSoftware) syncDownloadLinkRows();
                return;
            }
            badge.remove();
            if (isSoftware) syncDownloadLinkRows();
        };
    };

    const initBadgePickers = () => {
        document.querySelectorAll('#sw-badge-picker .sw-badge-preset').forEach(badge => {
            attachBadgeRemoveBtn(badge, true);
            badge.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-badge-btn') || e.target.closest('.remove-badge-btn')) return;
                badge.classList.toggle('selected');
                syncDownloadLinkRows();
            });
        });
        document.querySelectorAll('#plugin-badge-picker .sw-badge-preset').forEach(badge => {
            attachBadgeRemoveBtn(badge, false);
            badge.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-badge-btn') || e.target.closest('.remove-badge-btn')) return;
                badge.classList.toggle('selected');
            });
        });
    };

    const syncDownloadLinkRows = () => {
        const dlContainer = document.getElementById('preset-download-links-container');
        if (!dlContainer) return;
        const selected = document.querySelectorAll('#sw-badge-picker .sw-badge-preset.selected');
        if (selected.length === 0) {
            dlContainer.innerHTML = '<p class="no-sw-selected-hint">Select software above to add download links.</p>';
            return;
        }
        const existingUrls = {};
        let amPremium = '';
        let am5mb = '';
        let amXml = '';
        let amXmlExtras = [];

        const premiumEl = document.getElementById('am-premium-url');
        if (premiumEl) amPremium = premiumEl.value;
        const fivembEl = document.getElementById('am-5mb-url');
        if (fivembEl) am5mb = fivembEl.value;
        const xmlEl = document.getElementById('am-xml-url');
        if (xmlEl) amXml = xmlEl.value;
        
        document.querySelectorAll('#am-xml-extras-list .am-xml-extra-row').forEach(row => {
            const label = row.querySelector('.am-xml-extra-label')?.value || '';
            const url = row.querySelector('.am-xml-extra-url')?.value || '';
            if (label || url) amXmlExtras.push({ label, url });
        });

        dlContainer.querySelectorAll('.preset-dl-link-row').forEach(row => {
            const key = row.dataset.sw;
            if (key !== 'AM') {
                const val = row.querySelector('input[type="text"]')?.value || '';
                if (key) existingUrls[key] = val;
            }
        });
        dlContainer.innerHTML = '';
        selected.forEach(badge => {
            const sw = badge.dataset.sw;
            const icon = badge.dataset.icon || '';
            const label = badge.dataset.label || sw;
            
            if (sw === 'AM') {
                const row = document.createElement('div');
                row.className = 'preset-dl-link-row';
                row.dataset.sw = sw;
                row.style.flexDirection = 'column';
                row.style.alignItems = 'stretch';
                row.style.gap = '8px';
                row.style.width = '100%';
                row.style.border = '1px solid var(--md-sys-color-outline-variant)';
                row.style.padding = '12px';
                row.style.borderRadius = '8px';
                row.style.marginTop = '8px';
                
                row.innerHTML = `
                    <div class="sw-link-badge" style="margin-bottom: 8px;">
                        <img src="${icon}" alt="${sw}">
                        <span>Alight Motion Links</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <div class="input-field" style="margin-bottom: 4px;">
                            <label style="font-size: 11px; display: block; margin-bottom: 2px;">Premium Link</label>
                            <input type="text" id="am-premium-url" placeholder="https://... (Premium Link)" value="${amPremium.replace(/"/g, '&quot;')}" style="width: 100%;">
                        </div>
                        <div class="input-field" style="margin-bottom: 4px;">
                            <label style="font-size: 11px; display: block; margin-bottom: 2px;">5MB Link</label>
                            <input type="text" id="am-5mb-url" placeholder="https://... (5MB Link)" value="${am5mb.replace(/"/g, '&quot;')}" style="width: 100%;">
                        </div>
                        <div class="input-field" style="margin-bottom: 4px;">
                            <label style="font-size: 11px; display: block; margin-bottom: 2px;">XML Link</label>
                            <input type="text" id="am-xml-url" placeholder="https://... (XML Link)" value="${amXml.replace(/"/g, '&quot;')}" style="width: 100%;">
                        </div>
                        
                        <div class="xml-extras-container" style="margin-top: 8px; border-top: 1px dashed var(--md-sys-color-outline-variant); padding-top: 8px;">
                            <label style="font-size: 11px; display: block; margin-bottom: 4px; font-weight: bold;">XML Additional Links (Files)</label>
                            <div id="am-xml-extras-list"></div>
                            <button type="button" class="btn-text" id="add-am-xml-extra-btn" style="padding: 4px 8px; font-size: 11px; margin-top: 4px;">
                                <span class="material-symbols-rounded" style="font-size: 14px; vertical-align: middle;">add</span> Add Link
                            </button>
                        </div>
                    </div>
                `;
                dlContainer.appendChild(row);

                const listContainer = row.querySelector('#am-xml-extras-list');
                const addExtraRow = (labelVal = '', urlVal = '') => {
                    const extraRow = document.createElement('div');
                    extraRow.className = 'am-xml-extra-row';
                    extraRow.style.display = 'flex';
                    extraRow.style.gap = '8px';
                    extraRow.style.marginBottom = '4px';
                    extraRow.style.alignItems = 'center';
                    extraRow.style.width = '100%';
                    extraRow.innerHTML = `
                        <input type="text" class="am-xml-extra-label" placeholder="Label (e.g. Audio)" style="width: 30%;" value="${labelVal.replace(/"/g, '&quot;')}">
                        <input type="text" class="am-xml-extra-url" placeholder="https://..." style="width: 60%;" value="${urlVal.replace(/"/g, '&quot;')}">
                        <button type="button" class="remove-extra-btn" style="background: none; border: none; color: var(--md-sys-color-error); cursor: pointer; font-size: 18px; padding: 0 4px;">&times;</button>
                    `;
                    extraRow.querySelector('.remove-extra-btn').onclick = () => extraRow.remove();
                    listContainer.appendChild(extraRow);
                };

                if (amXmlExtras.length > 0) {
                    amXmlExtras.forEach(extra => addExtraRow(extra.label, extra.url));
                }

                row.querySelector('#add-am-xml-extra-btn').onclick = () => addExtraRow();
            } else {
                const inputId = `dl-input-${sw}`;
                const row = document.createElement('div');
                row.className = 'preset-dl-link-row';
                row.dataset.sw = sw;
                row.innerHTML = `
                    <div class="sw-link-badge">
                        ${icon ? `<img src="${icon}" alt="${sw}">` : `<span class="material-symbols-rounded" style="font-size:14px;">apps</span>`}
                        <span>${label}</span>
                    </div>
                    <div class="dl-input-wrap">
                        <input type="text" id="${inputId}" placeholder="https://..." value="${existingUrls[sw] || ''}" style="width: 100%;">
                    </div>
                `;
                dlContainer.appendChild(row);

                if (sw === 'FishTools Studio') {
                    const ftsInput = row.querySelector('input');
                    const fetchFtsMeta = async () => {
                        const rawVal = ftsInput?.value?.trim() || '';
                        if (!rawVal) return;
                        // Extract project ID from URL or raw ID (e.g. https://studio.cutefish.my.id/e4TCAp or studio.cutefish.my.id/e4TCAp or e4TCAp)
                        let match = rawVal.match(/(?:studio\.cutefish\.my\.id\/|id=)([a-zA-Z0-9_-]+)/);
                        let projId = match ? match[1] : (rawVal.includes('/') ? rawVal.split('/').filter(Boolean).pop() : rawVal);
                        if (!projId || projId.length < 3) return;
                        try {
                            const res = await fetch(`https://studio.cutefish.my.id/api/project?id=${projId}`);
                            if (res.ok) {
                                const data = await res.json();
                                if (data?.success && data?.project) {
                                    const sizeEl = document.getElementById('modal-preset-size');
                                    if (sizeEl && data.project.size) {
                                        sizeEl.value = data.project.size;
                                    }
                                    const nameEl = document.getElementById('modal-preset-name');
                                    if (nameEl && !nameEl.value.trim() && data.project.name) {
                                        nameEl.value = data.project.name;
                                    }
                                    console.log('FishTools Studio project metadata fetched:', data.project);
                                }
                            }
                        } catch (err) {
                            console.warn('Failed to fetch FishTools Studio project data:', err);
                        }
                    };
                    ftsInput?.addEventListener('blur', fetchFtsMeta);
                    ftsInput?.addEventListener('change', fetchFtsMeta);
                }
            }
        });

        const selectedSwKeys = Array.from(selected).map(b => b.dataset.sw);
        const onlyFts = selectedSwKeys.length === 1 && selectedSwKeys[0] === 'FishTools Studio';
        const fieldVer = document.getElementById('field-preset-version');
        const fieldSize = document.getElementById('field-preset-size');
        const fieldPlugin = document.getElementById('field-preset-plugin');

        if (fieldVer) fieldVer.style.display = onlyFts ? 'none' : '';
        if (fieldSize) fieldSize.style.display = onlyFts ? 'none' : '';
        if (fieldPlugin) fieldPlugin.style.display = onlyFts ? 'none' : '';
    };

    const getSelectedSoftware = () => {
        const selected = [];
        document.querySelectorAll('#sw-badge-picker .sw-badge-preset.selected').forEach(b => {
            selected.push(b.dataset.sw);
        });
        return selected;
    };

    const getSelectedPlugins = () => {
        const selected = [];
        document.querySelectorAll('#plugin-badge-picker .sw-badge-preset.selected').forEach(b => {
            selected.push(b.dataset.plugin);
        });
        return selected.join(', ');
    };

    const getDownloadLinks = () => {
        const links = [];
        document.querySelectorAll('#preset-download-links-container .preset-dl-link-row').forEach(row => {
            const sw = row.dataset.sw;
            const url = row.querySelector('input')?.value?.trim() || '';
            if (sw) links.push({ sw, url });
        });
        return links;
    };

    const initCustomBadgePopups = () => {
        const badgePopup = document.getElementById('custom-badge-popup');
        const pluginPopup = document.getElementById('custom-plugin-popup');
        let customBadgeIconUrl = '';

        const resetCustomBadgeIcon = () => {
            customBadgeIconUrl = '';
            const urlInput = document.getElementById('custom-badge-icon-url');
            if (urlInput) urlInput.value = '';
        };

        document.getElementById('custom-badge-icon-url')?.addEventListener('input', (e) => {
            customBadgeIconUrl = e.target.value.trim();
        });

        document.getElementById('open-custom-badge-popup')?.addEventListener('click', (e) => {
            e.stopPropagation();
            badgePopup.classList.add('show');
        });
        document.getElementById('cancel-custom-badge')?.addEventListener('click', () => {
            badgePopup.classList.remove('show');
            resetCustomBadgeIcon();
        });
        document.getElementById('confirm-custom-badge')?.addEventListener('click', () => {
            let icon = customBadgeIconUrl || document.getElementById('custom-badge-icon-url')?.value?.trim() || '';
            if (icon.startsWith('assets/')) icon = '/' + icon;
            const label = document.getElementById('custom-badge-label')?.value?.trim();
            const key = document.getElementById('custom-badge-key')?.value?.trim();
            if (!label || !key) { alert('Please fill in the software name and key.'); return; }
            const picker = document.getElementById('sw-badge-picker');
            const addBtn = picker.querySelector('.sw-badge-add-btn');
            const newBadge = document.createElement('div');
            newBadge.className = 'sw-badge-preset';
            newBadge.dataset.sw = key;
            newBadge.dataset.icon = icon;
            newBadge.dataset.label = label;
            newBadge.innerHTML = `
                ${icon ? `<img src="${icon}" alt="${key}">` : `<span class="material-symbols-rounded" style="font-size:16px">apps</span>`}
                <span>${label}</span>
            `;
            attachBadgeRemoveBtn(newBadge, true);
            newBadge.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-badge-btn') || e.target.closest('.remove-badge-btn')) return;
                newBadge.classList.toggle('selected');
                syncDownloadLinkRows();
            });
            picker.insertBefore(newBadge, addBtn);
            resetCustomBadgeIcon();
            document.getElementById('custom-badge-label').value = '';
            document.getElementById('custom-badge-key').value = '';
            badgePopup.classList.remove('show');
        });

        document.getElementById('open-custom-plugin-popup')?.addEventListener('click', (e) => {
            e.stopPropagation();
            pluginPopup.classList.add('show');
        });
        document.getElementById('cancel-custom-plugin')?.addEventListener('click', () => {
            pluginPopup.classList.remove('show');
        });
        document.getElementById('confirm-custom-plugin')?.addEventListener('click', () => {
            const label = document.getElementById('custom-plugin-label')?.value?.trim();
            if (!label) { alert('Please enter a plugin name.'); return; }
            const picker = document.getElementById('plugin-badge-picker');
            const addBtn = picker.querySelector('.sw-badge-add-btn');
            const newBadge = document.createElement('div');
            newBadge.className = 'sw-badge-preset plugin-badge';
            newBadge.dataset.plugin = label;
            newBadge.innerHTML = `<span class="material-symbols-rounded">extension</span><span>${label}</span>`;
            attachBadgeRemoveBtn(newBadge, false);
            newBadge.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-badge-btn') || e.target.closest('.remove-badge-btn')) return;
                newBadge.classList.toggle('selected');
            });
            picker.insertBefore(newBadge, addBtn);
            document.getElementById('custom-plugin-label').value = '';
            pluginPopup.classList.remove('show');
        });
    };

    window.openModal = (id, editData = null) => {
        const modal = document.getElementById(id);
        modal.style.willChange = 'opacity';
        modal.classList.add('show');
        setTimeout(() => { modal.style.willChange = ''; }, 450);
        if (editData) {
            modal.dataset.editIndex = editData.index;
            if (id === 'social-modal') {
                document.getElementById('modal-social-name').value = editData.name;
                document.getElementById('modal-social-url').value = editData.url;
                
                const iconVal = editData.icon || '';
                if (iconVal.startsWith('bi-') || iconVal.startsWith('ms-')) {
                    document.getElementById('btn-social-icon-stock').click();
                    document.getElementById('modal-social-icon-select').value = iconVal;
                    document.getElementById('modal-social-icon').value = '';
                } else {
                    document.getElementById('btn-social-icon-custom').click();
                    document.getElementById('modal-social-icon').value = iconVal;
                }
                
                const preview = document.getElementById('social-icon-preview');
                const area = document.getElementById('social-icon-drop');
                const imgPreview = document.getElementById('social-icon-img-preview');

                if (iconVal && (iconVal.startsWith('http') || iconVal.includes('/'))) {
                    if (area) area.classList.add('has-file');
                    if (imgPreview) imgPreview.src = iconVal;
                    if (preview) preview.innerHTML = `<img src="${iconVal}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;margin-top:10px;">`;
                } else {
                    if (area) area.classList.remove('has-file');
                    if (imgPreview) imgPreview.src = '';
                    if (preview) preview.innerHTML = '';
                }
            } else if (id === 'contact-modal') {
                document.getElementById('modal-contact-name').value = editData.name || '';
                document.getElementById('modal-contact-url').value = editData.url || '';
                
                const iconVal = editData.icon || '';
                if (iconVal.startsWith('bi-') || iconVal.startsWith('ms-')) {
                    document.getElementById('btn-contact-icon-stock').click();
                    document.getElementById('modal-contact-icon-select').value = iconVal;
                    document.getElementById('modal-contact-icon').value = '';
                } else {
                    document.getElementById('btn-contact-icon-custom').click();
                    document.getElementById('modal-contact-icon').value = iconVal;
                }

            } else if (id === 'preset-modal') {
                document.getElementById('modal-preset-name').value = editData.name;

                const softwareArr = Array.isArray(editData.software) ? editData.software : (editData.software ? [editData.software] : []);
                document.querySelectorAll('#sw-badge-picker .sw-badge-preset').forEach(b => {
                    b.classList.toggle('selected', softwareArr.includes(b.dataset.sw));
                });

                const pluginStr = editData.plugin || '';
                const pluginArr = pluginStr.split(',').map(s => s.trim()).filter(Boolean);
                document.querySelectorAll('#plugin-badge-picker .sw-badge-preset').forEach(b => {
                    b.classList.toggle('selected', pluginArr.includes(b.dataset.plugin));
                });

                syncDownloadLinkRows();

                if (softwareArr.includes('AM')) {
                    if (document.getElementById('am-premium-url')) document.getElementById('am-premium-url').value = editData.amPremiumUrl || '';
                    if (document.getElementById('am-5mb-url')) document.getElementById('am-5mb-url').value = editData.am5MbUrl || '';
                    if (document.getElementById('am-xml-url')) document.getElementById('am-xml-url').value = editData.amXmlUrl || '';
                    
                    const listContainer = document.getElementById('am-xml-extras-list');
                    if (listContainer && Array.isArray(editData.amXmlExtras)) {
                        listContainer.innerHTML = '';
                        editData.amXmlExtras.forEach(extra => {
                            const extraRow = document.createElement('div');
                            extraRow.className = 'am-xml-extra-row';
                            extraRow.style.display = 'flex';
                            extraRow.style.gap = '8px';
                            extraRow.style.marginBottom = '4px';
                            extraRow.style.alignItems = 'center';
                            extraRow.style.width = '100%';
                            extraRow.innerHTML = `
                                <input type="text" class="am-xml-extra-label" placeholder="Label (e.g. Audio)" style="width: 30%;" value="${(extra.label || '').replace(/"/g, '&quot;')}">
                                <input type="text" class="am-xml-extra-url" placeholder="https://..." style="width: 60%;" value="${(extra.url || '').replace(/"/g, '&quot;')}">
                                <button type="button" class="remove-extra-btn" style="background: none; border: none; color: var(--md-sys-color-error); cursor: pointer; font-size: 18px; padding: 0 4px;">&times;</button>
                            `;
                            extraRow.querySelector('.remove-extra-btn').onclick = () => extraRow.remove();
                            listContainer.appendChild(extraRow);
                        });
                    }
                }

                if (Array.isArray(editData.urls)) {
                    editData.urls.forEach(entry => {
                        const row = document.querySelector(`#preset-download-links-container .preset-dl-link-row[data-sw="${entry.sw}"]`);
                        if (row) { const inp = row.querySelector('input'); if (inp) inp.value = entry.url || ''; }
                    });
                } else if (editData.url) {
                    const firstRow = document.querySelector('#preset-download-links-container .preset-dl-link-row input');
                    if (firstRow) firstRow.value = editData.url;
                }

                if (document.getElementById('modal-preset-version')) document.getElementById('modal-preset-version').value = editData.version || '';
                if (document.getElementById('modal-preset-video')) document.getElementById('modal-preset-video').value = editData.media || '';
                if (document.getElementById('modal-preset-size')) document.getElementById('modal-preset-size').value = editData.size || '';
            } else if (id === 'resource-modal') {
                document.getElementById('modal-resource-title').value = editData.title;
                document.getElementById('modal-resource-category').value = editData.category || 'App';
                document.getElementById('modal-resource-dev').value = editData.dev || '';
                document.getElementById('modal-resource-version').value = editData.version || '';
                document.getElementById('modal-resource-info').value = editData.info || '';
                const iconInput = document.getElementById('modal-resource-icon');
                iconInput.value = editData.icon || '';
                const preview = document.getElementById('resource-icon-preview');
                const area = document.getElementById('resource-icon-drop');
                const imgPreview = document.getElementById('resource-icon-img-preview');

                if (editData.icon && (editData.icon.startsWith('http') || editData.icon.includes('/'))) {
                    if (area) area.classList.add('has-file');
                    if (imgPreview) imgPreview.src = editData.icon;
                    if (preview) preview.innerHTML = `<img src="${editData.icon}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;margin-top:10px;">`;
                } else {
                    if (area) area.classList.remove('has-file');
                    if (imgPreview) imgPreview.src = '';
                    if (preview) preview.innerHTML = '';
                }

                document.getElementById('modal-resource-os').value = editData.os || 'WIN';
                
                const urlInput = document.getElementById('modal-resource-url');
                urlInput.value = editData.url || '';
                
                const descEl = document.getElementById('modal-resource-desc');
                if (descEl) descEl.value = editData.desc || '';

            }
        } else {
            delete modal.dataset.editIndex;
            if (id === 'preset-modal') {
                resetPresetModal();
            } else {
                modal.querySelectorAll('input:not([type="file"]):not([type="hidden"]), select, textarea').forEach(i => i.value = '');
                modal.querySelectorAll('.file-preview').forEach(p => p.textContent = '');
            }
            if (id === 'resource-modal') {
                document.getElementById('delete-uploaded-resource-btn')?.classList.add('hidden');
                document.getElementById('delete-uploaded-resource-icon-btn')?.classList.add('hidden');
                const rDrop = document.getElementById('resource-icon-drop');
                const rImg = document.getElementById('resource-icon-img-preview');
                if (rDrop) rDrop.classList.remove('has-file');
                if (rImg) { rImg.src = ''; rImg.removeAttribute('src'); }
                document.getElementById('modal-resource-icon').value = '';
            } else if (id === 'social-modal') {
                document.getElementById('delete-uploaded-social-icon-btn')?.classList.add('hidden');
                const sDrop = document.getElementById('social-icon-drop');
                const sImg = document.getElementById('social-icon-img-preview');
                if (sDrop) sDrop.classList.remove('has-file');
                if (sImg) { sImg.src = ''; sImg.removeAttribute('src'); }
                document.getElementById('modal-social-icon').value = '';
                document.getElementById('btn-social-icon-stock').click();
                document.getElementById('modal-social-icon-select').selectedIndex = 0;
            } else if (id === 'contact-modal') {
                document.getElementById('btn-contact-icon-stock').click();
                document.getElementById('modal-contact-icon-select').selectedIndex = 0;
                document.getElementById('modal-contact-icon').value = '';
            }
        }
    };

    window.closeModal = async (id) => {
        const modal = document.getElementById(id);
        modal.style.willChange = 'opacity';
        modal.classList.remove('show');
        setTimeout(() => { modal.style.willChange = ''; }, 300);
    };

    const reorderItem = async (type, list, index, direction, reloadFn) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const updatedList = [...list];
        const temp = updatedList[index];
        updatedList[index] = updatedList[targetIndex];
        updatedList[targetIndex] = temp;

        const itemsToUpdate = updatedList.map((item, idx) => ({ id: item._id, order: idx }));

        try {
            const res = await fetch(`${API_URL}/${type}/reorder`, {
                method: 'PUT',
                headers: jsonHeaders(),
                body: JSON.stringify({ items: itemsToUpdate })
            });
            if (!res.ok) throw new Error('Reorder failed');
            reloadFn();
        } catch (err) {
            alert('Failed to update order: ' + err.message);
        }
    };

    const toggleHideItem = async (type, id, currentHiddenStatus, reloadFn) => {
        try {
            const res = await fetch(`${API_URL}/${type}/${id}`, {
                method: 'PUT',
                headers: jsonHeaders(),
                body: JSON.stringify({ hidden: !currentHiddenStatus })
            });
            if (!res.ok) throw new Error('Visibility update failed');
            reloadFn();
        } catch (err) {
            alert('Failed to update visibility: ' + err.message);
        }
    };

    const loadSocials = async () => {
        if (!adminToken) return;
        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        const body = document.getElementById('social-table-body');
        body.innerHTML = socials.map((s, idx) => {
            const iconHtml = (s.icon && (s.icon.startsWith('http') || s.icon.includes('/')))
                ? `<img src="${thumbUrl(s.icon, 64)}" class="admin-table-icon" alt="${s.name}" loading="lazy">`
                : (s.icon && s.icon.startsWith('bi-'))
                    ? `<span class="brand-icon ${s.icon}"></span>`
                    : (s.icon && s.icon.startsWith('ms-'))
                        ? `<span class="material-symbols-rounded">${s.icon.substring(3)}</span>`
                        : `<span class="material-symbols-rounded">${s.icon || 'public'}</span>`;
            
            const isHidden = !!s.hidden;
            const hiddenBadge = isHidden ? `<span class="badge-hidden"><span class="material-symbols-rounded" style="font-size:12px">visibility_off</span>Hidden</span>` : '';
            const hideIcon = isHidden ? 'visibility_off' : 'visibility';
            const hideTitle = isHidden ? 'Show item' : 'Hide item';

            return `
            <tr data-id="${s._id}" class="${isHidden ? 'table-row-hidden' : ''}">
                <td>${iconHtml}</td>
                <td>${s.name}${hiddenBadge}</td>
                <td><a href="${ensureProtocol(s.url)}" target="_blank" class="table-link">${s.url}</a></td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon move-up ${idx === 0 ? 'disabled' : ''}" title="Move Up">arrow_upward</span>
                    <span class="material-symbols-rounded action-icon move-down ${idx === socials.length - 1 ? 'disabled' : ''}" title="Move Down">arrow_downward</span>
                    <span class="material-symbols-rounded action-icon toggle-hide" title="${hideTitle}">${hideIcon}</span>
                    <span class="material-symbols-rounded action-icon edit-social">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-social">delete</span>
                </td>
            </tr>
        `}).join('');
        body.querySelectorAll('.move-up:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = socials.findIndex(item => item._id === tr.dataset.id);
                reorderItem('socials', socials, i, -1, loadSocials);
            };
        });
        body.querySelectorAll('.move-down:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = socials.findIndex(item => item._id === tr.dataset.id);
                reorderItem('socials', socials, i, 1, loadSocials);
            };
        });
        body.querySelectorAll('.toggle-hide').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const item = socials.find(s => s._id === tr.dataset.id);
                if (item) toggleHideItem('socials', item._id, item.hidden, loadSocials);
            };
        });
        body.querySelectorAll('.edit-social').forEach(btn => { btn.onclick = () => editSocial(btn.closest('tr').dataset.id); });
        body.querySelectorAll('.delete-social').forEach(btn => { btn.onclick = () => deleteItem('socials', btn.closest('tr').dataset.id, loadSocials); });
    };

    window.editSocial = async (id) => {
        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        const item = socials.find(s => s._id === id);
        openModal('social-modal', { ...item, index: id });
    };

    document.getElementById('save-social-btn').onclick = async () => {
        const name = document.getElementById('modal-social-name').value;
        const url = document.getElementById('modal-social-url').value;
        
        let icon = '';
        const isStockActive = document.getElementById('btn-social-icon-stock').classList.contains('active');
        if (isStockActive) {
            icon = document.getElementById('modal-social-icon-select').value || 'bi-website';
        } else {
            icon = document.getElementById('modal-social-icon').value || 'public';
        }

        if (name && url) {
            const modal = document.getElementById('social-modal');
            const data = { name, url, icon };
            const id = modal.dataset.editIndex;
            if (id) {
                await fetch(`${API_URL}/socials/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) });
            } else {
                await fetch(`${API_URL}/socials`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
            }
            loadSocials();
            closeModal('social-modal');
        }
    };

    const loadContacts = async () => {
        if (!adminToken) return;
        const res = await fetch(`${API_URL}/contacts`);
        const contacts = await res.json();
        const body = document.getElementById('contact-table-body');
        if (!body) return;
        body.innerHTML = contacts.map((c, idx) => {
            const iconHtml = (c.icon && (c.icon.startsWith('http') || c.icon.includes('/')))
                ? `<img src="${thumbUrl(c.icon, 64)}" class="admin-table-icon" alt="${c.name}" loading="lazy">`
                : (c.icon && c.icon.startsWith('bi-'))
                    ? `<span class="brand-icon ${c.icon}"></span>`
                    : (c.icon && c.icon.startsWith('ms-'))
                        ? `<span class="material-symbols-rounded">${c.icon.substring(3)}</span>`
                        : `<span class="material-symbols-rounded">${c.icon || 'public'}</span>`;
            
            const isHidden = !!c.hidden;
            const hiddenBadge = isHidden ? `<span class="badge-hidden"><span class="material-symbols-rounded" style="font-size:12px">visibility_off</span>Hidden</span>` : '';
            const hideIcon = isHidden ? 'visibility_off' : 'visibility';
            const hideTitle = isHidden ? 'Show item' : 'Hide item';

            return `
            <tr data-id="${c._id}" class="${isHidden ? 'table-row-hidden' : ''}">
                <td>${iconHtml}</td>
                <td>${c.name}${hiddenBadge}</td>
                <td><a href="${ensureProtocol(c.url)}" target="_blank" class="table-link">${c.url}</a></td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon move-up ${idx === 0 ? 'disabled' : ''}" title="Move Up">arrow_upward</span>
                    <span class="material-symbols-rounded action-icon move-down ${idx === contacts.length - 1 ? 'disabled' : ''}" title="Move Down">arrow_downward</span>
                    <span class="material-symbols-rounded action-icon toggle-hide" title="${hideTitle}">${hideIcon}</span>
                    <span class="material-symbols-rounded action-icon edit-contact">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-contact">delete</span>
                </td>
            </tr>
        `}).join('');
        body.querySelectorAll('.move-up:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = contacts.findIndex(item => item._id === tr.dataset.id);
                reorderItem('contacts', contacts, i, -1, loadContacts);
            };
        });
        body.querySelectorAll('.move-down:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = contacts.findIndex(item => item._id === tr.dataset.id);
                reorderItem('contacts', contacts, i, 1, loadContacts);
            };
        });
        body.querySelectorAll('.toggle-hide').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const item = contacts.find(c => c._id === tr.dataset.id);
                if (item) toggleHideItem('contacts', item._id, item.hidden, loadContacts);
            };
        });
        body.querySelectorAll('.edit-contact').forEach(btn => { btn.onclick = () => editContact(btn.closest('tr').dataset.id); });
        body.querySelectorAll('.delete-contact').forEach(btn => { btn.onclick = () => deleteItem('contacts', btn.closest('tr').dataset.id, loadContacts); });
    };

    window.editContact = async (id) => {
        const res = await fetch(`${API_URL}/contacts`);
        const contacts = await res.json();
        const item = contacts.find(c => c._id === id);
        openModal('contact-modal', { ...item, index: id });
    };

    document.getElementById('save-contact-btn').onclick = async () => {
        const name = document.getElementById('modal-contact-name').value;
        const url = document.getElementById('modal-contact-url').value;
        
        let icon = '';
        const isStockActive = document.getElementById('btn-contact-icon-stock').classList.contains('active');
        if (isStockActive) {
            icon = document.getElementById('modal-contact-icon-select').value || 'bi-website';
        } else {
            icon = document.getElementById('modal-contact-icon').value || 'public';
        }

        if (name && url) {
            const modal = document.getElementById('contact-modal');
            const data = { name, url, icon };
            const id = modal.dataset.editIndex;
            if (id) {
                await fetch(`${API_URL}/contacts/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) });
            } else {
                await fetch(`${API_URL}/contacts`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
            }
            loadContacts();
            closeModal('contact-modal');
        }
    };

    const loadPresets = async () => {
        if (!adminToken) return;
        const res = await fetch(`${API_URL}/presets`);
        const presets = await res.json();
        const body = document.getElementById('preset-table-body');
        body.innerHTML = presets.map((p, idx) => {
            const swArr = Array.isArray(p.software) ? p.software : (p.software ? [p.software] : []);
            const swDisplay = swArr.join(', ');
            const urlsArr = Array.isArray(p.urls) ? p.urls : (p.url ? [{ sw: swArr[0] || 'N/A', url: p.url }] : []);
            const urlDisplay = urlsArr.map(u => `<a href="${ensureProtocol(u.url)}" target="_blank" class="table-link">${u.sw}</a>`).join(' ');
            
            const isHidden = !!p.hidden;
            const hiddenBadge = isHidden ? `<span class="badge-hidden"><span class="material-symbols-rounded" style="font-size:12px">visibility_off</span>Hidden</span>` : '';
            const hideIcon = isHidden ? 'visibility_off' : 'visibility';
            const hideTitle = isHidden ? 'Show item' : 'Hide item';

            return `
            <tr data-id="${p._id}" class="${isHidden ? 'table-row-hidden' : ''}">
                <td>${p.name}${hiddenBadge}</td>
                <td>${swDisplay}</td>
                <td>${p.version}</td>
                <td>${p.size || 'N/A'}</td>
                <td>${p.plugin || 'None'}</td>
                <td>${urlDisplay || 'N/A'}</td>
                <td>${p.likes || 0}</td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon move-up ${idx === 0 ? 'disabled' : ''}" title="Move Up">arrow_upward</span>
                    <span class="material-symbols-rounded action-icon move-down ${idx === presets.length - 1 ? 'disabled' : ''}" title="Move Down">arrow_downward</span>
                    <span class="material-symbols-rounded action-icon toggle-hide" title="${hideTitle}">${hideIcon}</span>
                    <span class="material-symbols-rounded action-icon edit-preset">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-preset">delete</span>
                </td>
            </tr>
        `;
        }).join('');
        body.querySelectorAll('.move-up:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = presets.findIndex(item => item._id === tr.dataset.id);
                reorderItem('presets', presets, i, -1, loadPresets);
            };
        });
        body.querySelectorAll('.move-down:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = presets.findIndex(item => item._id === tr.dataset.id);
                reorderItem('presets', presets, i, 1, loadPresets);
            };
        });
        body.querySelectorAll('.toggle-hide').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const item = presets.find(p => p._id === tr.dataset.id);
                if (item) toggleHideItem('presets', item._id, item.hidden, loadPresets);
            };
        });
        body.querySelectorAll('.edit-preset').forEach(btn => { btn.onclick = () => editPreset(btn.closest('tr').dataset.id); });
        body.querySelectorAll('.delete-preset').forEach(btn => { btn.onclick = () => deleteItem('presets', btn.closest('tr').dataset.id, loadPresets); });
    };

    window.editPreset = async (id) => {
        const res = await fetch(`${API_URL}/presets`);
        const presets = await res.json();
        const item = presets.find(p => p._id === id);
        openModal('preset-modal', { ...item, index: id });
    };

    document.getElementById('save-preset-btn').onclick = async () => {
        const btn = document.getElementById('save-preset-btn');
        const name = document.getElementById('modal-preset-name').value.trim();
        const softwareArr = getSelectedSoftware();
        const dlLinks = getDownloadLinks();
        const firstUrl = dlLinks.length > 0 ? (dlLinks[0].url || '') : '';
        
        if (!name) { alert('Please provide a preset name'); return; }
        if (softwareArr.length === 0) { alert('Please select at least one software'); return; }

        let amPremiumUrl = '';
        let am5MbUrl = '';
        let amXmlUrl = '';
        const amXmlExtras = [];

        if (softwareArr.includes('AM')) {
            amPremiumUrl = document.getElementById('am-premium-url')?.value?.trim() || '';
            am5MbUrl = document.getElementById('am-5mb-url')?.value?.trim() || '';
            amXmlUrl = document.getElementById('am-xml-url')?.value?.trim() || '';
            document.querySelectorAll('#am-xml-extras-list .am-xml-extra-row').forEach(row => {
                const label = row.querySelector('.am-xml-extra-label')?.value?.trim() || '';
                const url = row.querySelector('.am-xml-extra-url')?.value?.trim() || '';
                if (label && url) {
                    amXmlExtras.push({ label, url });
                }
            });
        }

        btn.disabled = true;
        const modal = document.getElementById('preset-modal');
        const data = { 
            name,
            software: softwareArr,
            urls: dlLinks,
            url: firstUrl,
            version: document.getElementById('modal-preset-version')?.value || '1.0',
            media: document.getElementById('modal-preset-video')?.value || '',
            plugin: getSelectedPlugins(),
            size: document.getElementById('modal-preset-size')?.value || 'N/A',
            amPremiumUrl,
            am5MbUrl,
            amXmlUrl,
            amXmlExtras
        };
        const editId = modal.dataset.editIndex;
        try {
            const res = editId
                ? await fetch(`${API_URL}/presets/${editId}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) })
                : await fetch(`${API_URL}/presets`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
            if (res.ok) {
                loadPresets();
                closeModal('preset-modal', true);
            } else {
                const err = await res.json();
                alert('Error: ' + (err.error || 'Failed to save preset'));
            }
        } catch (err) {
            alert('Connection error');
        } finally {
            btn.disabled = false;
        }
    };

    const STATIC_RES_CATS = ['Made By Cutefish', 'Software', 'Plugin', 'Extension'];
    const STATIC_RES_VERS = ['Latest', 'Stable', 'Oldest'];
    const OS_META = {
        WIN:     { label: 'Windows', svg: 'assets/svg/windows.svg' },
        MAC:     { label: 'macOS',   svg: 'assets/svg/apple.svg'   },
        ANDROID: { label: 'Android', svg: 'assets/svg/android.svg' },
        WEB:     { label: 'Web App', svg: 'assets/svg/web.svg'     }
    };

    const resetResourceModal = () => {
        document.querySelectorAll('#resource-category-picker .res-cat-badge').forEach(b => {
            if (!STATIC_RES_CATS.includes(b.dataset.cat)) b.remove();
            else b.classList.remove('selected');
        });
        document.querySelectorAll('#resource-os-picker .res-os-badge').forEach(b => b.classList.remove('selected'));
        document.querySelectorAll('#resource-version-picker .res-ver-badge').forEach(b => {
            if (!STATIC_RES_VERS.includes(b.dataset.ver)) b.remove();
            else b.classList.remove('selected');
        });
        document.getElementById('resource-os-links-container').innerHTML = '<p class="no-sw-selected-hint">Select OS above to add download links.</p>';
        ['modal-resource-title','modal-resource-dev','modal-resource-info','modal-resource-instruction'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        const drop = document.getElementById('resource-icon-drop');
        const img = document.getElementById('resource-icon-img-preview');
        if (drop) { drop.classList.remove('has-file'); delete drop.dataset.uploadedUrl; }
        if (img) { img.src = ''; img.removeAttribute('src'); }
        document.getElementById('modal-resource-icon').value = '';
    };

    const initResourceBadgePickers = () => {
        document.querySelectorAll('#resource-category-picker .res-cat-badge').forEach(b => {
            b.addEventListener('click', () => b.classList.toggle('selected'));
        });
        document.querySelectorAll('#resource-os-picker .res-os-badge').forEach(b => {
            b.addEventListener('click', () => { b.classList.toggle('selected'); syncResourceOsRows(); });
        });
        document.querySelectorAll('#resource-version-picker .res-ver-badge').forEach(b => {
            b.addEventListener('click', () => { b.classList.toggle('selected'); syncResourceOsRows(); });
        });

        document.getElementById('open-resource-cat-popup')?.addEventListener('click', e => {
            e.stopPropagation();
            document.getElementById('resource-cat-popup').classList.add('show');
        });
        document.getElementById('cancel-resource-cat')?.addEventListener('click', () => {
            document.getElementById('resource-cat-popup').classList.remove('show');
        });
        document.getElementById('confirm-resource-cat')?.addEventListener('click', () => {
            const label = document.getElementById('resource-cat-label').value.trim();
            if (!label) return;
            const picker = document.getElementById('resource-category-picker');
            const addBtn = picker.querySelector('.sw-badge-add-btn');
            const badge = document.createElement('div');
            badge.className = 'sw-badge-preset res-cat-badge selected';
            badge.dataset.cat = label;
            badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">label</span><span>${label}</span>`;
            badge.addEventListener('click', () => badge.classList.toggle('selected'));
            picker.insertBefore(badge, addBtn);
            document.getElementById('resource-cat-label').value = '';
            document.getElementById('resource-cat-popup').classList.remove('show');
        });

        document.getElementById('open-resource-ver-popup')?.addEventListener('click', e => {
            e.stopPropagation();
            document.getElementById('resource-ver-popup').classList.add('show');
        });
        document.getElementById('cancel-resource-ver')?.addEventListener('click', () => {
            document.getElementById('resource-ver-popup').classList.remove('show');
        });
        document.getElementById('confirm-resource-ver')?.addEventListener('click', () => {
            const label = document.getElementById('resource-ver-label').value.trim();
            if (!label) return;
            const picker = document.getElementById('resource-version-picker');
            const addBtn = picker.querySelector('.sw-badge-add-btn');
            const badge = document.createElement('div');
            badge.className = 'sw-badge-preset res-ver-badge selected';
            badge.dataset.ver = label;
            badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">new_releases</span><span>${label}</span>`;
            badge.addEventListener('click', () => { badge.classList.toggle('selected'); syncResourceOsRows(); });
            picker.insertBefore(badge, addBtn);
            document.getElementById('resource-ver-label').value = '';
            document.getElementById('resource-ver-popup').classList.remove('show');
            syncResourceOsRows();
        });
    };

    const syncResourceOsRows = () => {
        const container = document.getElementById('resource-os-links-container');
        if (!container) return;
        const selectedOs = [...document.querySelectorAll('#resource-os-picker .res-os-badge.selected')].map(b => b.dataset.os);
        const selectedVers = [...document.querySelectorAll('#resource-version-picker .res-ver-badge.selected')].map(b => b.dataset.ver);

        if (selectedOs.length === 0 || selectedVers.length === 0) {
            container.innerHTML = '<p class="no-sw-selected-hint">Select OS and version above.</p>';
            return;
        }

        const existing = {};
        container.querySelectorAll('.res-os-ver-row').forEach(row => {
            existing[`${row.dataset.os}__${row.dataset.ver}`] = row.querySelector('input[type="text"]')?.value || '';
        });
        container.innerHTML = '';

        selectedOs.forEach(os => {
            const meta = OS_META[os] || { label: os, svg: '' };
            const osGroup = document.createElement('div');
            osGroup.className = 'res-os-group';
            osGroup.innerHTML = `<div class="res-os-group-header">
                ${meta.svg ? `<img src="${meta.svg}" alt="${os}" style="width:16px;height:16px">` : ''}
                <span>${meta.label}</span>
            </div>`;
            selectedVers.forEach(ver => {
                const key = `${os}__${ver}`;
                const row = document.createElement('div');
                row.className = 'res-os-ver-row';
                row.dataset.os = os;
                row.dataset.ver = ver;
                row.innerHTML = `
                    <span class="res-ver-badge-inline">${ver}</span>
                    <div class="dl-input-wrap">
                        <input type="text" placeholder="https://..." value="${existing[key] || ''}" style="width: 100%;">
                    </div>`;
                osGroup.appendChild(row);
            });
            container.appendChild(osGroup);
        });
    };

    const getResourceOsLinks = () => {
        const result = [];
        document.querySelectorAll('.res-os-ver-row').forEach(row => {
            const url = row.querySelector('input[type="text"]')?.value?.trim() || '';
            if (url) result.push({ os: row.dataset.os, ver: row.dataset.ver, url });
        });
        return result;
    };

    const loadResources = async () => {
        if (!adminToken) return;
        const res = await fetch(`${API_URL}/resources`);
        const resources = await res.json();
        const body = document.getElementById('resource-table-body');
        body.innerHTML = resources.map((r, idx) => {
            const iconHtml = (r.icon && (r.icon.startsWith('http') || r.icon.includes('/')))
                ? `<img src="${thumbUrl(r.icon, 64)}" class="admin-table-icon" alt="${r.title}" loading="lazy">`
                : `<span class="material-symbols-rounded">${r.icon || 'shop'}</span>`;

            const cats = Array.isArray(r.category) ? r.category : (r.category ? [r.category] : []);
            const osArr = Array.isArray(r.os) ? r.os : [];
            const osIcons = osArr.map(o => {
                const key = typeof o === 'string' ? o.toUpperCase() : (o.name || '').toUpperCase();
                const m = OS_META[key];
                return m ? `<img src="${m.svg}" class="admin-os-icon" title="${m.label}">` : key;
            }).join(' ');

            const instruction = r.instruction ? `<span class="material-symbols-rounded" style="color:var(--md-sys-color-primary);font-size:18px" title="${r.instruction.substring(0,50)}...">info</span>` : '—';

            const isHidden = !!r.hidden;
            const hiddenBadge = isHidden ? `<span class="badge-hidden"><span class="material-symbols-rounded" style="font-size:12px">visibility_off</span>Hidden</span>` : '';
            const hideIcon = isHidden ? 'visibility_off' : 'visibility';
            const hideTitle = isHidden ? 'Show item' : 'Hide item';

            return `
            <tr data-id="${r._id}" class="${isHidden ? 'table-row-hidden' : ''}">
                <td>${iconHtml}</td>
                <td>${r.title}${hiddenBadge}</td>
                <td>${cats.join(', ') || '—'}</td>
                <td>${r.dev || ''}</td>
                <td>${osIcons || '—'}</td>
                <td>${r.info || ''}</td>
                <td>${instruction}</td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon move-up ${idx === 0 ? 'disabled' : ''}" title="Move Up">arrow_upward</span>
                    <span class="material-symbols-rounded action-icon move-down ${idx === resources.length - 1 ? 'disabled' : ''}" title="Move Down">arrow_downward</span>
                    <span class="material-symbols-rounded action-icon toggle-hide" title="${hideTitle}">${hideIcon}</span>
                    <span class="material-symbols-rounded action-icon edit-resource">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-resource">delete</span>
                </td>
            </tr>
        `}).join('');
        body.querySelectorAll('.move-up:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = resources.findIndex(item => item._id === tr.dataset.id);
                reorderItem('resources', resources, i, -1, loadResources);
            };
        });
        body.querySelectorAll('.move-down:not(.disabled)').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const i = resources.findIndex(item => item._id === tr.dataset.id);
                reorderItem('resources', resources, i, 1, loadResources);
            };
        });
        body.querySelectorAll('.toggle-hide').forEach(btn => {
            btn.onclick = () => {
                const tr = btn.closest('tr');
                const item = resources.find(r => r._id === tr.dataset.id);
                if (item) toggleHideItem('resources', item._id, item.hidden, loadResources);
            };
        });
        body.querySelectorAll('.edit-resource').forEach(btn => { btn.onclick = () => editResource(btn.closest('tr').dataset.id); });
        body.querySelectorAll('.delete-resource').forEach(btn => { btn.onclick = () => deleteItem('resources', btn.closest('tr').dataset.id, loadResources); });
    };

    window.editResource = async (id) => {
        const res = await fetch(`${API_URL}/resources`);
        const resources = await res.json();
        const item = resources.find(r => r._id === id);
        resetResourceModal();

        const modal = document.getElementById('resource-modal');
        modal.dataset.editIndex = id;

        document.getElementById('modal-resource-title').value = item.title || '';
        document.getElementById('modal-resource-dev').value = item.dev || '';
        document.getElementById('modal-resource-info').value = item.info || '';
        document.getElementById('modal-resource-instruction').value = item.instruction || '';

        const iconInput = document.getElementById('modal-resource-icon');
        iconInput.value = item.icon || '';
        if (item.icon && (item.icon.startsWith('http') || item.icon.includes('/'))) {
            const drop = document.getElementById('resource-icon-drop');
            const img = document.getElementById('resource-icon-img-preview');
            if (drop) { drop.classList.add('has-file'); drop.dataset.uploadedUrl = item.icon; }
            if (img) img.src = item.icon;
        }

        const cats = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
        cats.forEach(cat => {
            let badge = document.querySelector(`#resource-category-picker .res-cat-badge[data-cat="${cat}"]`);
            if (!badge) {
                const picker = document.getElementById('resource-category-picker');
                const addBtn = picker.querySelector('.sw-badge-add-btn');
                badge = document.createElement('div');
                badge.className = 'sw-badge-preset res-cat-badge';
                badge.dataset.cat = cat;
                badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">label</span><span>${cat}</span>`;
                badge.addEventListener('click', () => badge.classList.toggle('selected'));
                picker.insertBefore(badge, addBtn);
            }
            badge.classList.add('selected');
        });

        const osArr = Array.isArray(item.os) ? item.os : [];
        osArr.forEach(entry => {
            const osKey = typeof entry === 'string' ? entry.toUpperCase() : (entry.name || '').toUpperCase();
            const badge = document.querySelector(`#resource-os-picker .res-os-badge[data-os="${osKey}"]`);
            if (badge) badge.classList.add('selected');
        });

        const allVers = new Set();
        osArr.forEach(entry => {
            if (entry.versions) entry.versions.forEach(v => allVers.add(v.label));
        });
        allVers.forEach(ver => {
            let badge = document.querySelector(`#resource-version-picker .res-ver-badge[data-ver="${ver}"]`);
            if (!badge) {
                const picker = document.getElementById('resource-version-picker');
                const addBtn = picker.querySelector('.sw-badge-add-btn');
                badge = document.createElement('div');
                badge.className = 'sw-badge-preset res-ver-badge';
                badge.dataset.ver = ver;
                badge.innerHTML = `<span class="material-symbols-rounded" style="font-size:14px">new_releases</span><span>${ver}</span>`;
                badge.addEventListener('click', () => { badge.classList.toggle('selected'); syncResourceOsRows(); });
                picker.insertBefore(badge, addBtn);
            }
            badge.classList.add('selected');
        });

        syncResourceOsRows();

        osArr.forEach(entry => {
            const osKey = typeof entry === 'string' ? entry.toUpperCase() : (entry.name || '').toUpperCase();
            if (entry.versions) {
                entry.versions.forEach(v => {
                    const row = document.querySelector(`.res-os-ver-row[data-os="${osKey}"][data-ver="${v.label}"]`);
                    if (row) { const inp = row.querySelector('input[type="text"]'); if (inp) inp.value = v.url || ''; }
                });
            }
        });

        modal.classList.add('show');
    };

    document.getElementById('save-resource-btn').onclick = async () => {
        const title = document.getElementById('modal-resource-title').value.trim();
        if (!title) { alert('Please provide a resource title'); return; }

        const category = [...document.querySelectorAll('#resource-category-picker .res-cat-badge.selected')].map(b => b.dataset.cat);
        const dev = document.getElementById('modal-resource-dev').value.trim();
        const info = document.getElementById('modal-resource-info').value.trim();
        const instruction = document.getElementById('modal-resource-instruction').value.trim();
        const iconHiddenVal = document.getElementById('modal-resource-icon').value || '';
        const iconDropFallback = document.getElementById('resource-icon-drop')?.dataset.uploadedUrl || '';
        const icon = iconDropFallback || iconHiddenVal;

        const selectedOs = [...document.querySelectorAll('#resource-os-picker .res-os-badge.selected')].map(b => b.dataset.os);
        const selectedVers = [...document.querySelectorAll('#resource-version-picker .res-ver-badge.selected')].map(b => b.dataset.ver);
        const osData = selectedOs.map(osKey => {
            const versions = selectedVers.map(ver => {
                const row = document.querySelector(`.res-os-ver-row[data-os="${osKey}"][data-ver="${ver}"]`);
                const url = row?.querySelector('input[type="text"]')?.value?.trim() || '';
                return { label: ver, url };
            }).filter(v => v.url);
            return { name: osKey, versions };
        });

        const modal = document.getElementById('resource-modal');
        const editId = modal.dataset.editIndex;
        const data = { title, category, dev, info, instruction, icon, os: osData };

        try {
            const res = editId
                ? await fetch(`${API_URL}/resources/${editId}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) })
                : await fetch(`${API_URL}/resources`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
            if (res.ok) {
                loadResources();
                closeModal('resource-modal');
                resetResourceModal();
            } else {
                const err = await res.json();
                alert('Error: ' + (err.error || 'Failed to save resource'));
            }
        } catch (err) {
            alert('Connection error');
        }
    };

    window.deleteItem = async (type, id, callback) => {
        if (confirm('Are you sure you want to delete this item?')) {
            try {
                const delRes = await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
                if (check401(delRes)) return;
                if (!delRes.ok) {
                    const data = await delRes.json().catch(() => ({}));
                    alert('Failed to delete item: ' + (data.error || delRes.statusText || delRes.status));
                    return;
                }
                callback();
            } catch (err) {
                alert('Connection error while deleting: ' + err.message);
            }
        }
    };

    showLoadingUI();
    if (adminToken) {
        try {
            const res = await fetch(`${API_URL}/admin/session`, { headers: adminAuthHeaders() });
            if (res.ok) {
                showAppUI();
                await initAdmin();
            } else {
                persistToken(null);
                showLoginUI();
            }
        } catch (e) {
            persistToken(null);
            showLoginUI();
        }
    } else {
        showLoginUI();
    }
});
