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

exports.handler = async (event) => {
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
      for (let i = 0; i < arr.length; i += 2) obj[arr[i]] = arr[i + 1];
      return { statusCode: 200, headers: baseHeaders, body: JSON.stringify(obj) };
    }

    if (event.httpMethod === 'POST') {
      let updates;
      try { updates = (JSON.parse(event.body || '{}')).updates; } catch { updates = null; }
      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'body must be {updates:{key:value}}' }) };
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
