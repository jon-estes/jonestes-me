// ============================================================
//  CONFIGURATION — fill these in before uploading
// ============================================================

const CONFIG = {
  // From Google Cloud Console > Credentials > OAuth 2.0 Client ID
  CLIENT_ID: '778179999520-70l2nijraakphsr883ui80c5u6gej90p.apps.googleusercontent.com',

  // From Google Cloud Console > Credentials > API Key
  // Restrict it to HTTP referrers (jonestes.me/*) + Google Calendar API
  API_KEY: 'AIzaSyAZ2cClT6emTpEWR2RyoqmfsgN9qAbgwqU',

  // All calendar IDs you want to display
  // Find these in Google Calendar > Settings > each calendar > "Calendar ID"
  CALENDARS: [
    { id: 'jonstutoring530@gmail.com',                          label: 'Jon',    color: '#2a5298', light: '#dde5f5' },
    { id: 'lorinaestes@gmail.com',                              label: 'Lorina', color: '#b5476e', light: '#f5dde7' },
    { id: 'ashleymarie0497@gmail.com',                          label: 'Ashley', color: '#1a8a62', light: '#d5f0e6' },
    { id: 'daminestes@gmail.com',                               label: 'Damin',  color: '#b06a10', light: '#f5e8d0' },
    { id: 'family12059815905162115878@group.calendar.google.com', label: 'Family', color: '#c04a20', light: '#f5e0d8' },
  ],

  // OAuth scope needed for read-only calendar access
  SCOPES: 'https://www.googleapis.com/auth/calendar.readonly',

  // Discovery doc for the Calendar API
  DISCOVERY_DOC: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
};

// ============================================================
//  STATE
// ============================================================

let state = {
  view: 'month',        // 'month' | 'week' | 'list'
  date: new Date(),     // current anchor date
  events: [],           // all fetched events
  loading: false,
  tokenClient: null,
  gapiReady: false,
  gisReady: false,
};

// ============================================================
//  GOOGLE API BOOTSTRAP
// ============================================================

// Load the gapi client library (for Calendar API calls)
function gapiLoaded() {
  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: CONFIG.API_KEY,
      discoveryDocs: [CONFIG.DISCOVERY_DOC],
    });
    state.gapiReady = true;
    maybeShowUI();
  });
}

// Called by GIS once the script loads
function gisLoaded() {
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        showCalendarUI();
        await fetchAllCalendars();
      }
    },
  });
  state.gisReady = true;
  maybeShowUI();
}

function maybeShowUI() {
  // Only proceed once both libraries are ready
  if (!state.gapiReady || !state.gisReady) return;

  // Check if we already have a valid token in this session
  const token = gapi.client.getToken();
  if (token) {
    showCalendarUI();
    fetchAllCalendars();
  } else {
    showAuthUI();
  }
}

// ============================================================
//  AUTH UI
// ============================================================

function showAuthUI() {
  document.getElementById('auth-section').style.display = '';
  document.getElementById('calendar-section').style.display = 'none';
}

function showCalendarUI() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('calendar-section').style.display = '';
}

document.getElementById('authorize-btn').addEventListener('click', () => {
  if (gapi.client.getToken() === null) {
    // First time: show consent screen
    state.tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    // Already authorized this session: skip consent
    state.tokenClient.requestAccessToken({ prompt: '' });
  }
});

document.getElementById('signout-btn').addEventListener('click', () => {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
  showAuthUI();
  state.events = [];
});

// ============================================================
//  FETCHING EVENTS
// ============================================================

async function fetchAllCalendars() {
  state.loading = true;
  renderCalBody('<div class="loading-state"><div class="spinner"></div>Fetching your calendars…</div>');

  // Determine time window based on current view
  const { start, end } = getTimeWindow();

  try {
    // Fetch all calendars in parallel
    const results = await Promise.allSettled(
      CONFIG.CALENDARS.map(cal =>
        gapi.client.calendar.events.list({
          calendarId: cal.id,
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          showDeleted: false,
          singleEvents: true,
          maxResults: 500,
          orderBy: 'startTime',
        }).then(resp => ({ calId: cal.id, items: resp.result.items || [] }))
      )
    );

    state.events = [];
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        const { calId, items } = result.value;
        items.forEach(item => {
          const allDay = !!item.start.date;
          state.events.push({
            id: item.id,
            title: item.summary || '(no title)',
            start: allDay ? new Date(item.start.date + 'T00:00:00') : new Date(item.start.dateTime),
            end:   allDay ? new Date(item.end.date   + 'T00:00:00') : new Date(item.end.dateTime),
            allDay,
            calendarId: calId,
            location: item.location || null,
          });
        });
      }
    });

    state.loading = false;
    renderCurrentView();
  } catch (err) {
    state.loading = false;
    renderCalBody(`<div style="padding:2rem;color:#c04a20;font-size:14px;">
      Error loading calendar: ${err.message || err}.<br>
      Try signing out and back in.
    </div>`);
  }
}

