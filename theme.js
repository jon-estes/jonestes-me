(function () {

  // ─── DARK / LIGHT MODE ───────────────────────────────────────────────

  const LIGHT = {
    '--bg':      '#f5f3ef',
    '--bg2':     '#ede9e3',
    '--bg3':     '#e2ddd6',
    '--border':  'rgba(0,0,0,0.09)',
    '--border2': 'rgba(0,0,0,0.16)',
    '--text':    '#1a1916',
    '--muted':   '#6b6860',
  };

  const DARK = {
    '--bg':      '#0f0f0e',
    '--bg2':     '#181816',
    '--bg3':     '#222220',
    '--border':  'rgba(255,255,255,0.08)',
    '--border2': 'rgba(255,255,255,0.14)',
    '--text':    '#f0ede6',
    '--muted':   '#8a8880',
  };

  function applyTheme(mode) {
    const vars = mode === 'light' ? LIGHT : DARK;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    localStorage.setItem('theme', mode);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = mode === 'light' ? '🌙' : '☀️';
  }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  // Apply immediately to avoid flash
  const initVars = savedTheme === 'light' ? LIGHT : DARK;
  Object.entries(initVars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(savedTheme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', () => {
      const current = localStorage.getItem('theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  });


  // ─── SEARCH ──────────────────────────────────────────────────────────

  const PAGES = [
    { title: 'Home',         url: '/',          desc: 'Personal dashboard — finance, health, collections' },
    { title: 'Estella',      url: '/estella',   desc: 'Estella Azalea — photos, gallery, baby updates' },
    { title: '529 Plan',     url: '/529',        desc: "Estella's 529 college savings fund tracker" },
    { title: 'Hawaii 🌺',   url: '/hawaii',    desc: 'Hawaii wedding research — venues, islands, budget, comparison' },
    { title: 'Contact',      url: '/contact',   desc: 'Get in touch with Jon' },
    { title: 'Salone',       url: '/salone',    desc: 'Sierra Leone — Peace Corps memories' },
    { title: 'About',        url: '/about',     desc: 'About Jon Estes' },
    { title: 'Story 🗺️',    url: '/story',     desc: 'Life timeline, world map, places visited, Peace Corps, teaching, family' },
    { title: 'Guestbook 💌', url: '/guestbook', desc: 'Leave a message for Jon' },
    { title: 'Budget 📊', url: '/budget', desc: 'Full budget tracker — income, spending, savings charts and transactions' },
  ];

  const searchStyle = document.createElement('style');
  searchStyle.textContent = `
    #search-overlay {
      display: none; position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
      align-items: flex-start; justify-content: center;
      padding-top: 15vh;
    }
    #search-overlay.open { display: flex; }
    #search-box {
      background: var(--bg2); border: 1px solid var(--border2);
      border-radius: 16px; width: 100%; max-width: 520px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.4);
      overflow: hidden; margin: 0 1rem;
    }
    #search-input {
      width: 100%; background: transparent; border: none; outline: none;
      color: var(--text); font-family: 'DM Sans', sans-serif;
      font-size: 16px; padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    #search-input::placeholder { color: var(--muted); }
    #search-results { padding: 6px; max-height: 320px; overflow-y: auto; }
    .search-result {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.7rem 0.9rem; border-radius: 10px;
      text-decoration: none; color: var(--text);
      transition: background 0.12s; cursor: pointer;
    }
    .search-result:hover, .search-result.focused {
      background: var(--bg3);
    }
    .search-result-icon { font-size: 18px; flex-shrink: 0; }
    .search-result-title { font-size: 14px; font-weight: 500; }
    .search-result-desc { font-size: 12px; color: var(--muted); margin-top: 1px; }
    #search-empty { padding: 1.25rem; text-align: center; color: var(--muted); font-size: 13px; }
    #search-hint {
      padding: 0.6rem 1.25rem; border-top: 1px solid var(--border);
      font-size: 11px; color: var(--muted); letter-spacing: 0.04em;
      display: flex; justify-content: space-between;
    }
    kbd {
      background: var(--bg3); border: 1px solid var(--border2);
      border-radius: 4px; padding: 1px 5px; font-size: 10px;
      font-family: monospace;
    }
    #search-btn {
      background: none; border: 1px solid var(--border); border-radius: 999px;
      color: var(--muted); font-size: 14px; padding: 6px 12px;
      cursor: pointer; transition: color 0.15s, border-color 0.15s;
      font-family: inherit; letter-spacing: 0.04em;
    }
    #search-btn:hover { color: var(--accent); border-color: var(--accent); }
    #theme-toggle {
      background: none; border: 1px solid var(--border); border-radius: 999px;
      font-size: 14px; padding: 5px 10px; cursor: pointer;
      transition: border-color 0.15s; line-height: 1;
    }
    #theme-toggle:hover { border-color: var(--border2); }
  `;
  document.head.appendChild(searchStyle);

  const overlay = document.createElement('div');
  overlay.id = 'search-overlay';
  overlay.innerHTML = `
    <div id="search-box">
      <input id="search-input" type="text" placeholder="Search pages…" autocomplete="off" />
      <div id="search-results"></div>
      <div id="search-hint">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate &nbsp; <kbd>↵</kbd> open &nbsp; <kbd>esc</kbd> close</span>
        <span>jonestes.me</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const icons = { '/': '🏠', '/estella': '👶', '/529': '🎓', '/hawaii': '🌺', '/contact': '✉️', '/salone': '🌍', '/about': '👤' };
  let focusIndex = -1;

  function renderResults(q) {
    const results = document.getElementById('search-results');
    const filtered = q.trim()
      ? PAGES.filter(p => (p.title + p.desc).toLowerCase().includes(q.toLowerCase()))
      : PAGES;
    focusIndex = -1;
    if (!filtered.length) {
      results.innerHTML = '<div id="search-empty">No pages found</div>';
      return;
    }
    results.innerHTML = filtered.map((p, i) => `
      <a class="search-result" href="${p.url}" data-idx="${i}">
        <span class="search-result-icon">${icons[p.url] || '📄'}</span>
        <div>
          <div class="search-result-title">${p.title}</div>
          <div class="search-result-desc">${p.desc}</div>
        </div>
      </a>
    `).join('');
  }

  function openSearch() {
    overlay.classList.add('open');
    document.getElementById('search-input').value = '';
    renderResults('');
    setTimeout(() => document.getElementById('search-input').focus(), 50);
    document.body.style.overflow = 'hidden';
  }

  function closeSearch() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });

  document.getElementById('search-input').addEventListener('input', e => renderResults(e.target.value));

  document.getElementById('search-input').addEventListener('keydown', e => {
    const items = document.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex = Math.min(focusIndex + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex = Math.max(focusIndex - 1, 0); }
    else if (e.key === 'Enter' && focusIndex >= 0) { window.location = items[focusIndex].href; return; }
    else if (e.key === 'Escape') { closeSearch(); return; }
    items.forEach((el, i) => el.classList.toggle('focused', i === focusIndex));
    if (focusIndex >= 0) items[focusIndex].scrollIntoView({ block: 'nearest' });
  });

  // Keyboard shortcut: Cmd+K or Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSearch();
  });

  // Expose for nav button
  window.__openSearch = openSearch;

})();
