/**
 * cmdk.js — universal command palette for jonestes.me
 * Drop this on every page:  <script src="/cmdk.js" defer></script>
 * Cmd/Ctrl+K opens it. Click the floating ⌘ button on mobile (no keyboard shortcut).
 * Edit the TOOLS array below any time you add a new page.
 */
(function () {
  "use strict";

  // ---- 1. Your site map. Add a row here whenever you ship a new page. ----
  const TOOLS = [
    // Finance
    { name: "Budget — Full Dashboard", path: "/budget", group: "Finance", keys: "expenses spending charts categories" },
    { name: "FIRE Calculator", path: "/fire", group: "Finance", keys: "retirement vtsax fzrox returns" },
    { name: "Coast FIRE", path: "/coastfire", group: "Finance", keys: "compounding retirement dates" },
    { name: "Debt Payoff", path: "/payoff", group: "Finance", keys: "snowball avalanche debt simulation" },

    // Coin / Whatnot business
    { name: "The HQ", path: "/hq", group: "Coin Business", keys: "command center dashboard everything" },
    { name: "The Vault — Inventory", path: "/inventory", group: "Coin Business", keys: "coins cost basis stock" },
    { name: "Run of Show — Planner", path: "/planner", group: "Coin Business", keys: "stream lineup hammer vault" },
    { name: "Storefront", path: "/shop", group: "Coin Business", keys: "public inventory whatnot" },
    { name: "Stream Stats", path: "/stats", group: "Coin Business", keys: "profit charts trends streams" },
    { name: "Whatnot Profit", path: "/profit", group: "Coin Business", keys: "fees true profit sale" },
    { name: "Melt Calculator", path: "/melt", group: "Coin Business", keys: "junk silver gold copper spot" },
    { name: "Lot Splitter", path: "/lots", group: "Coin Business", keys: "cost basis mixed lots allocate" },
    { name: "Ship It", path: "/ship", group: "Coin Business", keys: "shipping method weight value" },
    { name: "Comp Checker", path: "/comps", group: "Coin Business", keys: "sold comps marketplace search" },
    { name: "Sourcing", path: "/buy", group: "Coin Business", keys: "aliexpress alibaba temu landed cost" },
    { name: "Invoices", path: "/invoice", group: "Coin Business", keys: "numbered synced print pdf" },
    { name: "Label / Tag Printer", path: "/labels", group: "Coin Business", keys: "qr lot print sheet avery" },
    { name: "Silver Spot Calculator", path: "/silver", group: "Coin Business", keys: "junk silver spot price coins" },

    // Mende Marketing
    { name: "The Pipeline — CRM", path: "/crm", group: "Mende Marketing", keys: "leads kanban follow-ups clients" },
    { name: "Lead Gen", path: "/leadgen", group: "Mende Marketing", keys: "local businesses outreach email" },
    { name: "Mende Marketing site", path: "https://mendemarketing.com", group: "Mende Marketing", keys: "agency portfolio pricing" },

    // Training
    { name: "Quiz Engine", path: "/quiz", group: "Training", keys: "deck timed scored leaderboard" },
    { name: "Flashcards", path: "/flashcards", group: "Training", keys: "spaced repetition training" },
    { name: "The Wheel", path: "/spinner", group: "Training", keys: "random picker training room" },
    { name: "Status — Site Health", path: "/status", group: "Training", keys: "uptime functions cron monitor" },

    // Personal / family
    { name: "Chore Quest", path: "/chores", group: "Family", keys: "points allowance girls streak" },
    { name: "Aloha Hub", path: "/aloha", group: "Family", keys: "wedding rsvp hawaii guests" },
    { name: "Wedding Countdown", path: "/countdown", group: "Family", keys: "8 20 2028 budget" },
    { name: "Family Calendar", path: "/calendar", group: "Family", keys: "merged schedule events google" },
    { name: "Estes Avocado Co.", path: "/damin", group: "Family", keys: "scions seeds greenwood placer" },
    { name: "Salone — Sierra Leone", path: "/salone", group: "Family", keys: "peace corps memories stories" },

    // Game room
    { name: "Poker Hands 101", path: "/poker", group: "Game Room", keys: "texas holdem slideshow" },
    { name: "Poker Quiz", path: "/poker-quiz", group: "Game Room", keys: "leaderboard timed challenge" },

    // Utilities / infra
    { name: "QR Generator", path: "/qr", group: "Utilities", keys: "links text wifi" },
    { name: "Image Shrink", path: "/shrink", group: "Utilities", keys: "resize compress photos" },
    { name: "Backup", path: "/backup", group: "Utilities", keys: "download site store" },
    { name: "Directory", path: "/directory", group: "Utilities", keys: "links index sitemap" },
  ];

  // ---- 2. Styles (scoped, self-contained, won't bleed into the page) ----
  const css = `
  .cmdk-fab{position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;
    background:#16140f;border:1px solid #d4af3766;color:#d4af37;font-size:18px;cursor:pointer;
    z-index:9998;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px #0008;
    font-family:'DM Mono',monospace;}
  .cmdk-overlay{position:fixed;inset:0;background:#0a0a09cc;backdrop-filter:blur(3px);
    z-index:9999;display:none;align-items:flex-start;justify-content:center;padding-top:12vh;}
  .cmdk-overlay.open{display:flex;}
  .cmdk-box{width:min(560px,90vw);background:#14130f;border:1px solid #3a3424;border-radius:10px;
    box-shadow:0 20px 60px #000a;overflow:hidden;font-family:'DM Sans',system-ui,sans-serif;}
  .cmdk-input-wrap{display:flex;align-items:center;border-bottom:1px solid #2a261a;padding:14px 16px;gap:10px;}
  .cmdk-input-wrap span{color:#b8723366;font-family:'DM Mono',monospace;font-size:13px;}
  .cmdk-input{flex:1;background:none;border:none;outline:none;color:#ece7de;font-size:15px;
    font-family:'DM Sans',system-ui,sans-serif;}
  .cmdk-input::placeholder{color:#6e6a5c;}
  .cmdk-list{max-height:50vh;overflow-y:auto;padding:6px;}
  .cmdk-group{color:#9aa0a0;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;
    text-transform:uppercase;padding:10px 12px 4px;}
  .cmdk-item{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
    border-radius:6px;cursor:pointer;color:#ece7de;font-size:14px;}
  .cmdk-item:hover,.cmdk-item.active{background:#262017;}
  .cmdk-item .arrow{color:#d4af37;opacity:0;font-family:'DM Mono',monospace;}
  .cmdk-item.active .arrow{opacity:1;}
  .cmdk-empty{padding:24px;text-align:center;color:#6e6a5c;font-size:13px;}
  .cmdk-footer{border-top:1px solid #2a261a;padding:8px 16px;display:flex;gap:14px;
    font-family:'DM Mono',monospace;font-size:11px;color:#6e6a5c;}
  .cmdk-footer kbd{background:#221f17;border:1px solid #3a3424;border-radius:4px;padding:1px 5px;}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- 3. Markup ----
  const overlay = document.createElement("div");
  overlay.className = "cmdk-overlay";
  overlay.innerHTML = `
    <div class="cmdk-box">
      <div class="cmdk-input-wrap"><span>⌘K</span><input class="cmdk-input" placeholder="Jump to a tool…" /></div>
      <div class="cmdk-list"></div>
      <div class="cmdk-footer"><span><kbd>↑↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
    </div>`;
  document.body.appendChild(overlay);

  const fab = document.createElement("button");
  fab.className = "cmdk-fab";
  fab.textContent = "⌘";
  fab.title = "Search tools (Ctrl/Cmd+K)";
  document.body.appendChild(fab);

  const input = overlay.querySelector(".cmdk-input");
  const list = overlay.querySelector(".cmdk-list");
  let activeIndex = 0;
  let filtered = TOOLS;

  function render(q) {
    const query = (q || "").trim().toLowerCase();
    filtered = !query
      ? TOOLS
      : TOOLS.filter((t) =>
          (t.name + " " + t.group + " " + (t.keys || "")).toLowerCase().includes(query)
        );
    activeIndex = 0;
    if (!filtered.length) {
      list.innerHTML = `<div class="cmdk-empty">No tool matches "${escapeHtml(q)}"</div>`;
      return;
    }
    let html = "";
    let lastGroup = null;
    filtered.forEach((t, i) => {
      if (t.group !== lastGroup) {
        html += `<div class="cmdk-group">${t.group}</div>`;
        lastGroup = t.group;
      }
      html += `<div class="cmdk-item${i === 0 ? " active" : ""}" data-i="${i}">
        <span>${t.name}</span><span class="arrow">↵</span></div>`;
    });
    list.innerHTML = html;
  }

  function escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function setActive(i) {
    const items = list.querySelectorAll(".cmdk-item");
    items.forEach((el) => el.classList.remove("active"));
    if (items[i]) {
      items[i].classList.add("active");
      items[i].scrollIntoView({ block: "nearest" });
      activeIndex = i;
    }
  }

  function go(i) {
    const t = filtered[i];
    if (t) window.location.href = t.path;
  }

  function open() {
    overlay.classList.add("open");
    input.value = "";
    render("");
    setTimeout(() => input.focus(), 10);
  }
  function close() {
    overlay.classList.remove("open");
  }

  input.addEventListener("input", () => render(input.value));
  list.addEventListener("click", (e) => {
    const item = e.target.closest(".cmdk-item");
    if (item) go(Number(item.dataset.i));
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  fab.addEventListener("click", open);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "k") {
      e.preventDefault();
      overlay.classList.contains("open") ? close() : open();
      return;
    }
    if (!overlay.classList.contains("open")) return;
    if (k === "escape") close();
    else if (k === "arrowdown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, filtered.length - 1));
    } else if (k === "arrowup") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (k === "enter") {
      e.preventDefault();
      go(activeIndex);
    }
  });
})();
