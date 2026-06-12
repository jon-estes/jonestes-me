// cloud.js — drop-in cross-device sync for jonestes.me tools.
// How it works: every tool already saves to localStorage. This script
// transparently mirrors those keys to the site's Redis store (via the
// /store Netlify function), and pulls the latest data down on page load.
// No changes to any tool's logic required — just include this script.
//
// Sync policy: cloud wins on page load (latest device to save wins overall).
// Offline-safe: if the network is down, everything still works locally and
// pending changes retry on the next save or page unload.

(function () {
  const ENDPOINT = '/.netlify/functions/store';

  // localStorage key prefixes that get synced site-wide.
  // Add a prefix here when a new tool is born.
  const PREFIXES = [
    'whatnotProfit.',   // profit.html — sales log, fees, stream marker
    'payoff.',          // payoff.html — debts + payment history
    'flashcards.',      // flashcards.html — decks & review schedule
    'meltCalc.',        // melt.html — spot prices & counts
    'lotSplitter.',     // lots.html — current lot
    'wedding.',         // countdown.html — budget
    'coastFire.',       // coastfire.html — inputs
    'shipIt.',          // ship.html — rate table
    'compChecker.',     // comps.html — comp log & recent searches
    'sourcingCompare.', // buy.html — landed-cost table
    'wheel.',           // spinner.html — names
    'poker.',           // poker quiz — leaderboards
    'inventory.',       // inventory.html — coin stock
    'invoice.',         // invoice.html — counter & history
    'alerts.',          // hq.html — silver alert thresholds
    'planner.',         // planner.html — tonight's run of show
    'crm.',             // crm.html — Mende lead pipeline
    'shop.',            // storefront mirror (written by inventory)
    'quiz.',            // quiz engine decks (when edited from Jon's devices)
    'chores.',          // chore quest
    'silver.',          // price history (written server-side, mirrored here)
  ];
  const tracked = (k) => typeof k === 'string' && PREFIXES.some((p) => k.indexOf(p) === 0);

  // ---- outbound: mirror writes to the cloud (debounced) ----
  const _set = localStorage.setItem.bind(localStorage);
  const _remove = localStorage.removeItem.bind(localStorage);
  let pending = {};
  let timer = null;

  function queue(k, v) {
    pending[k] = v; // v === null means delete
    clearTimeout(timer);
    timer = setTimeout(flush, 1200);
  }

  function getPin() { try { return localStorage.getItem('cloud.pin') || ''; } catch { return ''; } }

  async function flush() {
    const updates = pending;
    pending = {};
    if (!Object.keys(updates).length) return;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pin': getPin() },
        body: JSON.stringify({ updates }),
      });
      if (res.status === 401) {
        // site PIN is set but this device doesn't have it yet — ask once
        const pin = prompt('This site is PIN-protected. Enter the site PIN to sync your data:');
        if (pin) {
          _set('cloud.pin', pin);
          const retry = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-pin': pin },
            body: JSON.stringify({ updates }),
          });
          if (!retry.ok) pending = Object.assign({}, updates, pending);
        } else {
          pending = Object.assign({}, updates, pending);
        }
      }
    } catch (e) {
      // network hiccup — re-queue so the next save retries
      pending = Object.assign({}, updates, pending);
    }
  }

  localStorage.setItem = function (k, v) {
    _set(k, v);
    if (tracked(k)) queue(k, String(v));
  };
  localStorage.removeItem = function (k) {
    _remove(k);
    if (tracked(k)) queue(k, null);
  };

  // last-chance flush when leaving the page
  window.addEventListener('pagehide', function () {
    if (Object.keys(pending).length && navigator.sendBeacon) {
      navigator.sendBeacon(
        ENDPOINT,
        new Blob([JSON.stringify({ updates: pending, pin: getPin() })], { type: 'application/json' })
      );
      pending = {};
    }
  });

  // ---- inbound: pull latest on load; refresh once if cloud had newer data ----
  (async function pull() {
    try {
      const res = await fetch(ENDPOINT, { headers: { 'x-pin': getPin() } });
      if (!res.ok) return;
      const data = await res.json();
      let changed = false;
      for (const k in data) {
        if (!tracked(k)) continue;
        if (localStorage.getItem(k) !== data[k]) {
          _set(k, data[k]); // bypass the patched setter — no echo back to cloud
          changed = true;
        }
      }
      if (changed && !sessionStorage.getItem('cloud.reloaded')) {
        sessionStorage.setItem('cloud.reloaded', '1');
        location.reload(); // re-render the page with the synced data
      } else {
        sessionStorage.removeItem('cloud.reloaded');
      }
    } catch (e) {
      /* offline — local data carries the day */
    }
  })();
})();
