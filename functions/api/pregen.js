const IDT_URL = "https://www.googleapis.com/identitytoolkit/v3/relyingparty";
const VERIFY_URL = "https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase";

const ANDROID_HEADERS = {
  "content-type": "application/json",
  "x-android-package": "com.alightcreative.motion",
  "x-android-cert": "ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8",
  "user-agent": "dalvik/2.1.0 (linux; u; android 15; 23127pn0cc build/bp1a.250505.005)"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function makeOrderId() {
  const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  return `FISH-${digits(4)}-${digits(4)}-${digits(4)}-${digits(5)}`;
}

function extractCode(raw) {
  if (!raw) return null;
  let value = String(raw).replace(/&amp;/g, "&").trim();
  try { value = decodeURIComponent(value); } catch { }
  const fromUrl = (src) => {
    try {
      const u = new URL(src);
      const direct = u.searchParams.get("oobCode");
      if (direct) return direct;
      for (const key of ["link", "q", "url", "continueUrl"]) {
        const nested = u.searchParams.get(key);
        if (!nested) continue;
        try {
          const inner = new URL(nested).searchParams.get("oobCode");
          if (inner) return inner;
        } catch { }
      }
    } catch { }
    return null;
  };
  const code = fromUrl(value) || value.match(/[?&]oobCode=([A-Za-z0-9_-]+)/)?.[1];
  if (code) return code.replace(/[^A-Za-z0-9_-]/g, "");
  return /^[A-Za-z0-9_-]{10,}$/.test(value) && !value.includes("://") ? value : null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Wajib diambil murni dari Environment Variables (Cloudflare Pages Dashboard / .dev.vars / .env)
  const apiKey = env.ALIGHT_API_KEY || env.API_KEY;
  const purchaseToken = env.ALIGHT_PURCHASE_TOKEN || env.PURCHASE_TOKEN;
  const instanceToken = env.ALIGHT_INSTANCE_TOKEN || env.INSTANCE_TOKEN;

  if (!apiKey || !purchaseToken || !instanceToken) {
    return json({
      error: "Konfigurasi server belum lengkap. API_KEY, PURCHASE_TOKEN, atau INSTANCE_TOKEN belum disetel di .env / dashboard."
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON request" }, 400);
  }

  const { action, email, link } = body || {};

  // 1. Action: Kirim magic link verifikasi
  if (action === "send-link") {
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Format email tidak valid." }, 400);
    }

    try {
      const url = `${IDT_URL}/getOobConfirmationCode?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: ANDROID_HEADERS,
        body: JSON.stringify({
          requestType: 6,
          email: email.trim().toLowerCase(),
          androidInstallApp: true,
          canHandleCodeInApp: true,
          continueUrl: "https://alightcreative.com?ui_sid=0366624874&ui_sd=0",
          iosBundleId: "com.alightcreative.motion",
          androidPackageName: "com.alightcreative.motion",
          androidMinimumVersion: "585",
          clientType: "CLIENT_TYPE_ANDROID"
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ error: data?.error?.message || `Gagal mengirim link (${res.status})` }, res.status);
      }
      return json({ success: true, email });
    } catch (err) {
      return json({ error: err.message || "Gagal menghubungi auth server." }, 500);
    }
  }

  // 2. Action: Aktivasi lisensi Pro
  if (action === "activate") {
    if (!email || !link) {
      return json({ error: "Email dan tautan aktivasi wajib diisi." }, 400);
    }

    const code = extractCode(link);
    if (!code) {
      return json({ error: "Kode oobCode tidak ditemukan di URL. Salin link lengkap dari email." }, 400);
    }

    try {
      // Step A: Sign in email link
      const authUrl = `${IDT_URL}/emailLinkSignin?key=${encodeURIComponent(apiKey)}`;
      const authRes = await fetch(authUrl, {
        method: "POST",
        headers: ANDROID_HEADERS,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          oobCode: code,
          clientType: "CLIENT_TYPE_ANDROID"
        })
      });

      const auth = await authRes.json().catch(() => ({}));
      if (!authRes.ok || !auth?.idToken) {
        return json({ error: auth?.error?.message || "Gagal memverifikasi token link email." }, authRes.status || 400);
      }

      // Step B: Verifikasi Purchase ke Alight Creative
      const orderId = makeOrderId();
      const verifyRes = await fetch(VERIFY_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "user-agent": "okhttp/3.12.1",
          authorization: `Bearer ${auth.idToken}`,
          "firebase-instance-id-token": instanceToken
        },
        body: JSON.stringify({
          data: {
            productId: "am.full.sub.annual.19q4",
            token: purchaseToken,
            skuType: "subs",
            orderId
          }
        })
      });

      const verifyData = await verifyRes.json().catch(() => ({}));
      const accepted = verifyData?.result?.status === "success" || verifyData?.result?.valid === true;
      const expiry = Number(verifyData?.result?.result?.expiryTimeMillis || verifyData?.result?.expiryTimeMillis || 0);

      if (!accepted) {
        return json({ error: `Server menolak aktivasi (${verifyData?.result?.status || "gagal"})` }, 400);
      }

      return json({
        success: true,
        orderId,
        expiry,
        email: email.trim().toLowerCase()
      });
    } catch (err) {
      return json({ error: err.message || "Gagal memproses aktivasi." }, 500);
    }
  }

  return json({ error: "Action tidak dikenal." }, 400);
}
