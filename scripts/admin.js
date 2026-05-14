document.addEventListener('DOMContentLoaded', async () => {
    const adminLogin = document.getElementById('admin-login');
    const adminApp = document.getElementById('admin-app');
    const loginBtn = document.getElementById('admin-login-btn');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    const API_URL = '/api';
    const ensureProtocol = (url) => {
        if (!url || url === '#') return '#';
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
        adminLogin.classList.remove('d-none');
        adminApp.classList.add('d-none');
    };

    const showAppUI = () => {
        adminLogin.classList.add('d-none');
        adminApp.classList.remove('d-none');
    };

    const adminAuthHeaders = (base = {}) => ({
        ...base,
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
    });

    const jsonHeaders = () => adminAuthHeaders({ 'Content-Type': 'application/json' });

    let isUnauthorizedAlertShowing = false;
    let chatListInterval = null;
    let heartbeatInterval = null;

    const onUnauthorized = () => {
        if (isUnauthorizedAlertShowing) return;
        isUnauthorizedAlertShowing = true;
        persistToken(null);
        stopAdminMessagePolling();
        if (chatListInterval) clearInterval(chatListInterval);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
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
            const isChatTab = target === 'chat';
            fetch(`${API_URL}/admin/heartbeat`, { 
                method: 'POST', 
                headers: jsonHeaders(),
                body: JSON.stringify({ forceStatus: isChatTab ? 'online' : 'offline' })
            }).catch(() => {});
        });
    });

    window.addEventListener('hashchange', handleHashNavigation);

    const initAdmin = async () => {
        await loadSocials();
        await loadPresets();
        await loadResources();
        await loadChats();
        initModalTriggers();
        initDragAndDrop();
        handleHashNavigation();
        const adminUploadModal = document.getElementById('chat-upload-modal');
        const openAdminUploadBtn = document.getElementById('open-chat-upload-modal');
        const closeAdminUploadBtn = document.getElementById('close-chat-upload-modal');
        if (openAdminUploadBtn) openAdminUploadBtn.onclick = () => adminUploadModal.classList.add('show');
        if (closeAdminUploadBtn) closeAdminUploadBtn.onclick = () => adminUploadModal.classList.remove('show');
        if (chatListInterval) clearInterval(chatListInterval);
        chatListInterval = setInterval(loadChats, 5000);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/admin/heartbeat`, { 
                    method: 'POST',
                    headers: adminAuthHeaders()
                });
                check401(res);
            } catch (e) {}
        }, 5000);
    };

    const initModalTriggers = () => {
        document.getElementById('open-social-modal').onclick = () => openModal('social-modal');
        document.getElementById('open-preset-modal').onclick = () => openModal('preset-modal');
        document.getElementById('open-resource-modal').onclick = () => openModal('resource-modal');
    };

    window.openModal = (id, editData = null) => {
        const modal = document.getElementById(id);
        modal.classList.add('show');
        if (editData) {
            modal.dataset.editIndex = editData.index;
            if (id === 'social-modal') {
                document.getElementById('modal-social-name').value = editData.name;
                document.getElementById('modal-social-url').value = editData.url;
                const iconInput = document.getElementById('modal-social-icon');
                iconInput.value = editData.icon || '';
                checkSupabaseFile(editData.icon, 'social-icon');
                const preview = document.getElementById('social-icon-preview');
                const area = document.getElementById('social-icon-drop');
                const imgPreview = document.getElementById('social-icon-img-preview');

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
            } else if (id === 'preset-modal') {
                document.getElementById('modal-preset-name').value = editData.name;
                const urlInput = document.getElementById('modal-preset-url');
                urlInput.value = editData.url || '';
                
                checkSupabaseFile(editData.url);
                
                if (document.getElementById('modal-preset-software')) document.getElementById('modal-preset-software').value = editData.software || 'AE';
                if (document.getElementById('modal-preset-version')) document.getElementById('modal-preset-version').value = editData.version || '';
                if (document.getElementById('modal-preset-video')) document.getElementById('modal-preset-video').value = editData.media || '';
                if (document.getElementById('modal-preset-plugin')) document.getElementById('modal-preset-plugin').value = editData.plugin || '';
                if (document.getElementById('modal-preset-size')) document.getElementById('modal-preset-size').value = editData.size || '';
            } else if (id === 'resource-modal') {
                document.getElementById('modal-resource-title').value = editData.title;
                document.getElementById('modal-resource-category').value = editData.category || 'App';
                document.getElementById('modal-resource-dev').value = editData.dev || '';
                document.getElementById('modal-resource-version').value = editData.version || '';
                document.getElementById('modal-resource-info').value = editData.info || '';
                const iconInput = document.getElementById('modal-resource-icon');
                iconInput.value = editData.icon || '';
                checkSupabaseFile(editData.icon, 'resource-icon');
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
                checkSupabaseFile(editData.url, 'resource');
                
                document.getElementById('modal-resource-desc').value = editData.desc || '';
            }
        } else {
            delete modal.dataset.editIndex;
            modal.querySelectorAll('input, select, textarea').forEach(i => i.value = '');
            modal.querySelectorAll('.file-preview').forEach(p => p.textContent = '');
            if (id === 'preset-modal') {
                document.getElementById('delete-uploaded-preset-btn')?.classList.add('hidden');
            } else if (id === 'resource-modal') {
                document.getElementById('delete-uploaded-resource-btn')?.classList.add('hidden');
                document.getElementById('delete-uploaded-resource-icon-btn')?.classList.add('hidden');
            } else if (id === 'social-modal') {
                document.getElementById('delete-uploaded-social-icon-btn')?.classList.add('hidden');
            }
        }
    };

    const checkSupabaseFile = (url, type = 'preset') => {
        let btnId = `delete-uploaded-${type}-btn`;
        if (type === 'resource-icon') btnId = 'delete-uploaded-resource-icon-btn';
        if (type === 'social-icon') btnId = 'delete-uploaded-social-icon-btn';
        
        const deleteBtn = document.getElementById(btnId);
        if (!deleteBtn) return;
        const isSupabase = url && url.includes('supabase.co/storage/v1/object/public');
        if (isSupabase) deleteBtn.classList.remove('hidden');
        else deleteBtn.classList.add('hidden');
    };

    document.getElementById('modal-preset-url')?.addEventListener('input', (e) => {
        checkSupabaseFile(e.target.value, 'preset');
    });
    document.getElementById('modal-resource-url')?.addEventListener('input', (e) => {
        checkSupabaseFile(e.target.value, 'resource');
    });
    document.getElementById('modal-resource-icon')?.addEventListener('input', (e) => {
        checkSupabaseFile(e.target.value, 'resource-icon');
    });
    document.getElementById('modal-social-icon')?.addEventListener('input', (e) => {
        checkSupabaseFile(e.target.value, 'social-icon');
    });

    const initDeleteHandlers = () => {
        ['preset', 'resource', 'resource-icon', 'social-icon'].forEach(type => {
            let btnId = `delete-uploaded-${type}-btn`;
            if (type === 'resource-icon') btnId = 'delete-uploaded-resource-icon-btn';
            if (type === 'social-icon') btnId = 'delete-uploaded-social-icon-btn';
            
            document.getElementById(btnId)?.addEventListener('click', async () => {
                const urlInput = document.getElementById(`modal-${type.includes('icon') ? type : type + '-url'}`);
                const url = urlInput.value;
                if (!url) return;
                
                if (!confirm('Are you sure you want to delete this file from the server?')) return;
                
                try {
                    const res = await fetch(`${API_URL}/upload`, {
                        method: 'DELETE',
                        headers: jsonHeaders(),
                        body: JSON.stringify({ url })
                    });
                    if (res.ok) {
                        urlInput.value = '';
                        checkSupabaseFile('', type);
                        const preview = document.getElementById(`${type}-preview`) || document.getElementById(`${type}-file-preview`);
                        if (preview) preview.textContent = '';
                        alert('File deleted successfully');
                    } else {
                        const data = await res.json();
                        alert('Delete failed: ' + (data.error || 'Unknown error'));
                    }
                } catch (err) {
                    alert('Connection error');
                }
            });
        });
    };
    initDeleteHandlers();

    window.closeModal = (id) => {
        document.getElementById(id).classList.remove('show');
    };

    const initDragAndDrop = () => {
        const areas = document.querySelectorAll('.modal-overlay:not(#chat-upload-modal) .drag-drop-area, .integrated-drop-zone');
        areas.forEach(area => {
            const isIntegrated = area.classList.contains('integrated-drop-zone') || area.classList.contains('drag-drop-area');
            const type = area.id === 'preset-url-drop' ? 'preset' : 
                         (area.id === 'resource-url-drop' ? 'resource' : 
                         (area.id === 'resource-icon-drop' ? 'resource-icon' : 
                         (area.id === 'social-icon-drop' ? 'social-icon' : null)));
            
            const input = document.getElementById(`${type}-file-input`) || area.querySelector('input');
            const preview = document.getElementById(`${type}-file-preview`) || document.getElementById(`${type}-preview`) || area.querySelector('.file-preview');

            const removeBtn = document.getElementById(`remove-${type}-btn`);
            if (removeBtn) {
                removeBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = type.includes('icon') ? `modal-${type}` : `modal-${type}-url`;
                    const urlInput = document.getElementById(targetId);
                    const url = urlInput?.value?.trim();
                    if (url && url.includes('supabase.co/storage/v1/object/public')) {
                        fetch(`${API_URL}/upload`, {
                            method: 'DELETE',
                            headers: jsonHeaders(),
                            body: JSON.stringify({ url })
                        }).catch(() => {});
                    }
                    if (urlInput) urlInput.value = '';
                    checkSupabaseFile('', type);
                    area.classList.remove('has-file');
                    const imgPreview = document.getElementById(`${type}-img-preview`);
                    if (imgPreview) {
                        imgPreview.src = '';
                        imgPreview.removeAttribute('src');
                    }
                    if (preview) {
                        preview.textContent = '';
                        preview.innerHTML = '';
                    }
                    const isResource = type.includes('resource');
                    const isSocial = type.includes('social');
                    const prefix = isResource ? 'resource' : (isSocial ? 'social' : 'preset');
                    const statusText = document.getElementById(`${prefix}-upload-status`);
                    if (statusText) statusText.textContent = 'Upload removed';
                };
            }

            area.onclick = () => input?.click();

            area.ondragover = (e) => { e.preventDefault(); area.classList.add('active'); };
            area.ondragleave = () => area.classList.remove('active');
            area.ondrop = (e) => {
                e.preventDefault();
                area.classList.remove('active');
                if (e.dataTransfer.files.length) {
                    if (isIntegrated) handleIntegratedUpload(e.dataTransfer.files[0], type);
                    else handleFile(e.dataTransfer.files[0], preview);
                }
            };
            if (input) {
                input.onchange = () => {
                    if (input.files.length) {
                        if (isIntegrated) handleIntegratedUpload(input.files[0], type);
                        else handleFile(input.files[0], preview);
                    }
                };
            }
        });
    };

    const handleIntegratedUpload = async (file, type) => {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { alert('File too large (Max 50MB)'); return; }
        
        const isResource = type.includes('resource');
        const isSocial = type.includes('social');
        const prefix = isResource ? 'resource' : (isSocial ? 'social' : 'preset');
        
        const progressContainer = document.getElementById(`${prefix}-upload-progress`);
        const progressFill = document.getElementById(`${prefix}-progress-fill`);
        const statusText = document.getElementById(`${prefix}-upload-status`);
        
        // Correctly target the hidden icon input or the url input
        let targetId = `modal-${type}`;
        if (!type.includes('icon')) targetId += '-url';
        const urlInput = document.getElementById(targetId);
        
        const preview = document.getElementById(`${type}-file-preview`) || document.getElementById(`${type}-preview`);
        
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (progressFill) progressFill.style.width = '0%';
        if (statusText) statusText.textContent = `Uploading ${file.name}...`;
        if (preview) preview.textContent = `Selected: ${file.name}`;

        const formData = new FormData();
        formData.append('file', file);
        
        try {
            let progress = 0;
            const progInterval = setInterval(() => {
                progress += 5;
                if (progress <= 90 && progressFill) progressFill.style.width = `${progress}%`;
            }, 500);

            const uploadRes = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: adminAuthHeaders(),
                body: formData
            });
            
            clearInterval(progInterval);
            if (!uploadRes.ok) throw new Error('Upload failed');
            
            const uploadData = await uploadRes.json();
            if (progressFill) progressFill.style.width = '100%';
            if (statusText) statusText.textContent = 'Upload successful!';
            
            if (urlInput) urlInput.value = uploadData.url;
            
            if (type === 'preset' && uploadData.size) {
                const sizeInput = document.getElementById('modal-preset-size');
                if (sizeInput) sizeInput.value = uploadData.size;
            }
            
            checkSupabaseFile(uploadData.url, type);
            if (preview) {
                if (type.includes('icon')) {
                    const area = document.getElementById(`${type}-drop`);
                    const imgPreview = document.getElementById(`${type}-img-preview`);
                    if (area) area.classList.add('has-file');
                    if (imgPreview) {
                        imgPreview.src = uploadData.url;
                        imgPreview.style.display = 'block';
                    }
                    preview.innerHTML = `<img src="${uploadData.url}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;margin-top:10px;">`;
                } else {
                    preview.textContent = `Uploaded: ${file.name}`;
                }
            }
            
            setTimeout(() => {
                if (progressContainer) progressContainer.classList.add('hidden');
            }, 2000);
        } catch (err) {
            console.error('Upload Error:', err);
            if (statusText) statusText.textContent = 'Upload failed!';
            alert('Upload failed: ' + err.message);
        }
    };

    const handleFile = (file, preview) => {
        if (file.size > 50 * 1024 * 1024) { alert('File too large (Max 50MB)'); return; }
        preview.textContent = `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    };

    const listView = document.getElementById('admin-chat-list-view');
    const detailView = document.getElementById('admin-chat-detail-view');
    const backBtn = document.getElementById('back-to-chat-list');
    const chatTitle = document.getElementById('current-chat-name');
    const adminChatInput = document.getElementById('admin-chat-input');
    const adminSendBtn = document.getElementById('admin-send-btn');

    let activeSupportChatId = null;
    let adminMessagePollInterval = null;

    const stopAdminMessagePolling = () => {
        if (adminMessagePollInterval) {
            clearInterval(adminMessagePollInterval);
            adminMessagePollInterval = null;
        }
    };

    const loadAdminMessages = async (id) => {
        const container = document.getElementById('admin-message-container');
        if (!container || !activeSupportChatId) return;
        try {
            const res = await fetch(`${API_URL}/messages/${id}`);
            if (!res.ok) return;
            const messages = await res.json();
            const currentCount = container.querySelectorAll('.message-group').length;
            if (messages.length === currentCount) return;
            if (messages.length === 0) {
                container.innerHTML = `<div class="empty-messages"><p>No messages in this conversation yet.</p></div>`;
            } else {
                container.innerHTML = messages.map(m => {
                    const displayType = m.type === 'sent' ? 'received' : 'sent';
                    return `<div class="message-group ${displayType}"><div class="message">${renderMessageContent(m.text)}</div><div class="timestamp">${m.time}</div></div>`;
                }).join('');
            }
            container.scrollTop = container.scrollHeight;
        } catch (err) {}
    };

    const renderMessageContent = (text) => {
        const fileMatch = text.match(/📁 Shared a file: \[(.*?)\]\((.*?)\)/);
        if (!fileMatch) return text;
        const [_, fileName, fileUrl] = fileMatch;
        const ext = fileName.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return `<a href="${fileUrl}" target="_blank" class="message-media"><img src="${fileUrl}" class="message-img" alt="${fileName}"></a>`;
        }
        if (['mp4', 'webm', 'ogg'].includes(ext)) {
            return `<div class="message-media"><video src="${fileUrl}" class="message-video" controls></video></div>`;
        }
        return `<a href="${fileUrl}" target="_blank" class="message-file"><div class="file-icon-wrapper"><span class="material-symbols-rounded">description</span></div><div class="file-info"><span class="file-name">${fileName}</span><span class="file-ext">${ext}</span></div></a>`;
    };

    const loadSocials = async () => {
        const res = await fetch(`${API_URL}/socials`);
        const socials = await res.json();
        const body = document.getElementById('social-table-body');
        body.innerHTML = socials.map((s) => {
            const iconHtml = (s.icon && (s.icon.startsWith('http') || s.icon.includes('/')))
                ? `<img src="${s.icon}" class="admin-table-icon" alt="${s.name}">`
                : `<span class="material-symbols-rounded">${s.icon || 'public'}</span>`;
            
            return `
            <tr data-id="${s._id}">
                <td>${iconHtml}</td>
                <td>${s.name}</td>
                <td><a href="${ensureProtocol(s.url)}" target="_blank" class="table-link">${s.url}</a></td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon edit-social">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-social">delete</span>
                </td>
            </tr>
        `}).join('');
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
        const icon = document.getElementById('modal-social-icon').value || 'public';
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

    const loadPresets = async () => {
        const res = await fetch(`${API_URL}/presets`);
        const presets = await res.json();
        const body = document.getElementById('preset-table-body');
        body.innerHTML = presets.map((p) => `
            <tr data-id="${p._id}">
                <td>${p.name}</td>
                <td>${p.software}</td>
                <td>${p.version}</td>
                <td>${p.size || 'N/A'}</td>
                <td>${p.plugin || 'None'}</td>
                <td>
                    <a href="${ensureProtocol(p.url)}" target="_blank" class="table-link">${p.url}</a>
                </td>
                <td>${p.likes || 0}</td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon edit-preset">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-preset">delete</span>
                </td>
            </tr>
        `).join('');
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
        const name = document.getElementById('modal-preset-name').value;
        const url = document.getElementById('modal-preset-url').value;
        
        if (name && url) {
            btn.disabled = true;
            const modal = document.getElementById('preset-modal');
            const data = { 
                name, 
                url,
                software: document.getElementById('modal-preset-software')?.value || 'AE',
                version: document.getElementById('modal-preset-version')?.value || 'v1.0',
                media: document.getElementById('modal-preset-video')?.value || '',
                plugin: document.getElementById('modal-preset-plugin')?.value || '',
                size: document.getElementById('modal-preset-size')?.value || 'N/A' 
            };
            const id = modal.dataset.editIndex;
            try {
                const res = id 
                    ? await fetch(`${API_URL}/presets/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) })
                    : await fetch(`${API_URL}/presets`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
                
                if (res.ok) {
                    loadPresets();
                    closeModal('preset-modal');
                } else {
                    const err = await res.json();
                    alert('Error: ' + (err.error || 'Failed to save preset'));
                }
            } catch (err) {
                alert('Connection error');
            } finally {
                btn.disabled = false;
            }
        } else {
            alert('Please provide name and download link');
        }
    };

    const loadResources = async () => {
        const res = await fetch(`${API_URL}/resources`);
        const resources = await res.json();
        const body = document.getElementById('resource-table-body');
        body.innerHTML = resources.map((r) => {
            const iconHtml = (r.icon && (r.icon.startsWith('http') || r.icon.includes('/')))
                ? `<img src="${r.icon}" class="admin-table-icon" alt="${r.title}">`
                : `<span class="material-symbols-rounded">${r.icon || 'shop'}</span>`;
            
            return `
            <tr data-id="${r._id}">
                <td>${iconHtml}</td>
                <td>${r.title}</td>
                <td>${r.category || 'App'}</td>
                <td>${r.dev || ''}</td>
                <td>
                    ${r.os ? `<img src="assets/svg/${r.os.toLowerCase() === 'mac' ? 'apple' : (r.os.toLowerCase() === 'win' ? 'windows' : 'android')}.svg" class="admin-os-icon" title="${r.os}">` : '-'}
                </td>
                <td>${r.version || ''}</td>
                <td>${r.info || ''}</td>
                <td><a href="${ensureProtocol(r.url)}" target="_blank" class="table-link">${r.url}</a></td>
                <td class="table-actions">
                    <span class="material-symbols-rounded action-icon edit-resource">edit</span>
                    <span class="material-symbols-rounded action-icon delete delete-resource">delete</span>
                </td>
            </tr>
        `}).join('');
        body.querySelectorAll('.edit-resource').forEach(btn => { btn.onclick = () => editResource(btn.closest('tr').dataset.id); });
        body.querySelectorAll('.delete-resource').forEach(btn => { btn.onclick = () => deleteItem('resources', btn.closest('tr').dataset.id, loadResources); });
    };

    window.editResource = async (id) => {
        const res = await fetch(`${API_URL}/resources`);
        const resources = await res.json();
        const item = resources.find(r => r._id === id);
        openModal('resource-modal', { ...item, index: id });
    };

    document.getElementById('save-resource-btn').onclick = async () => {
        const title = document.getElementById('modal-resource-title').value;
        const category = document.getElementById('modal-resource-category').value;
        const dev = document.getElementById('modal-resource-dev').value;
        const version = document.getElementById('modal-resource-version').value;
        const os = document.getElementById('modal-resource-os').value;
        const info = document.getElementById('modal-resource-info').value;
        const url = document.getElementById('modal-resource-url').value;
        const icon = document.getElementById('modal-resource-icon').value || 'shop';
        if (title) {
            const modal = document.getElementById('resource-modal');
            const data = { title, category, dev, version, os, info, url, icon };
            const id = modal.dataset.editIndex;
            if (id) {
                await fetch(`${API_URL}/resources/${id}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(data) });
            } else {
                await fetch(`${API_URL}/resources`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(data) });
            }
            loadResources();
            closeModal('resource-modal');
        }
    };

    window.deleteItem = async (type, id, callback) => {
        if (confirm('Are you sure you want to delete this item?')) {
            const delRes = await fetch(`${API_URL}/${type}/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
            if (check401(delRes)) return;
            callback();
        }
    };

    const loadChats = async () => {
        const res = await fetch(`${API_URL}/chats`, { headers: adminAuthHeaders() });
        if (check401(res)) return;
        const chats = await res.json();
        const list = document.getElementById('active-chats');
        if (!list) return;
        if (activeSupportChatId) {
            const currentChat = chats.find(c => c._id === activeSupportChatId);
            const statusEl = document.getElementById('current-chat-status');
            if (currentChat && statusEl) {
                const newStatus = currentChat.online ? 'Online' : 'Offline';
                if (statusEl.textContent !== newStatus) {
                    statusEl.textContent = newStatus;
                    statusEl.style.color = currentChat.online ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)';
                }
            }
        }
        if (chats.length === 0) {
            list.innerHTML = `<div class="empty-chats"><span class="material-symbols-rounded">chat_bubble_outline</span><p>No active conversations</p></div>`;
            return;
        }
        const newListHTML = chats.map(c => `<div class="chat-list-item ${activeSupportChatId === c._id ? 'active' : ''}" data-id="${c._id}" data-name="${c.name}"><div class="avatar">${c.name.charAt(0)}</div><div class="chat-meta"><div class="flex align-center gap-8"><span class="chat-name">${c.name}</span><span class="status-dot ${c.online ? 'online' : 'offline'}"></span></div><span class="chat-preview">${c.lastMsg}</span></div><div class="chat-time">${c.time}</div></div>`).join('');
        if (list.innerHTML !== newListHTML) {
            list.innerHTML = newListHTML;
            list.querySelectorAll('.chat-list-item').forEach(item => {
                item.addEventListener('click', () => {
                    const name = item.dataset.name;
                    const id = item.dataset.id;
                    openChatDetail(name, id);
                });
            });
        }
    };

    const openChatDetail = async (name, id) => {
        activeSupportChatId = id;
        if (chatTitle) chatTitle.textContent = name;
        if (listView) listView.classList.add('hidden');
        if (detailView) detailView.classList.remove('hidden');
        const resChat = await fetch(`${API_URL}/chats/${id}`, { headers: adminAuthHeaders() });
        if (check401(resChat)) return;
        const chatData = await resChat.json();
        const headerActions = document.querySelector('.chat-header-actions');
        if (headerActions) {
            headerActions.innerHTML = `<button class="icon-btn block-toggle-btn ${chatData.blocked ? 'blocked' : ''}"><span class="material-symbols-rounded">${chatData.blocked ? 'block' : 'verified_user'}</span></button><button class="icon-btn delete delete-chat-btn"><span class="material-symbols-rounded">delete</span></button>`;
            headerActions.querySelector('.block-toggle-btn').onclick = () => window.toggleBlock(id);
            headerActions.querySelector('.delete-chat-btn').onclick = () => window.deleteChat(id);
        }
        await loadAdminMessages(id);
        stopAdminMessagePolling();
        adminMessagePollInterval = setInterval(() => loadAdminMessages(id), 3000);
    };

    const sendAdminReply = async (customText = null) => {
        const chatId = activeSupportChatId;
        if (!chatId) return;
        const text = (typeof customText === 'string') ? customText : (adminChatInput ? adminChatInput.value.trim() : '');
        if (!text) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        try {
            const res = await fetch(`${API_URL}/messages`, {
                method: 'POST',
                headers: jsonHeaders(),
                body: JSON.stringify({ chatId: chatId, text, type: 'received', time })
            });
            if (res.status === 403) { alert('Chat is blocked or unavailable.'); return; }
            if (!res.ok) { return; }
            if (typeof customText !== 'string' && adminChatInput) {
                adminChatInput.value = '';
                adminChatInput.focus();
            }
            await loadAdminMessages(chatId);
            loadChats();
        } catch (err) {}
    };

    const adminUploadModal = document.getElementById('chat-upload-modal');
    const adminUploadDrop = document.getElementById('admin-chat-upload-drop');
    const adminFileInput = document.getElementById('admin-chat-file-input');
    const adminProgressContainer = document.getElementById('admin-upload-progress-container');
    const adminProgressFill = document.getElementById('admin-upload-progress-fill');
    const adminStatusText = document.getElementById('admin-upload-status-text');

    const handleAdminFileUpload = async (file) => {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) { alert('File too large. Max size is 50MB.'); return; }
        adminProgressContainer.classList.remove('hidden');
        adminProgressFill.style.width = '0%';
        adminStatusText.textContent = `Uploading ${file.name}...`;
        const formData = new FormData();
        formData.append('file', file);
        try {
            let progress = 0;
            const progInterval = setInterval(() => {
                progress += 5;
                if (progress <= 90) adminProgressFill.style.width = `${progress}%`;
            }, 1500);
            const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
            clearInterval(progInterval);
            if (res.ok) {
                const data = await res.json();
                adminProgressFill.style.width = '100%';
                adminStatusText.textContent = 'Upload successful!';
                const msgText = `📁 Shared a file: [${data.name}](${data.url})`;
                await sendAdminReply(msgText);
                setTimeout(() => {
                    adminUploadModal.classList.remove('show');
                    adminProgressContainer.classList.add('hidden');
                }, 1000);
            } else {
                adminStatusText.textContent = 'Upload failed.';
            }
        } catch (err) {
            adminStatusText.textContent = 'Upload error.';
        }
    };

    if (adminUploadDrop) {
        adminUploadDrop.onclick = () => adminFileInput.click();
        adminUploadDrop.ondragover = (e) => { e.preventDefault(); adminUploadDrop.classList.add('active'); };
        adminUploadDrop.ondragleave = () => adminUploadDrop.classList.remove('active');
        adminUploadDrop.ondrop = (e) => {
            e.preventDefault();
            adminUploadDrop.classList.remove('active');
            if (e.dataTransfer.files.length) handleAdminFileUpload(e.dataTransfer.files[0]);
        };
        adminFileInput.onchange = () => {
            if (adminFileInput.files.length) handleAdminFileUpload(adminFileInput.files[0]);
        };
    }

    if (adminSendBtn) adminSendBtn.addEventListener('click', () => sendAdminReply());
    if (adminChatInput) adminChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendAdminReply(); } });

    window.toggleBlock = async (id) => {
        const patchRes = await fetch(`${API_URL}/chats/${id}/block`, { method: 'PATCH', headers: adminAuthHeaders() });
        if (check401(patchRes)) return;
        const name = chatTitle.textContent;
        openChatDetail(name, id);
        loadChats();
    };

    window.deleteChat = async (id) => {
        if (confirm('Permanently delete this chat and all messages?')) {
            const delRes = await fetch(`${API_URL}/chats/${id}`, { method: 'DELETE', headers: adminAuthHeaders() });
            if (check401(delRes)) return;
            activeSupportChatId = null;
            if (detailView) detailView.classList.add('hidden');
            if (listView) listView.classList.remove('hidden');
            loadChats();
        }
    };

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            activeSupportChatId = null;
            stopAdminMessagePolling();
            if (detailView) detailView.classList.add('hidden');
            if (listView) listView.classList.remove('hidden');
        });
    }

    if (adminToken) {
        const res = await fetch(`${API_URL}/admin/session`, { headers: adminAuthHeaders() });
        if (res.ok) {
            showAppUI();
            await initAdmin();
        } else {
            persistToken(null);
        }
    }
});
