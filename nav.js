(function () {
  const page = window.location.pathname.split('/').pop() || '';
  const isEstella = page === 'estella.html' || page === 'estella529.html';

  const style = document.createElement('style');
  style.textContent = `
    nav { display: flex; justify-content: center; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 2.5rem; padding-top: 1.5rem; opacity: 0; animation: fadeUp 0.5s ease forwards; }
    nav a { font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); text-decoration: none; padding: 6px 14px; border: 1px solid var(--border); border-radius: 999px; transition: color 0.15s, border-color 0.15s; }
    nav a:hover, nav a.active { color: var(--accent); border-color: var(--accent); }
    #theme-toggle { background: none; border: 1px solid var(--border); border-radius: 999px; font-size: 14px; padding: 5px 10px; cursor: pointer; transition: border-color 0.15s; line-height: 1; }
    #theme-toggle:hover { border-color: var(--border2); }
  `;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.innerHTML = `
    <a href="/"${page === '' || page === 'index.html' ? ' class="active"' : ''}>Home</a>
    <a href="/estella"${isEstella ? ' class="active"' : ''}>Estella</a>
    <a href="/hawaii"${page === 'hawaii.html' ? ' class="active"' : ''}>🌺 Hawaii</a>
    <a href="/contact"${page === 'contact.html' ? ' class="active"' : ''}>Contact</a>
    <button id="theme-toggle" title="Toggle theme">☀️</button>
  `;

  const existing = document.querySelector('nav');
  if (existing) {
    existing.replaceWith(nav);
  } else {
    document.body.insertBefore(nav, document.body.firstChild);
  }
})();
