// netlify/functions/calendar-feed.js
//
// Server-side calendar aggregator. Reads 5 secret iCal URLs from environment
// variables (so they're never exposed in page source), fetches each feed,
// parses events in the next WINDOW_DAYS, and returns plain JSON.
// No Google login, no OAuth, no CORS issues — it's just a fetch from your own server.
//
// SETUP (Netlify dashboard → Site settings → Environment variables), add:
//   CAL_ICS_JON     = <Jon's secret iCal URL>
//   CAL_ICS_LORINA  = <Lorina's secret iCal URL>
//   CAL_ICS_ASHLEY  = <Ashley's secret iCal URL>
//   CAL_ICS_FAMILY  = <Family calendar's secret iCal URL>
// Redeploy after adding env vars so the function picks them up.
// (Damin's calendar is intentionally left out — he mainly uses Family anyway.)

const FEEDS = [
  { label: "Jon", color: "#d4af37", env: "CAL_ICS_JON" },
  { label: "Lorina", color: "#b87333", env: "CAL_ICS_LORINA" },
  { label: "Ashley", color: "#6b9080", env: "CAL_ICS_ASHLEY" },
  { label: "Family", color: "#c1554a", env: "CAL_ICS_FAMILY" },
];

const WINDOW_DAYS = 14;

exports.handler = async function () {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const calendars = await Promise.all(
    FEEDS.map(async (feed) => {
      const url = process.env[feed.env];
      if (!url) {
        return { label: feed.label, color: feed.color, events: [], error: `${feed.env} not set` };
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const events = parseIcs(text, now, windowEnd);
        return { label: feed.label, color: feed.color, events };
      } catch (err) {
        return { label: feed.label, color: feed.color, events: [], error: String(err.message || err) };
      }
    })
  );

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300", // 5 min edge cache, keeps it snappy + light on Google
    },
    body: JSON.stringify({ generatedAt: now.toISOString(), calendars }),
  };
};

// ---- Minimal ICS parser ----
// Handles single events fully, plus simple DAILY/WEEKLY recurrence (COUNT/UNTIL).
// Unsupported recurrence patterns (monthly, yearly, BYDAY exceptions, etc.) fall
// back to showing just the first occurrence — covers the vast majority of real
// family-calendar events. Upgrade to the `node-ical` npm package later if you
// start relying on complex recurring events.
function parseIcs(text, rangeStart, rangeEnd) {
  const unfolded = text.replace(/\r\n[ \t]/g, ""); // un-fold continuation lines per RFC 5545
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);
  const events = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0];
    const get = (key) => {
      const m = body.match(new RegExp("^" + key + "(;[^:\\r\\n]*)?:(.+)$", "m"));
      return m ? m[2].trim() : null;
    };

    const summary = (get("SUMMARY") || "(untitled)").replace(/\\,/g, ",").replace(/\\n/gi, " ");
    const dtstart = get("DTSTART");
    const rrule = get("RRULE");
    if (!dtstart) continue;

    const allDay = /^\d{8}$/.test(dtstart);
    const baseDate = parseIcsDate(dtstart);
    if (!baseDate) continue;

    if (!rrule) {
      if (baseDate >= rangeStart && baseDate <= rangeEnd) {
        events.push({ summary, start: baseDate.toISOString(), allDay });
      }
      continue;
    }

    const freqMatch = rrule.match(/FREQ=([A-Z]+)/);
    const countMatch = rrule.match(/COUNT=(\d+)/);
    const untilMatch = rrule.match(/UNTIL=([0-9TZ]+)/);
    const freq = freqMatch ? freqMatch[1] : null;
    const maxCount = countMatch ? parseInt(countMatch[1], 10) : 60;
    const until = untilMatch ? parseIcsDate(untilMatch[1]) : rangeEnd;

    if (freq !== "DAILY" && freq !== "WEEKLY") {
      if (baseDate >= rangeStart && baseDate <= rangeEnd) {
        events.push({ summary, start: baseDate.toISOString(), allDay });
      }
      continue;
    }

    const stepDays = freq === "DAILY" ? 1 : 7;
    let occurrence = new Date(baseDate);
    let count = 0;
    while (occurrence <= rangeEnd && occurrence <= until && count < maxCount) {
      if (occurrence >= rangeStart) {
        events.push({ summary, start: occurrence.toISOString(), allDay });
      }
      occurrence = new Date(occurrence.getTime() + stepDays * 86400000);
      count++;
    }
  }

  return events;
}

function parseIcsDate(value) {
  // formats: 20260701T180000Z | 20260701T180000 | 20260701
  const m = value.match(/(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})Z?)?/);
  if (!m) return null;
  const [, y, mo, d, , h = "00", mi = "00", s = "00"] = m;
  if (value.endsWith("Z")) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}