function getTimeWindow() {
  const d = state.date;
  let start, end;

  if (state.view === 'month') {
    // Fetch the whole month grid (includes cells from prev/next months)
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    s.setDate(s.getDate() - s.getDay()); // back to Sunday
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    e.setDate(e.getDate() + (6 - e.getDay()) + 1); // forward to Saturday + 1
    start = s; end = e;
  } else {
    // Week view / list: one week window starting this week's Sunday
    const dow = d.getDay();
    start = new Date(d); start.setDate(d.getDate() - dow); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(start.getDate() + 7);
  }

  return { start, end };
}

// ============================================================
//  NAVIGATION & VIEW SWITCHING
// ============================================================

document.getElementById('prev-btn').addEventListener('click', () => navigate(-1));
document.getElementById('next-btn').addEventListener('click', () => navigate(1));
document.getElementById('today-btn').addEventListener('click', () => {
  state.date = new Date();
  fetchAllCalendars();
});

document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    fetchAllCalendars();
  });
});

function navigate(dir) {
  const d = new Date(state.date);
  if (state.view === 'month') {
    d.setMonth(d.getMonth() + dir);
  } else {
    d.setDate(d.getDate() + 7 * dir);
  }
  state.date = d;
  fetchAllCalendars();
}

// ============================================================
//  RENDER HELPERS
// ============================================================

function renderCalBody(html) {
  document.getElementById('cal-body').innerHTML = html;
}

function calInfo(calId) {
  return CONFIG.CALENDARS.find(c => c.id === calId)
    || { label: 'Other', color: '#666360', light: '#ebebeb' };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function fmt12(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function eventsForDay(date) {
  return state.events.filter(ev => {
    if (ev.allDay) {
      const s = new Date(ev.start); s.setHours(0,0,0,0);
      const e = new Date(ev.end);   e.setHours(0,0,0,0);
      const d = new Date(date);     d.setHours(0,0,0,0);
      return d >= s && d < e;
    }
    return isSameDay(ev.start, date);
  }).sort((a,b) => a.start - b.start);
}

// ============================================================
//  MONTH VIEW
// ============================================================

function renderMonthView() {
  const today = new Date();
  const d = state.date;

  // Update label
  document.getElementById('cal-month-label').textContent =
    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let cellsHtml = '';
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);

    const isOther = day.getMonth() !== d.getMonth();
    const isToday = isSameDay(day, today);
    const dayEvs = eventsForDay(day);
    const maxShow = 3;
    const extra = dayEvs.length - maxShow;

    let pillsHtml = '';
    dayEvs.slice(0, maxShow).forEach(ev => {
      const c = calInfo(ev.calendarId);
      const timePrefix = ev.allDay ? '' : fmt12(ev.start) + ' ';
      pillsHtml += `<div class="event-pill" style="background:${c.light};color:${c.color}" title="${esc(ev.title)}">${esc(timePrefix + ev.title)}</div>`;
    });
    if (extra > 0) pillsHtml += `<div class="more-events">+${extra} more</div>`;

    cellsHtml += `<div class="day-cell${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}">
      <div class="day-num-wrap"><span class="day-num">${day.getDate()}</span></div>
      ${pillsHtml}
    </div>`;
  }

  const dowRow = DOW.map(l => `<div class="dow-label">${l}</div>`).join('');

  renderCalBody(`
    <div class="month-grid-header">${dowRow}</div>
    <div class="month-grid">${cellsHtml}</div>
  `);
}

// ============================================================
//  WEEK VIEW
// ============================================================

