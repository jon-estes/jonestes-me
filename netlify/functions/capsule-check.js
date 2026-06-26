// netlify/functions/capsule-check.js
// Scheduled function: checks capsule.items daily and emails (via Resend)
// when one or more capsules cross their unlock date.
//
// SETUP:
// 1. Env vars needed (Netlify → Site settings → Environment variables):
//      UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (already set)
//      RESEND_KEY      — already set (function also accepts RESEND_API_KEY)
//      CAPSULE_EMAIL   — where to send unlock notices (falls back to ALERT_EMAIL)
//      ALERT_FROM      — verified sender, e.g. alerts@mendemarketing.com
// 2. Schedule it in netlify.toml:
//      [functions."capsule-check"]
//      schedule = "0 16 * * *"   # 8am Pacific, every day (UTC cron)
//
// Manual test: open /.netlify/functions/capsule-check in the browser.

const HKEY = 'sitetools';

exports.handler = async () => {
  const out = { checked: false, unlockedToday: [] };
  try {
    const rUrl = process.env.UPSTASH_REDIS_REST_URL;
    const rTok = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!rUrl || !rTok) return resp(500, { error: 'Upstash env vars missing' });

    const redis = async (cmd) => {
      const r = await fetch(rUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rTok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      return r.json();
    };

    // 1) load capsule list
    const iRes = await redis(['HGET', HKEY, 'capsule.items']);
    let items = [];
    try { items = JSON.parse(iRes.result || '[]'); } catch {}
    out.checked = true;
    if (!items.length) return resp(200, { ...out, note: 'no capsules exist' });

    // 2) find ones that just crossed their unlock date and haven't been notified
    const today = new Date().toISOString().slice(0, 10);
    const due = items.filter((it) => it.unlockDate <= today && !it.notified);
    if (!due.length) return resp(200, { ...out, note: 'nothing newly unlocked' });

    // 3) email via Resend — one digest email covering all that unlocked today
    const rsKey = process.env.RESEND_KEY || process.env.RESEND_API_KEY;
    const to = process.env.CAPSULE_EMAIL || process.env.ALERT_EMAIL;
    const from = process.env.ALERT_FROM || 'onboarding@resend.dev';
    if (!rsKey || !to) return resp(500, { error: 'RESEND_KEY or CAPSULE_EMAIL/ALERT_EMAIL missing', ...out });

    const rows = due.map((it) => `
      <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #e3ddc9;border-radius:8px;">
        <div style="font-size:1.05rem;font-weight:600;">💌 ${escapeHtml(it.title || 'A message')}</div>
        <div style="color:#777;font-size:.85rem;margin:4px 0 8px;">To ${escapeHtml(it.to)} · from ${escapeHtml(it.from || '—')}</div>
        <div style="color:#444;font-size:.92rem;">${escapeHtml((it.message || '').slice(0, 220))}${(it.message || '').length > 220 ? '…' : ''}</div>
      </div>`).join('');

    const subject = due.length === 1
      ? `💌 A time capsule for ${due[0].to} just unlocked`
      : `💌 ${due.length} time capsules just unlocked`;

    const html = `
      <div style="font-family:Georgia,serif;max-width:540px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 12px;">Time Capsule</h2>
        <p style="color:#666;">The following ${due.length === 1 ? 'capsule has' : 'capsules have'} reached its unlock date:</p>
        ${rows}
        <p style="font-size:.8rem;color:#999;">View and read at jonestes.me/capsule</p>
      </div>`;

    const eRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rsKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!eRes.ok) return resp(502, { error: 'Resend ' + eRes.status + ': ' + (await eRes.text()).slice(0, 200), ...out });

    // 4) mark those as notified and save back
    const idsDue = new Set(due.map((it) => it.id));
    items = items.map((it) => (idsDue.has(it.id) ? { ...it, notified: true } : it));
    await redis(['HSET', HKEY, 'capsule.items', JSON.stringify(items)]);

    out.unlockedToday = due.map((it) => ({ id: it.id, to: it.to, title: it.title }));
    return resp(200, out);
  } catch (e) {
    return resp(500, { error: String((e && e.message) || e), ...out });
  }
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function resp(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
