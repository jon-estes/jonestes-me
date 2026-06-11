// netlify/functions/spot-alert.js
// Scheduled function: checks silver spot daily and emails you (via Resend)
// when it crosses the thresholds you set on the HQ page (alerts.silver).
//
// SETUP:
// 1. Env vars needed (Netlify → Site settings → Environment variables):
//      UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (already set)
//      GOLDAPI_KEY    — your goldapi.io key (same one the silver page uses)
//      RESEND_KEY     — your Resend key (already set — function also accepts RESEND_API_KEY)
//      ALERT_EMAIL    — where to send alerts (your inbox)
//      ALERT_FROM     — verified sender, e.g. alerts@mendemarketing.com
// 2. Schedule it in netlify.toml:
//      [functions."spot-alert"]
//      schedule = "0 16 * * 1-5"   # 8am Pacific, weekdays (UTC cron)
//
// Manual test: open /.netlify/functions/spot-alert in the browser.

const HKEY = 'sitetools';

exports.handler = async () => {
  const out = { checked: false, spot: null, fired: null };
  try {
    const rUrl = process.env.UPSTASH_REDIS_REST_URL;
    const rTok = process.env.UPSTASH_REDIS_REST_TOKEN;
    const gKey = process.env.GOLDAPI_KEY;
    if (!rUrl || !rTok) return resp(500, { error: 'Upstash env vars missing' });
    if (!gKey) return resp(500, { error: 'GOLDAPI_KEY missing' });

    const redis = async (cmd) => {
      const r = await fetch(rUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${rTok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      return r.json();
    };

    // 1) thresholds
    const tRes = await redis(['HGET', HKEY, 'alerts.silver']);
    let thresholds = {};
    try { thresholds = JSON.parse(tRes.result || '{}'); } catch {}
    const above = thresholds.above !== null && thresholds.above !== undefined && thresholds.above !== '' ? Number(thresholds.above) : null;
    const below = thresholds.below !== null && thresholds.below !== undefined && thresholds.below !== '' ? Number(thresholds.below) : null;
    if (above === null && below === null) return resp(200, { ...out, note: 'no thresholds set on HQ — nothing to check' });

    // 2) live spot from GoldAPI (XAG/USD, price per troy oz)
    const gRes = await fetch('https://www.goldapi.io/api/XAG/USD', {
      headers: { 'x-access-token': gKey, 'Content-Type': 'application/json' },
    });
    if (!gRes.ok) return resp(502, { error: 'GoldAPI ' + gRes.status });
    const g = await gRes.json();
    const spot = Number(g.price);
    out.checked = true;
    out.spot = spot;
    if (!spot || isNaN(spot)) return resp(502, { error: 'no price in GoldAPI response' });

    // keep the melt calculator's synced spot fresh as a bonus
    try {
      const mRes = await redis(['HGET', HKEY, 'meltCalc.state']);
      const m = JSON.parse(mRes.result || '{}');
      m.spotAg = spot.toFixed(2);
      await redis(['HSET', HKEY, 'meltCalc.state', JSON.stringify(m)]);
    } catch {}

    // 3) crossing check, max one email per direction per day
    const today = new Date().toISOString().slice(0, 10);
    let fired = null;
    if (above !== null && spot >= above && thresholds.lastAbove !== today) fired = { dir: 'above', level: above };
    else if (below !== null && spot <= below && thresholds.lastBelow !== today) fired = { dir: 'below', level: below };
    if (!fired) return resp(200, { ...out, note: 'no threshold crossed (or already alerted today)' });

    // 4) email via Resend
    const rsKey = process.env.RESEND_KEY || process.env.RESEND_API_KEY;
    const to = process.env.ALERT_EMAIL;
    const from = process.env.ALERT_FROM || 'onboarding@resend.dev';
    if (!rsKey || !to) return resp(500, { error: 'RESEND_KEY or ALERT_EMAIL missing', ...out });

    const subject = `🔔 Silver ${fired.dir === 'above' ? 'broke above' : 'dropped below'} $${fired.level.toFixed(2)} — now $${spot.toFixed(2)}`;
    const html = `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="margin:0 0 4px;">Silver Alert</h2>
        <p style="font-size:2rem;margin:8px 0;color:${fired.dir === 'above' ? '#2e7d32' : '#c62828'};">
          $${spot.toFixed(2)}<span style="font-size:.9rem;color:#888;"> /ozt</span>
        </p>
        <p>Spot has gone <strong>${fired.dir}</strong> your $${fired.level.toFixed(2)} threshold.</p>
        <p style="color:#666;font-size:.9rem;">Junk silver melt: <strong>$${(spot * 0.715).toFixed(2)}</strong> per $1 face ·
          90% dime $${(spot * 0.0723).toFixed(2)} · quarter $${(spot * 0.1808).toFixed(2)} · half $${(spot * 0.3617).toFixed(2)}</p>
        <p style="font-size:.8rem;color:#999;">Adjust thresholds at jonestes.me/hq · You'll get at most one ${fired.dir}-alert per day.</p>
      </div>`;
    const eRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rsKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!eRes.ok) return resp(502, { error: 'Resend ' + eRes.status + ': ' + (await eRes.text()).slice(0, 200), ...out });

    // 5) record that we fired today
    if (fired.dir === 'above') thresholds.lastAbove = today; else thresholds.lastBelow = today;
    await redis(['HSET', HKEY, 'alerts.silver', JSON.stringify(thresholds)]);
    out.fired = fired;
    return resp(200, out);
  } catch (e) {
    return resp(500, { error: String((e && e.message) || e), ...out });
  }
};

function resp(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
