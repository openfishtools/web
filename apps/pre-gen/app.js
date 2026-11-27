(function () {
  "use strict";

  const API_ENDPOINT = '/api/pregen';

  const input = document.getElementById('input');
  const inputLabel = document.getElementById('input-label');
  const fieldInput = document.getElementById('field-input');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = document.getElementById('btn-text');
  const btnIcon = document.getElementById('btn-icon');
  const btnCopy = document.getElementById('btn-copy');

  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');
  const infoBanner = document.getElementById('info-banner');
  const infoText = document.getElementById('info-text');

  const receiptGrid = document.getElementById('receipt-grid');
  const rcptEmail = document.getElementById('rcpt-email');
  const rcptOrderId = document.getElementById('rcpt-order-id');
  const rcptExpiry = document.getElementById('rcpt-expiry');

  let phase = 'email';
  let email = '';
  let busy = false;
  let receiptDataText = '';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function t(idText, enText) {
    if (window.CutefishI18n && typeof window.CutefishI18n.t === 'function') {
      return window.CutefishI18n.t(idText, enText);
    }
    return idText;
  }

  function showError(msg) {
    if (!msg) {
      errorBanner.classList.add('is-hidden');
      return;
    }
    errorText.textContent = msg;
    errorBanner.classList.remove('is-hidden');
    infoBanner.classList.add('is-hidden');
    if (window.CutefishI18n && window.CutefishI18n.apply) window.CutefishI18n.apply(errorBanner);
  }

  function showInfo(msg) {
    if (!msg) {
      infoBanner.classList.add('is-hidden');
      return;
    }
    infoText.textContent = msg;
    infoBanner.classList.remove('is-hidden');
    errorBanner.classList.add('is-hidden');
    if (window.CutefishI18n && window.CutefishI18n.apply) window.CutefishI18n.apply(infoBanner);
  }

  async function callApi(payload) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25000);
    try {
      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ac.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Timeout koneksi ke server.');
      if (!err.message || err.message === 'Failed to fetch') {
        throw new Error(t('Koneksi gagal atau terblokir.', 'Connection failed or blocked.'));
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  btnSubmit.addEventListener('click', async () => {
    if (busy) return;
    showError('');

    const val = input.value.trim();
    if (!val) {
      showError(phase === 'email'
        ? t('Masukkan email terlebih dahulu.', 'Please enter an email first.')
        : t('Tempel tautan dari email terlebih dahulu.', 'Please paste the link from the email first.')
      );
      return;
    }

    busy = true;
    btnSubmit.disabled = true;

    try {
      if (phase === 'email') {
        if (!EMAIL_RE.test(val.toLowerCase())) {
          throw new Error(t('Format email tidak valid.', 'Invalid email format.'));
        }
        email = val.toLowerCase();

        btnText.textContent = t('Mengirim...', 'Sending...');
        showInfo(t('Mengirim tautan verifikasi ke email...', 'Sending verification link to email...'));
        
        await callApi({ action: 'send-link', email });

        phase = 'link';
        input.value = '';
        inputLabel.textContent = t('Tautan Verifikasi dari Email', 'Verification Link from Email');
        input.placeholder = t('Tempel tautan lengkap dari email di sini...', 'Paste full link from email here...');
        btnIcon.textContent = 'verified';
        btnText.textContent = t('Aktivasi Pro', 'Activate Pro');
        showInfo(t('Tautan terkirim! Buka email Anda, salin URL verifikasi, lalu tempel di atas.', 'Link sent! Open your email, copy the verification URL, then paste it above.'));
      } else {
        btnText.textContent = t('Memverifikasi...', 'Verifying...');
        showInfo(t('Memproses lisensi Pro ke server Alight Motion...', 'Processing Pro license with Alight Motion servers...'));
        
        const data = await callApi({ action: 'activate', email, link: val });
        const { orderId, expiry } = data;

        const locale = window.CutefishI18n && window.CutefishI18n.locale ? window.CutefishI18n.locale() : 'id-ID';
        const until = expiry ? new Date(expiry).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
        const now = new Date().toLocaleString(locale);

        showInfo(t(
          'Aktivasi Berhasil! Lisensi Pro aktif. Silakan restart aplikasi Alight Motion.',
          'Activation Successful! Pro license is active. Please restart Alight Motion.'
        ));
        fieldInput.classList.add('is-hidden');
        btnSubmit.classList.add('is-hidden');

        rcptEmail.textContent = email;
        rcptOrderId.textContent = orderId;
        rcptExpiry.textContent = until;

        receiptGrid.classList.remove('is-hidden');
        btnCopy.classList.remove('is-hidden');

        if (window.CutefishI18n && window.CutefishI18n.apply) window.CutefishI18n.apply(receiptGrid);

        receiptDataText = `=== ALIGHT MOTION PRO RECEIPT ===\nEmail: ${email}\nOrder ID: ${orderId}\nPlan: Alight Motion Pro Annual\nExpires On: ${until}\nTime: ${now}\nStatus: ACTIVE\n=================================`;
      }
    } catch (err) {
      showError(err.message);
      btnText.textContent = phase === 'email' ? t('Lanjutkan', 'Continue') : t('Aktivasi Pro', 'Activate Pro');
    } finally {
      busy = false;
      btnSubmit.disabled = false;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnSubmit.click();
    }
  });

  input.addEventListener('input', () => {
    if (!errorBanner.classList.contains('is-hidden')) showError('');
  });

  btnCopy.addEventListener('click', () => {
    if (!receiptDataText) return;
    navigator.clipboard.writeText(receiptDataText).then(() => {
      const orig = btnCopy.innerHTML;
      btnCopy.innerHTML = `<span class="material-symbols-rounded notranslate" translate="no">check</span><span>${t('Tersalin!', 'Copied!')}</span>`;
      setTimeout(() => { btnCopy.innerHTML = orig; }, 2000);
    });
  });
})();
