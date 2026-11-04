// ============================================================
// REPORT: opens the site's own report window for a player.
// Chess.com: on a game page, clicks the player's name, then ⋯, then Report, so chess.com's
// report window opens over the board (at most about 4 s, so the fallback below can still open a tab: browsers allow that for 5 s after a click). Anywhere else (or if that fails) it opens the
// profile with "#crs-report", and the profile page opens the same window by itself.
// Items are found by chess.com's icon names, not their text, so every site language works.
// Lichess: on a game page, one click asks "Report <player> for cheating?", and on Yes files the report from the player's own
// signed-in Lichess session, with this game attached. Never without that Yes. If anything fails, or there is no game on the page,
// it opens Lichess's own report form with the player, "cheating" and the game link filled in.
// Chess.com: nothing is ever submitted; the site's own report window opens and the player picks and sends.
// ============================================================

const CRS_REPORT_HASH = '#crs-report';

function crsWaitFor(find, ms = 1500) {
  return new Promise(resolve => {
    const t0 = Date.now();
    (function tick() {
      const v = find();
      if (v || Date.now() - t0 > ms) return resolve(v || null);
      setTimeout(tick, 80);
    })();
  });
}

const crsVisibleGlyphButton = glyph => [...document.querySelectorAll(`svg[data-glyph="${glyph}"]`)]
  .map(s => s.closest('button')).find(b => b && b.offsetParent);

async function crsChessComReportInPlace(username) {
  const lower = String(username).toLowerCase();
  // The name element can also hold our own ring and W/L/D chip, so compare only its own text, not its children's.
  const ownText = e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().toLowerCase();
  const name = [...document.querySelectorAll('.cc-user-block-component [role="button"], .cc-user-username-component')]
    .find(e => e.offsetParent && (ownText(e) === lower || e.textContent.trim().toLowerCase() === lower));
  if (!name) return false;
  name.click();
  const more = await crsWaitFor(() => document.querySelector('.user-popover-actions-more button'));
  if (!more) return false;
  more.click();
  const item = await crsWaitFor(() => crsVisibleGlyphButton('circle-fill-exclamation'));
  if (!item) return false;
  item.click();
  return !!(await crsWaitFor(() => document.querySelector('.cc-modal-component')));
}

// The Lichess game id from the page address. A live game's address is 12 characters: the first 8 are the public game id, the last 4 are
// your own seat key (anyone who has it can move for you), so only the first 8 are ever passed on. All-lowercase words such as
// "analysis" and "training" are pages, not games.
function crsLichessGameId(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean);
  const seg = (parts[0] === 'game' ? parts[1] : parts[0]) || '';          // a finished game's address is /game/<id>; a live one is /<id>
  if (!/^[A-Za-z0-9]{8}([A-Za-z0-9]{4})?$/.test(seg) || /^[a-z]+$/.test(seg)) return null;
  return seg.slice(0, 8);
}

// Lichess: its own report form with the player, the reason "cheating" and the game link filled in (a cheating report must have a game link).
// The player can change the reason, add details and press Report themselves.
function crsLichessReportUrl(username, pathname) {
  const id = crsLichessGameId(pathname);
  return `https://lichess.org/report?username=${encodeURIComponent(username)}&reason=cheat` + (id ? `&postUrl=${encodeURIComponent('https://lichess.org/' + id)}` : '');
}

// A small message card at the top of the page: text and buttons, in its own shadow root so the site's styles never touch it.
// It never blocks the page (a live game's clock keeps running), and it goes away on its own.
function crsReportToast(message, buttons, ms) {
  const old = document.getElementById('crs-report-toast'); if (old) old.remove();
  const host = document.createElement('div'); host.id = 'crs-report-toast';
  host.style.cssText = 'position:fixed;z-index:2147483646;left:50%;top:16px;transform:translateX(-50%);max-width:min(420px,calc(100vw - 24px))';
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = '.box{font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;background:oklch(22.5% .017 285);color:oklch(95% .008 285);border-radius:14px;padding:12px 14px;box-shadow:0 10px 32px oklch(6% .02 285/.55),inset 0 0 0 1px oklch(33% .022 285)}'
    + '.row{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}'
    + 'button{font:600 12px/1 inherit;font-family:inherit;padding:8px 14px;border-radius:999px;border:0;cursor:pointer;background:oklch(33% .022 285);color:oklch(95% .008 285)}'
    + 'button:hover{background:oklch(38% .024 285)}button.p{background:oklch(77% .155 14);color:oklch(18% .014 285)}button.p:hover{background:oklch(82% .14 14)}';
  const box = document.createElement('div'); box.className = 'box';
  const msg = document.createElement('div'); msg.textContent = message; box.appendChild(msg);
  const close = () => { clearTimeout(timer); host.remove(); };
  if (buttons.length) {
    const row = document.createElement('div'); row.className = 'row';
    for (const b of buttons) { const el = document.createElement('button'); el.textContent = b.label; if (b.primary) el.className = 'p'; el.addEventListener('click', () => { close(); if (b.onClick) b.onClick(); }); row.appendChild(el); }
    box.appendChild(row);
  }
  root.append(style, box); document.body.appendChild(host);
  const timer = ms ? setTimeout(close, ms) : null;
}