function renderWeekView() {
  const today = new Date();
  const d = state.date;
  const dow = d.getDay();
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - dow);
  weekStart.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(weekStart);
    x.setDate(weekStart.getDate() + i);
    return x;
  });

  const rangeLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  document.getElementById('cal-month-label').textContent = rangeLabel;

  // Column headers
  let headerHtml = '<div class="week-col-header corner"></div>';
  days.forEach(day => {
    const isToday = isSameDay(day, today);
    const lbl = day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    headerHtml += `<div class="week-col-header${isToday ? ' is-today' : ''}">${lbl}</div>`;
  });

  // All-day row
  let allDayHtml = '<div class="week-allday-cell corner">all‑day</div>';
  days.forEach(day => {
    const allDayEvs = state.events.filter(ev => {
      if (!ev.allDay) return false;
      const s = new Date(ev.start); s.setHours(0,0,0,0);
      const e = new Date(ev.end);   e.setHours(0,0,0,0);
      const dd = new Date(day);     dd.setHours(0,0,0,0);
      return dd >= s && dd < e;
    });
    let adHtml = '';
    allDayEvs.forEach(ev => {
      const c = calInfo(ev.calendarId);
      adHtml += `<div class="event-pill" style="background:${c.light};color:${c.color};margin-bottom:2px" title="${esc(ev.title)}">${esc(ev.title)}</div>`;
    });
    allDayHtml += `<div class="week-allday-cell">${adHtml}</div>`;
  });

  // Hour rows
  let hoursHtml = '';
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`;
    let cells = `<div class="week-time-label">${label}</div>`;

    days.forEach(day => {
      const isToday = isSameDay(day, today);
      const hourEvs = state.events.filter(ev =>
        !ev.allDay && isSameDay(ev.start, day) && ev.start.getHours() === h
      );
      let evHtml = '';
      hourEvs.forEach(ev => {
        const c = calInfo(ev.calendarId);
        const durH = Math.max(1, Math.round((ev.end - ev.start) / 3600000));
        const ht = Math.min(durH * 44 - 2, 200);
        evHtml += `<div class="week-event-block" style="background:${c.light};color:${c.color};height:${ht}px" title="${esc(ev.title)}">${esc(ev.title)}</div>`;
      });
      cells += `<div class="week-cell${isToday ? ' is-today' : ''}">${evHtml}</div>`;
    });

    hoursHtml += `<div style="display:contents">${cells}</div>`;
  }

  renderCalBody(`
    <div class="week-scroll">
      <div class="week-grid" style="grid-template-rows: 36px 28px repeat(24, 44px)">
        ${headerHtml}
        ${allDayHtml}
        ${hoursHtml}
      </div>
    </div>
  `);
}

// ============================================================
//  LIST VIEW
// ============================================================

function renderListView() {
  const today = new Date();
  const d = state.date;

  // Show 60 days from today's month start
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end   = new Date(d.getFullYear(), d.getMonth() + 2, 0);

  document.getElementById('cal-month-label').textContent =
    d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const upcoming = state.events
    .filter(ev => ev.start >= start && ev.start <= end)
    .sort((a, b) => a.start - b.start);

  if (upcoming.length === 0) {
    renderCalBody('<div class="no-events">No events found for this period.</div>');
    return;
  }

  // Group by day
  const byDay = new Map();
  upcoming.forEach(ev => {
    const key = ev.start.toDateString();
    if (!byDay.has(key)) byDay.set(key, { date: ev.start, events: [] });
    byDay.get(key).events.push(ev);
  });

  let html = '';
  byDay.forEach(({ date, events }) => {
    const isToday = isSameDay(date, today);
    const lbl = isToday
      ? 'Today — ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let evHtml = '';
    events.forEach(ev => {
      const c = calInfo(ev.calendarId);
      const timeStr = ev.allDay
        ? 'All day'
        : `${fmt12(ev.start)} – ${fmt12(ev.end)}`;
      evHtml += `<div class="list-event-row">
        <div class="event-color-dot" style="background:${c.color}"></div>
        <div class="event-details">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-meta">${timeStr} · ${c.label}${ev.location ? ' · ' + esc(ev.location) : ''}</div>
        </div>
      </div>`;
    });

    html += `<div class="list-section">
      <div class="list-date-header${isToday ? ' is-today' : ''}">${lbl}</div>
      ${evHtml}
    </div>`;
  });

  renderCalBody(html);
}

// ============================================================
//  LEGEND
// ============================================================

function renderLegend() {
  const legend = document.getElementById('cal-legend');
  legend.innerHTML = CONFIG.CALENDARS.map(c =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${c.color}"></div>
      ${c.label}
    </div>`
  ).join('');
}

// ============================================================
//  MAIN RENDER DISPATCHER
// ============================================================

function renderCurrentView() {
  renderLegend();
  if (state.view === 'month') renderMonthView();
  else if (state.view === 'week') renderWeekView();
  else renderListView();
}

// ============================================================
//  UTILITY
// ============================================================

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
//  KICK OFF — called by Google's script tags via onload
// ============================================================

// Load gapi + gis. These functions are called by the script tags below
// (added dynamically so they fire after the page loads).
window.addEventListener('load', () => {
  // Load gapi
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => gapiLoaded();
  document.body.appendChild(gapiScript);

  // gis (Google Identity Services) is already loaded via the <script> in HTML
  // but we poll for it since it loads async
  const gisInterval = setInterval(() => {
    if (window.google && window.google.accounts) {
      clearInterval(gisInterval);
      gisLoaded();
    }
  }, 100);
});
