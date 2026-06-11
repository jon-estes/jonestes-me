// netlify/functions/store.js
// Generic site-wide key-value store backed by Upstash Redis.
// All tool data lives in one Redis hash ("sitetools"), one field per localStorage key.
// GET  -> returns the whole hash as JSON {key: value, ...}
// POST -> body {updates: {key: value|null, ...}}  (null deletes the key)
//
// Uses the same Upstash env vars as the leadgen tool:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// (Set in Netlify → Site settings → Environment variables if not already there.)

const HKEY = 'sitetools';
const MAX_KEY_LEN = 120;
const MAX_VAL_LEN = 200000; // ~200 KB per field — plenty for any tool's JSON

// Fields anyone may read/write without the PIN (public leaderboards).
const PUBLIC_PREFIXES = ['poker.'];
const isPublic = (k) => PUBLIC_PREFIXES.some((p) => k.indexOf(p) === 0);

exports.handler = async (event) => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,x-pin',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders, body: '' };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: 'Upstash env vars missing (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)' }) };
  }

  // PIN gate: if STORE_PIN env var is set, private fields require it.
  // Accepted via x-pin header or body.pin (sendBeacon can't set headers).
  const PIN = process.env.STORE_PIN || '';
  let bodyParsed = null;
  try { bodyParsed = JSON.parse(event.body || '{}'); } catch { bodyParsed = {}; }
  const givenPin = (event.headers && (event.headers['x-pin'] || event.headers['X-Pin'])) || bodyParsed.pin || '';
  const authed = !PIN || givenPin === PIN;

  const redis = async (cmd) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) throw new Error('Upstash ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  };

  try {
    if (event.httpMethod === 'GET') {
      const r = await redis(['HGETALL', HKEY]);
      // Upstash returns a flat [field, value, field, value, ...] array
      const arr = r.result || [];
      const obj = {};
      for (let i = 0; i < arr.length; i += 2) {
        if (authed || isPublic(arr[i])) obj[arr[i]] = arr[i + 1];
      }
      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify(obj) };
    }

    if (event.httpMethod === 'POST') {
      const updates = bodyParsed.updates;
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'body must be {updates:{key:value}}' }) };
      }
      if (!authed && Object.keys(updates).some((k) => !isPublic(k))) {
        return { statusCode: 401, headers: baseHeaders, body: JSON.stringify({ error: 'pin required for private fields' }) };
      }

      const sets = ['HSET', HKEY];
      const dels = ['HDEL', HKEY];
      for (const [k, v] of Object.entries(updates)) {
        if (typeof k !== 'string' || !k || k.length > MAX_KEY_LEN) continue;
        if (v === null) { dels.push(k); continue; }
        if (typeof v === 'string' && v.length <= MAX_VAL_LEN) sets.push(k, v);
      }
      if (sets.length > 2) await redis(sets);
      if (dels.length > 2) await redis(dels);
      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify({ ok: true, set: (sets.length - 2) / 2, deleted: dels.length - 2 }) };
    }

    return { statusCode: 405, headers: baseHeaders, body: JSON.stringify({ error: 'method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