// Files the report with Lichess, as the signed-in player, exactly like its own form does (same address, same fields).
// Returns { state: 'ok' | 'signin' | 'error', message }.
async function crsSubmitLichessReport(username, gameLink) {
  try {
    const res = await fetch('/report', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, reason: 'cheat', text: gameLink }),
    });
    if ((res.redirected && /\/(login|signup)/.test(res.url)) || res.status === 401 || res.status === 403) return { state: 'signin' };
    if (res.status === 429) return { state: 'error', message: 'Lichess says too many reports. Try again later.' };
    if (res.ok) { let j = null; try { j = await res.json(); } catch (e) {} if (!j || j.ok === true || /thanks/.test(res.url || '')) return { state: 'ok' }; }
    let text = 'Lichess refused it (' + res.status + ').';
    try { const j = await res.json(); const m = []; (function walk(v) { if (typeof v === 'string') m.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); })(j); if (m[0]) text = m[0]; } catch (e) {}
    return { state: 'error', message: text };
  } catch (e) { return { state: 'error', message: 'no connection to Lichess.' }; }
}

function crsLichessAutoReport(username, pathname) {
  const id = crsLichessGameId(pathname), formUrl = crsLichessReportUrl(username, pathname);
  const openForm = () => window.open(formUrl, '_blank', 'noopener');
  if (!id) { openForm(); return; }                          // a cheating report needs a game: let the player pick one in Lichess's own form
  const link = 'https://lichess.org/' + id;
  crsReportToast(`Report ${username} for cheating? This game (${id}) is attached. Only report if you really suspect it: the risk score is a signal, not proof.`, [
    { label: 'Report', primary: true, onClick: async () => {
        crsReportToast(`Sending the report for ${username}...`, [], 0);
        const r = await crsSubmitLichessReport(username, link);
        if (r.state === 'ok') crsReportToast(`Reported ${username} to Lichess. Thank you.`, [], 4000);
        else if (r.state === 'signin') crsReportToast('Sign in to Lichess to send reports.', [
          { label: 'Sign in', primary: true, onClick: () => window.open('https://lichess.org/login?referrer=' + encodeURIComponent(formUrl.slice('https://lichess.org'.length)), '_blank', 'noopener') }, { label: 'Close' }], 0);
        else crsReportToast(`It could not be sent: ${r.message}`, [{ label: 'Open the form', primary: true, onClick: openForm }, { label: 'Close' }], 0);
      } },
    { label: 'Cancel' },
  ], 15000);
}

async function crsOpenReport(username, host = location.hostname, pathname = location.pathname) {
  const u = String(username || '').trim();
  if (!u) return;
  if (/(^|\.)lichess\.org$/.test(host)) { crsLichessAutoReport(u, pathname); return; }
  try { if (await crsChessComReportInPlace(u)) return; } catch (e) {}
  window.open(`https://www.chess.com/member/${encodeURIComponent(u)}${CRS_REPORT_HASH}`, '_blank', 'noopener');
}

// Profile opened by the fallback above: ⋯ (More Actions), then Report.
async function crsReportFromProfile() {
  if (location.hash !== CRS_REPORT_HASH || !/^\/member\//i.test(location.pathname)) return;
  history.replaceState(null, '', location.pathname + location.search);   // a reload doesn't reopen it
  // The ⋯ button shows before chess.com has wired it up, so a click can do nothing: try again until the menu opens.
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const more = await crsWaitFor(() => crsVisibleGlyphButton('mark-ellipsis-horizontal'), until - Date.now());
    if (!more) return;
    more.click();
    const item = await crsWaitFor(() => crsVisibleGlyphButton('circle-fill-exclamation'), 1200);
    if (item) { item.click(); return; }
  }
}
