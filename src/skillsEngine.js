// ============================================================
// SKILLS: the background side. Opt-in: nothing runs until the Skills tab sends 'sk-start'. Reads the user's own rated games, hands the moves to
// the engine host on this computer, and saves one small row per game in this browser (chrome.storage.local), so a game is never analysed twice.
//   Chrome: engine in an offscreen page.  Firefox: engine in this background page.
// ============================================================
const CRS_SKENG = (() => {
  const KEY = { cc: 'crsSk_cc', li: 'crsSk_li' }, RUN = 'crsSkRun', MAX_ROWS = 1000, HOST = 'skills-host.html', CC = 'https://api.chess.com/pub', SK = CRS_SK;
  const offscreen = () => typeof chrome.offscreen !== 'undefined';
  let job = null, lastWrite = 0;
  const fmt = n => Number(n).toLocaleString('en-US');
  const status = (s, force) => { const now = Date.now(); if (!force && now - lastWrite < 700) return; lastWrite = now; try { chrome.storage.local.set({ [RUN]: { ...s, at: now } }); } catch (e) {} };
  const progress = (j, state, line, force) => status({ p: j.p, user: j.user, n: j.n, days: j.days, tc: j.tc, state, line, done: j.done, all: j.all, running: state === 'READING' || state === 'ANALYSING' }, force);
  async function load(p, user) { try { const o = (await chrome.storage.local.get(KEY[p]))[KEY[p]]; return o && o.user && o.user.toLowerCase() === user.toLowerCase() && o.depth === SK.DEPTH ? o : { user, depth: SK.DEPTH, rows: {} }; } catch (e) { return { user, depth: SK.DEPTH, rows: {} }; } }
  async function save(j) {
    const ids = Object.keys(j.S.rows); if (ids.length > MAX_ROWS) ids.sort((a, b) => j.S.rows[b].t - j.S.rows[a].t).slice(MAX_ROWS).forEach(i => { delete j.S.rows[i]; });
    try { await chrome.storage.local.set({ [KEY[j.p]]: j.S }); } catch (e) {}
  }

  async function readCC(j) {
    const arch = await CRS_HISTENG.getJson(`${CC}/player/${encodeURIComponent(j.user)}/games/archives`, j.sig);
    if (arch.gone) return `Chess.com has no player called "${j.user}".`; if (!arch.data) return j.sig.aborted ? null : 'Chess.com did not answer. Try again in a minute.';
    const urls = (arch.data.archives || []).slice().reverse(), out = [], cutMonth = j.since ? CRS_HIST.nowMonth(j.since * 1000) : '';
    for (const url of urls.slice(0, 60)) {
      if (j.sig.aborted) return null;
      if (cutMonth && CRS_HIST.monthKey(url) < cutMonth) break;
      const r = await CRS_HISTENG.getJson(url, j.sig); if (r.aborted) return null;
      if (r.data) for (const g of r.data.games || []) { const x = SK.fromChessCom(j.user, g); if (x && (j.tc === 'all' || x.tc === j.tc) && x.t >= j.since) out.push(x); }
      progress(j, 'READING', `Reading your ${j.word}games: ${fmt(Math.min(out.length, j.n))} so far…`);
      if (out.length >= j.n) break;
    }
    j.games = out.sort((a, b) => b.t - a.t).slice(0, j.n); return null;
  }
  async function readLI(j) {
    const out = []; let stale = 0;
    const r = await CRS_HISTENG.streamGames(j.user, `perfType=${CRS_HIST.LI_PERF[j.tc]}&max=${j.n}${j.since ? `&since=${j.since * 1000}` : ''}`, j.sig, g => { if (typeof g.moves !== 'string') stale++; const x = SK.fromLichess(j.user, g); if (x && (j.tc === 'all' || x.tc === j.tc)) out.push(x); progress(j, 'READING', `Reading your ${j.word}games: ${fmt(out.length)} so far…`); }, 'moves=true&clocks=true');
    if (r === 'aborted') return null;
    if (r === 'notab') return 'Open lichess.org in a browser tab (any page), keep it open, then try again. Lichess only gives out game lists to its own pages.';
    if (r === 'gone') return `Lichess has no player called "${j.user}".`;
    if (r !== 'ok') return 'Your Lichess tab could not get the games. Refresh it, then try again.';
    if (stale && !out.length) return 'Refresh your Lichess tab, then try again. It is still running the previous version of this extension.';
    j.games = out.sort((a, b) => b.t - a.t).slice(0, j.n); return null;
  }

  async function openHost() {
    if (!offscreen()) return;
    if (await chrome.offscreen.hasDocument()) return;
    await new Promise((res, rej) => { hostReady = res; chrome.offscreen.createDocument({ url: HOST, reasons: ['WORKERS'], justification: 'Runs a chess engine over the games the user asked to analyse' }).catch(rej); setTimeout(rej, 15000, new Error('The engine page did not open.')); });
  }
  let hostReady = null;
  const closeHost = async () => { if (!offscreen()) return; try { if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument(); } catch (e) {} };

  function row(r, id) {
    const j = job; if (!j || j.over) return;
    if (r) j.S.rows[r.id] = r; else j.skipped++;
    j.done++; const left = j.all - j.done, rate = j.done / Math.max((Date.now() - j.t0) / 60e3, 0.01), min = left / rate;
    progress(j, 'ANALYSING', `Analysing game ${fmt(Math.min(j.done + 1, j.all))} of ${fmt(j.all)}${j.done >= 3 && left ? ` · about ${min < 1 ? 'a minute' : Math.ceil(min) + ' min'} left` : ''}`, j.done === j.all);
    if (j.done % 5 === 0) save(j);
  }
  async function end(error) { const j = job; if (j && !j.over) { j.over = true; j.finish(error); } }

  async function start(p, user, n, tc, days) {
    if (job) return;
    if (typeof CRS_HISTENG !== 'undefined' && CRS_HISTENG.running) { status({ p, user, n, tc, state: 'STOPPED', line: 'A search is running. Wait for it to finish, then try again.', running: false }, true); return; }
    const ctl = new AbortController(), j = job = { p, user, n, tc, days, since: days ? Math.floor(Date.now() / 1000) - days * 86400 : 0, word: tc === 'all' ? '' : tc + ' ', ctl, sig: ctl.signal, done: 0, all: 0, skipped: 0, games: [], S: await load(p, user), t0: Date.now(), over: false };
    const keep = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) {} }, 20000);
    try {
      progress(j, 'READING', `Reading your ${j.word}games…`, true);
      const err = await (p === 'li' ? readLI : readCC)(j);
      if (j.sig.aborted) return wrap(j, 'STOPPED', 'Stopped. Finished games are kept.');
      if (err) return wrap(j, 'STOPPED', err);
      if (!j.games.length) return wrap(j, 'FINISHED', `No rated ${j.word}games found.`);
      const todo = j.games.filter(g => !j.S.rows[g.id] || j.S.rows[g.id].x.length < SK.XLEN); j.all = todo.length;
      if (!todo.length) return wrap(j, 'FINISHED', '');
      j.t0 = Date.now(); progress(j, 'ANALYSING', `Starting the engine on ${fmt(todo.length)} game${todo.length === 1 ? '' : 's'}…`, true);
      await openHost();
      if (j.sig.aborted) return wrap(j, 'STOPPED', 'Stopped. Finished games are kept.');
      const workers = SK.engines(self.navigator && navigator.hardwareConcurrency);
      const error = await new Promise(res => {
        j.finish = res;
        if (offscreen()) chrome.runtime.sendMessage({ type: 'skh-run', games: todo, workers }).catch(() => {});
        else CRS_SKHOST.run(todo, workers, row, end);
      });
      if (j.sig.aborted) return wrap(j, 'STOPPED', 'Stopped. Finished games are kept.');
      return wrap(j, error ? 'STOPPED' : 'FINISHED', error ? 'The engine stopped: ' + error : '');
    } catch (e) { return wrap(j, 'STOPPED', 'Something went wrong: ' + (e && e.message || e)); }
    finally { clearInterval(keep); job = null; await closeHost(); }
  }
  async function wrap(j, state, line) { await save(j); progress(j, state, line, true); }
  function stop() {
    const j = job; if (!j) return; j.ctl.abort();
    if (offscreen()) chrome.runtime.sendMessage({ type: 'skh-stop' }).catch(() => {}); else CRS_SKHOST.stop();
    if (j.finish && !j.over) { j.over = true; j.finish(null); }
  }
  async function clear(p) { if (job && job.p === p) stop(); try { await chrome.storage.local.remove([KEY[p], RUN]); } catch (e) {} }
  // start-up: analysis that was running when this script was stopped has ended; its finished games are saved
  async function init() {
    try { const o = (await chrome.storage.local.get(RUN))[RUN]; if (o && o.running) { status({ ...o, running: false, state: 'STOPPED', line: 'Stopped by the browser. Press Search to carry on: finished games are kept.' }, true); await closeHost(); } } catch (e) {}
  }
  function handle(msg) {
    if (!msg || typeof msg.type !== 'string' || msg.type.slice(0, 3) !== 'sk-') return false;
    if (msg.type === 'sk-start') start(msg.p === 'li' ? 'li' : 'cc', String(msg.user || ''), [50, 100, 250, 500, 1000].includes(msg.n) ? msg.n : 100, CRS_HIST.LI_PERF[msg.tc] ? msg.tc : 'all', msg.days > 0 && msg.days <= 366 ? msg.days : 0);
    else if (msg.type === 'sk-stop') stop();
    else if (msg.type === 'sk-clear') clear(msg.p === 'li' ? 'li' : 'cc');
    else if (msg.type === 'sk-row') row(msg.row, msg.id);
    else if (msg.type === 'sk-end') end(msg.error);
    else if (msg.type === 'sk-hostready' && hostReady) { hostReady(); hostReady = null; }
    return true;
  }
  return { handle, init, get running() { return !!job; } };
})();
