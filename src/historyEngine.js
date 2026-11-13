// ============================================================
// MY CHEATER STATS: the scan itself, for Chess.com ('cc') and Lichess ('li'). Runs in the background script, so it carries on
// when the popup is closed. Opt-in: nothing is requested until the popup sends 'hist-search' or 'hist-start'.
//   Ranges:  a number of games (g50, recent = 100 by default, g250, g500, medium = 1,000), a period (d7, d30, d90, d365, or today d1, this week wk, this month mo) or full = your whole career.
//   Chess.com: api.chess.com, one or two requests at a time, 429 back-off. Status "closed:fair_play_violations" = banned for cheating.
//   Lichess:   lichess.org/api, ONE request at a time, 429 = wait a minute. Lichess only answers game-export requests that come from
//              its own pages, so the games are downloaded by src/histBridge.js on an open lichess.org tab; opponents are then looked
//              up from here, 300 per request. tosViolation = marked for breaking Lichess rules (mostly engine use), disabled = closed.
// Results stay in this browser (chrome.storage.local). The popup never reads the big saved record: it reads the small
// summary this file writes to the platform's run key.
// ============================================================
const CRS_HISTENG = (() => {
  const H = CRS_HIST, CC = 'https://api.chess.com/pub', LI = 'https://lichess.org/api';
  const FP = 'closed:fair_play_violations', SIZE = { g50: 50, recent: 100, g250: 250, g500: 500, medium: 1000 }, DAYS = { d7: 7, d30: 30, d90: 90, d365: 365 };
  const fresh = (user = '') => ({ user, months: {}, ag: {}, agCur: {}, ags: {}, perf: {}, perfFull: H.perfNew(), perfCur: null, st: {}, nw: {}, rc: [], done: {}, range: null, agTc: {}, agCurTc: {}, tcv: 1 });
  const IDLE = 'Nothing is requested until you press search.';
  const PAUSED = 'Paused. Press play to carry on: nothing already checked is asked for again.';
  const X = {
    cc: { p: 'cc', key: 'crsHist_v2', runKey: 'crsHistRun', S: null, lastWrite: 0, mode: null, prog: { state: 'READY', pct: null, line: IDLE } },
    li: { p: 'li', key: 'crsHistLi_v2', runKey: 'crsHistRunLi', S: null, lastWrite: 0, mode: null, prog: { state: 'READY', pct: null, line: IDLE } },
  };
  let run = null, slowUntil = 0, keep = null, holdUntil = 0, holdN = 0;      // hold: the overlay is scoring a player, so its requests go first
  const waitNote = msg => { if (run) set(run.x, null, undefined, msg); };   // shown on the page so a pause for a rate limit does not look frozen                      // one scan at a time, whichever site

  const sleep = (ms, sig) => new Promise(res => { const t = setTimeout(res, ms); if (sig) sig.addEventListener('abort', () => { clearTimeout(t); res(); }, { once: true }); });
  async function load(x) { if (x.S) return x.S; try { const o = (await chrome.storage.local.get(x.key))[x.key]; x.S = o && o.user ? { ...fresh(), ...o, tcv: o.tcv || 0 } : fresh(); } catch (e) { x.S = fresh(); } return x.S; }
  async function save(x) { try { await chrome.storage.local.set({ [x.key]: x.S }); } catch (e) { x.prog.line = 'Could not save to this browser (storage may be full). Results on screen still count.'; } }

  const addTc = (store, rows) => { for (const r of rows) { const g = H.tcGroup(r.tc); if (g) H.addRows(store[g] || (store[g] = {}), [r]); } return store; };
  // the small record the popup draws from: one summary per range, plus the recently-played list
  function view(x) {
    const S = x.S, fullAg = x.p === 'cc' ? (Object.keys(S.months).length ? H.merge(S.ag, S.agCur) : null) : (S.range ? S.ag : null);
    const sets = { ...S.ags, full: fullAg }, ts = {};
    for (const k in sets) ts[k] = sets[k] ? H.summarize(sets[k], S.st) : null;
    const since = Date.now() / 1000 - 30 * 86400;
    const recOf = rc => { const rec = H.recentCheaterGames(rc, S.st, S.nw); return { recN: rec.length, covered: rc.length, oldest: rc.length ? rc[rc.length - 1].t : 0, inWin: rec.filter(r => r.t >= since).length, rec: rec.slice(0, 8).map(r => ({ u: r.u, t: r.t, r: r.r, g: r.g, n: r.isNew })) }; };
    const tsTc = {}, sumAll = set => { const o = {}; for (const g in set) o[g] = H.summarize(set[g], S.st); return o; };
    if (fullAg && S.tcv) { const m = {}; for (const g of new Set([...Object.keys(S.agTc), ...Object.keys(S.agCurTc)])) m[g] = x.p === 'cc' ? H.merge(S.agTc[g] || {}, S.agCurTc[g] || {}) : S.agTc[g]; tsTc.full = sumAll(m); }
    const recBy = {}; for (const r of S.rc) { const g = H.tcGroup(r.tc); if (g) (recBy[g] || (recBy[g] = [])).push(r); } for (const g in recBy) recBy[g] = recOf(recBy[g]);
    const fullPerf = S.perfFull && S.perfFull.n + (S.perfCur ? S.perfCur.n : 0) ? H.perfMerge(H.perfDone(JSON.parse(JSON.stringify(S.perfFull))), S.perfCur) : null;
    return { perf: { ...S.perf, full: fullPerf }, ts, tsTc, recBy, done: S.done, fullComplete: x.p === 'cc' ? !!S.done.full : !!(S.range && S.range.complete), ...recOf(S.rc) };
  }
  async function write(x, force) {
    if (!x.S) return; const now = Date.now(); if (!force && now - x.lastWrite < 1200) return; x.lastWrite = now;
    try { await chrome.storage.local.set({ [x.runKey]: { p: x.p, user: x.S.user, running: !!(run && run.x === x), busy: !!run, mode: x.mode, tc: x.tc || 'all', state: x.prog.state, pct: x.prog.pct, line: x.prog.line, view: x.S.user ? view(x) : null, at: now } }); } catch (e) {}
  }
  function set(x, state, pct, line) { if (state != null) x.prog.state = state; if (pct !== undefined) x.prog.pct = pct; if (line != null) x.prog.line = line; write(x, false); }
  const writeAll = force => Promise.all([write(X.cc, force), write(X.li, force)]);

  // ── polite fetching ──
  async function getJson(url, sig, init, rateWait) {
    for (let a = 0; a < 6; a++) {
      while (Date.now() < holdUntil && !sig.aborted) await sleep(200, sig);
      if (sig.aborted) return { aborted: true };
      let res;
      try { res = await fetch(url, { ...(init || {}), headers: { Accept: 'application/json', ...((init && init.headers) || {}) }, credentials: 'omit', signal: sig }); }
      catch (e) { if (sig.aborted) return { aborted: true }; await sleep(1500 * (a + 1), sig); continue; }
      if (res.status === 404) return { gone: true };
      if (res.status === 429) { slowUntil = Date.now() + 5 * 60e3; waitNote('The site asked us to slow down. Waiting a moment, then carrying on…'); await sleep(rateWait ? rateWait : 4000 * (a + 1), sig); continue; }
      if (res.status >= 500) { await sleep(2000 * (a + 1), sig); continue; }
      if (!res.ok) return { error: res.status };
      try { return { data: await res.json() }; } catch (e) { return { error: 'json' }; }
    }
    return { error: 'retry' };
  }
  async function pool(items, fn, sig, lanesMax = 2) {      // Chess.com: two at a time (one for five minutes after a refusal), stopping when paused
    let i = 0;
    const lane = async () => { while (i < items.length && !sig.aborted) { const it = items[i++]; await fn(it); if (Date.now() < slowUntil) await sleep(600, sig); } };
    const lanes = [lane()]; if (lanesMax > 1 && Date.now() >= slowUntil) lanes.push(lane());
    await Promise.all(lanes);
  }
  const eta = min => min < 1 ? 'under a minute' : min < 90 ? Math.round(min) + ' min' : (min / 60).toFixed(1) + ' h';
  const fmt = n => Number(n).toLocaleString('en-US');
  const finish = (x, mode, all, errs) => { const cnt = Object.keys(all).length; x.S.done[mode] = Date.now(); return save(x).then(() => set(x, 'FINISHED', 100, !cnt ? 'No rated games in this range.' : `Done · ${fmt(cnt)} opponent${cnt === 1 ? '' : 's'} checked${errs ? ` · ${errs} could not be checked, search again to retry` : ''}`)); };

  // Save a sample (rows newest first). A number of games also fills every smaller number, since those games and opponents are included.
  const keyOf = (mode, tc) => tc && tc !== 'all' ? mode + '|' + tc : mode;       // "recent|rapid" = the last 100 rapid games
  function sample(S, mode, rows, tc) {
    const fill = (k, list) => { const key = keyOf(k, tc); S.ags[key] = H.addRows({}, list); S.perf[key] = H.perfRows(list); };
    if (H.daysOf(mode)) fill(mode, rows); else for (const k in SIZE) if (SIZE[k] <= SIZE[mode]) fill(k, rows.slice(0, SIZE[k]));
    const seen = new Set(rows.map(r => r.k + r.t));
    S.rc = [...rows, ...S.rc.filter(r => !seen.has(r.k + r.t))].sort((a, b) => b.t - a.t).slice(0, 300);
    return S.ags[keyOf(mode, tc)];
  }

  // ── Chess.com ──
  async function scanCC(x, mode, sig) {
    const S = x.S, full = mode === 'full', tc = x.tc || 'all', word = tc === 'all' ? '' : tc + ' ', wanted = r => tc === 'all' || H.tcGroup(r.tc) === tc;
    set(x, 'READING GAMES', 0, 'Getting your list of months…'); await write(x, true);
    const arch = await getJson(`${CC}/player/${encodeURIComponent(S.user)}/games/archives`, sig);
    if (arch.aborted) return paused(x);
    if (arch.gone) return failed(x, `Chess.com has no player called "${S.user}".`);
    if (!arch.data) return failed(x, 'Chess.com did not answer. Try again in a minute.');
    const urls = (arch.data.archives || []).slice().reverse();                 // newest first
    let all;
    if (!full) {
      // a sample: read the newest months one at a time until there are enough games, or the period is covered
      const want = SIZE[mode] || Infinity, cutoff = H.daysOf(mode) ? Date.now() / 1000 - H.daysOf(mode) * 86400 : 0, cutMonth = cutoff ? H.nowMonth(cutoff * 1000) : '';
      let rows = [], n = 0;
      for (const url of urls) {
        if (sig.aborted || (cutoff && H.monthKey(url) < cutMonth)) break;
        const r = await getJson(url, sig); if (r.aborted) break;
        n++; if (r.data) rows.push(...H.gamesOf(S.user, r.data.games).filter(wanted));
        set(x, 'READING GAMES', Math.min(24, want < Infinity ? rows.length / want * 25 : n * 5), `Reading your ${word}games: ${fmt(Math.min(rows.length, want))} so far…`);
        if (rows.length >= want || n >= 120) break;
      }
      if (sig.aborted) return paused(x);
      if (cutoff) rows = rows.filter(r => r.t >= cutoff);
      rows.sort((a, b) => b.t - a.t);
      all = sample(S, mode, want < Infinity ? rows.slice(0, want) : rows, tc);
      set(x, 'CHECKING OPPONENTS', 50, 'Your games are read. Now checking opponents…'); await write(x, true);
    } else {
      const cur = H.nowMonth(); S.agCur = {}; S.agCurTc = {}; S.perfCur = H.perfNew(); if (!Object.keys(S.months).length) S.tcv = 1;
      // the newest few months always (they feed the "recently played" list), plus every month not yet saved and the current one
      const need = urls.filter((u, i) => { const mk = H.monthKey(u); return i < 3 || mk >= cur || !S.months[mk]; });
      let done = 0; const rcByMonth = {};
      await pool(need, async url => {
        const mk = H.monthKey(url), r = await getJson(url, sig); if (r.aborted) return;
        done++; set(x, 'READING GAMES', done / need.length * 25, `Reading your games: month ${done} of ${need.length}…`);
        if (!r.data) return;
        const rows = H.gamesOf(S.user, r.data.games); rcByMonth[mk] = rows;
        if (mk < cur) { if (!S.months[mk]) { H.addRows(S.ag, rows); addTc(S.agTc, rows); for (const r of rows) H.perfAdd(S.perfFull, r); H.perfFlow(S.perfFull, rows); S.months[mk] = 1; } } else { H.addRows(S.agCur, rows); addTc(S.agCurTc, rows); for (const r of rows) H.perfAdd(S.perfCur, r); H.perfFlow(S.perfCur, rows); }
      }, sig);
      if (sig.aborted) { await save(x); return paused(x); }
      const rc = []; for (const mk of Object.keys(rcByMonth).sort().reverse()) for (const r of rcByMonth[mk]) if (rc.length < 300) rc.push(r);
      if (rc.length) S.rc = rc;
      all = H.merge(S.ag, S.agCur);
    }
    const keys = H.toCheck(all, S.st, full ? 14 * 24 : 6), base = full ? 25 : 50;
    let n = 0, errs = 0; const total = keys.length, t0 = Date.now();
    set(x, 'CHECKING OPPONENTS', base, `Checking ${fmt(total)} opponents…`); await write(x, true);
    await pool(keys, async k => {
      const r = await getJson(`${CC}/player/${encodeURIComponent(k)}`, sig); if (r.aborted) return;
      if (r.gone) H.setStatus(S.st, S.nw, k, 'closed'); else if (r.data) H.setStatus(S.st, S.nw, k, r.data.status || 'basic'); else { errs++; return; }
      n++;
      if (n % 10 === 0 || n === total) {
        const rate = n / Math.max((Date.now() - t0) / 60e3, 0.01);
        set(x, 'CHECKING OPPONENTS', base + n / total * (100 - base), `Checked ${fmt(n)} of ${fmt(total)}${n > 40 ? ` · about ${eta((total - n) / rate)} left` : ''}`);
      }
      if (n % 200 === 0) await save(x);
    }, sig);
    await save(x);
    if (sig.aborted) return paused(x);
    await finish(x, mode, all, errs);
  }

  // ── Lichess ──
  const SKIP = new Set(['aborted', 'noStart', 'unknownFinish']);
  function rowLi(user, g) {
    if (!g || !g.rated || (g.variant && g.variant !== 'standard') || SKIP.has(g.status)) return null;
    const w = g.players && g.players.white, b = g.players && g.players.black; if (!w || !b || !w.user || !b.user) return null;     // computer and anonymous opponents have no account
    const me = user.toLowerCase(), mineWhite = w.user.id === me; if (!mineWhite && b.user.id !== me) return null;
    const opp = mineWhite ? b.user : w.user;
    return { k: opp.id, u: opp.name || opp.id, t: Math.floor((g.createdAt || 0) / 1000), r: !g.winner ? 'd' : ((g.winner === 'white') === mineWhite ? 'w' : 'l'), g: g.id || '', c: mineWhite ? 'w' : 'b', rt: (mineWhite ? w : b).rating || 0, or: (mineWhite ? b : w).rating || 0, tc: g.speed || '', op: H.opFamily(g.opening && g.opening.name), hw: H.HOW[g.status] || (g.status === 'timeout' ? 'abandon' : 'other') };
  }
  // The games come from an open lichess.org tab (src/histBridge.js): Lichess does not answer this download when it is asked from here.
  // Result: 'ok' | 'aborted' | 'gone' | 'limited' | 'error' | 'notab' | 'lost' (the tab was closed or changed part-way)
  async function streamViaTab(user, query, sig, onGame, want) {
    let tabs = []; try { tabs = await chrome.tabs.query({ url: ['https://lichess.org/*', 'https://www.lichess.org/*'] }); } catch (e) {}
    if (!tabs.length) return 'notab';
    const path = `/api/games/user/${encodeURIComponent(user)}?${query}${query ? '&' : ''}rated=true&${want || 'moves=false&clocks=false'}&evals=false&opening=true&division=false`;
    return new Promise(resolve => {
      let over = false, port;
      const end = r => { if (over) return; over = true; sig.removeEventListener('abort', onAbort); try { port.disconnect(); } catch (e) {} resolve(r); };
      const onAbort = () => { try { port.postMessage({ type: 'abort' }); } catch (e) {} end('aborted'); };
      try { port = chrome.tabs.connect((tabs.find(t => !t.discarded) || tabs[0]).id, { name: 'crs-hist' }); } catch (e) { return resolve('notab'); }
      sig.addEventListener('abort', onAbort, { once: true });
      port.onMessage.addListener(m => { if (m && m.games) for (const g of m.games) onGame(g); if (m && m.done) end(m.done); });
      port.onDisconnect.addListener(() => end('lost'));
      port.postMessage({ type: 'games', path });
    });
  }
  async function streamGames(user, query, sig, onGame, want) {
    for (let a = 0; a < 3; a++) {
      const r = await streamViaTab(user, query, sig, onGame, want);
      // a 404 from the tab does not prove the player is missing (a tab stuck on a check page answers the same): ask the profile address too
      if (r === 'gone') { const u = await getJson(`${LI}/user/${encodeURIComponent(user)}`, sig); return u.data ? 'tabfail' : 'gone'; }
      if (r !== 'limited') return r;
      waitNote('Lichess asked us to slow down. Waiting a minute, then carrying on…');
      await sleep(61000, sig); if (sig.aborted) return 'aborted';
    }
    return 'error';
  }
  async function scanLI(x, mode, sig) {
    const S = x.S, full = mode === 'full', user = S.user, tc = x.tc || 'all';
    set(x, 'READING GAMES', 0, 'Reading your games from your Lichess tab…'); await write(x, true);
    const bad = r => r === 'ok' ? false
      : r === 'aborted' ? (save(x), paused(x), true)
      : r === 'gone' ? (failed(x, `Lichess has no player called "${user}". Your Lichess name can differ from your Chess.com one.`), true)
      : r === 'tabfail' ? (failed(x, 'Your Lichess tab could not get the game list. Refresh it, check it shows a normal Lichess page, then search again.'), true)
      : r === 'notab' ? (failed(x, 'Open lichess.org in a browser tab (any page), keep it open, then search again. Lichess only gives out game lists to its own pages.'), true)
      : r === 'lost' ? (save(x), set(x, 'PAUSED', null, 'The Lichess tab was closed or changed. Open a Lichess page and search again to carry on.'), true)
      : (failed(x, 'Lichess did not answer. Try again in a minute.'), true);
    let all;
    if (!full) {
      const rows = []; let n = 0, size = SIZE[mode];
      const r = await streamGames(user, (size ? `max=${size}` : `since=${Date.now() - H.daysOf(mode) * 86400e3}`) + (tc === 'all' ? '' : `&perfType=${H.LI_PERF[tc]}`), sig, g => { const row = rowLi(user, g); if (row && (tc === 'all' || H.tcGroup(row.tc) === tc)) rows.push(row); if (++n % 25 === 0) set(x, 'READING GAMES', size ? Math.min(24, n / size * 25) : 25 * (1 - Math.exp(-n / 1000)), `Reading your games: ${fmt(n)} so far…`); });
      if (bad(r)) return;
      all = sample(S, mode, rows, tc);
      set(x, 'CHECKING OPPONENTS', 50, 'Your games are read. Now checking opponents…'); await write(x, true);
    } else {
      const R = S.range || (S.range = { newest: 0, oldest: 0, complete: false }), firstRun = !R.oldest, rcNew = []; let n = 0; if (firstRun) S.tcv = 1;
      if (firstRun) S.rc = rcNew;                      // filled as the newest games arrive, so a pause keeps it
      const flow = [];
      const pass = (query, collect) => streamGames(user, query, sig, g => {
        const ms = g.createdAt || 0; if (ms) { if (ms > R.newest) R.newest = ms; if (!R.oldest || ms < R.oldest) R.oldest = ms; }
        const row = rowLi(user, g); if (row) { H.addRows(S.ag, [row]); addTc(S.agTc, [row]); H.perfAdd(S.perfFull, row); flow.push({ t: row.t, r: row.r, tc: row.tc }); if (collect && rcNew.length < 300) rcNew.push(row); }
        if (++n % 25 === 0) set(x, 'READING GAMES', 25 * (1 - Math.exp(-n / 3000)), `Reading your games: ${fmt(n)} so far…`);
      });
      const newer = async () => { rcNew.length = 0; const r = await pass(`since=${R.newest + 1}`, true); if (bad(r)) return false; if (rcNew.length) S.rc = [...rcNew, ...S.rc].slice(0, 300); return true; };
      if (!R.complete) {
        const r = await pass(R.oldest ? `until=${R.oldest - 1}` : '', firstRun); if (bad(r)) return;
        R.complete = true;
        if (!firstRun && !(await newer())) return;       // a scan that was paused part-way: also pick up games played since
      } else if (!(await newer())) return;
      H.perfFlow(S.perfFull, flow); await save(x); all = S.ag; set(x, 'CHECKING OPPONENTS', 25, 'Your games are read. Now checking opponents…'); await write(x, true);
    }
    const keys = H.toCheck(all, S.st, full ? 14 * 24 : 6);
    let n = 0; const total = keys.length, base = full ? 25 : 50;
    set(x, 'CHECKING OPPONENTS', base, `Checking ${fmt(total)} opponents…`); await write(x, true);
    for (let i = 0; i < keys.length && !sig.aborted; i += 300) {                // 300 per request, one request at a time
      const batch = keys.slice(i, i + 300);
      const r = await getJson(`${LI}/users`, sig, { method: 'POST', body: batch.join(','), headers: { 'Content-Type': 'text/plain' } }, 61000);
      if (r.aborted) break;
      if (!Array.isArray(r.data)) return failed(x, 'Lichess did not answer. Search again to carry on.');
      const found = {}; for (const p of r.data) if (p && p.id) found[p.id] = p;
      for (const k of batch) { const p = found[k]; H.setStatus(S.st, S.nw, k, !p ? 'closed' : p.tosViolation ? FP : (p.disabled || p.closed) ? 'closed' : 'basic'); }
      n += batch.length; set(x, 'CHECKING OPPONENTS', base + n / total * (100 - base), `Checked ${fmt(n)} of ${fmt(total)}${total - n > 600 ? ` · about ${eta((total - n) / 300 * 0.03)} left` : ''}`);
      await save(x); if (i + 300 < keys.length) await sleep(1100, sig);
    }
    await save(x);
    if (sig.aborted) return paused(x);
    await finish(x, mode, all, 0);
  }

  function paused(x) { set(x, 'PAUSED', null, PAUSED); }
  function failed(x, msg) { set(x, 'STOPPED', 0, msg); }

  async function scan(p, mode, tc) {
    const x = X[p]; await load(x); if (run || !x.S.user) return;
    const ctl = new AbortController(), sig = ctl.signal; run = { x, mode, ctl }; x.mode = mode; x.tc = tc || 'all'; x.prog = { state: 'READING GAMES', pct: 0, line: 'Starting…' };
    keep = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) {} }, 20000);
    try { await writeAll(true); await (p === 'li' ? scanLI : scanCC)(x, mode, sig); }
    catch (e) { set(x, 'STOPPED', null, 'Something went wrong: ' + (e && e.message || e)); }
    finally {
      // Stop: unlike Pause it does not leave a part-way career scan to carry on from (opponents already checked stay remembered)
      if (run.stop) {
        if (mode === 'full' && !x.S.done.full) { Object.assign(x.S, { months: {}, ag: {}, agCur: {}, agTc: {}, agCurTc: {}, perfFull: H.perfNew(), perfCur: null, range: null }); await save(x); }
        x.prog = { state: 'STOPPED', pct: null, line: 'Stopped. Search again to start over.' };
      }
      run = null; clearInterval(keep); keep = null; await writeAll(true);
    }
  }
  // Stop on a paused scan: the same as Stop while it runs, without a scan to abort
  async function stopPaused(p) {
    const x = X[p]; await load(x); if (x.prog.state !== 'PAUSED') return;
    if (x.mode === 'full' && !x.S.done.full) { Object.assign(x.S, { months: {}, ag: {}, agCur: {}, agTc: {}, agCurTc: {}, perfFull: H.perfNew(), perfCur: null, range: null }); await save(x); }
    x.prog = { state: 'STOPPED', pct: null, line: 'Stopped. Search again to start over.' }; await write(x, true);
  }
  async function setUser(p, user) {
    const x = X[p]; await load(x); if (run) return false; user = String(user || '').trim();
    if (!(p === 'li' ? /^[A-Za-z0-9_-]{2,30}$/ : /^[A-Za-z0-9_-]{3,25}$/).test(user)) return false;
    if (user.toLowerCase() !== x.S.user.toLowerCase()) x.S = fresh(user); else x.S.user = user;
    x.prog = { state: 'READY', pct: null, line: IDLE }; await save(x); await write(x, true); return true;
  }
  async function clear(p) { const x = X[p]; await load(x); if (run && run.x === x) run.ctl.abort(); const u = x.S.user; x.S = fresh(u); x.prog = { state: 'READY', pct: 0, line: 'Saved results cleared.' }; await save(x); await write(x, true); }
  async function remove(p) { const x = X[p]; await load(x); if (run && run.x === x) run.ctl.abort(); x.S = fresh(''); x.prog = { state: 'READY', pct: null, line: IDLE }; await save(x); try { await chrome.storage.local.remove(x.runKey); } catch (e) {} }

  // start-up: a scan that was running when the background script was stopped is not running any more
  async function init() {
    for (const x of [X.cc, X.li]) {
      await load(x); if (!x.S.user) continue;
      let o = null; try { o = (await chrome.storage.local.get(x.runKey))[x.runKey]; } catch (e) {}
      x.mode = (o && o.mode) || null; x.tc = (o && o.tc) || 'all';
      x.prog = o && o.running ? { state: 'PAUSED', pct: null, line: PAUSED } : { state: 'READY', pct: null, line: IDLE };
      await write(x, true);
    }
  }

  function handle(msg) {
    if (!msg || typeof msg.type !== 'string' || msg.type.slice(0, 5) !== 'hist-') return false;
    const p = msg.p === 'li' ? 'li' : 'cc', mode = msg.mode === 'full' || SIZE[msg.mode] || H.daysOf(msg.mode) ? msg.mode : 'recent', tc = H.LI_PERF[msg.tc] ? msg.tc : 'all';
    if (msg.type === 'hist-user') setUser(p, msg.user);
    else if (msg.type === 'hist-search') setUser(p, msg.user).then(async ok => { if (!ok && msg.user) return; await scan(p, mode, tc); if (X[p].prog.state === 'FINISHED' && typeof CRS_SKENG !== 'undefined') CRS_SKENG.handle({ type: 'sk-start', p, user: X[p].S.user, n: SIZE[mode] || 1000, days: H.daysOf(mode) || 0, tc }); });
    else if (msg.type === 'hist-start') scan(p, mode, tc);
    else if (msg.type === 'hist-pause') { if (run) run.ctl.abort(); }
    else if (msg.type === 'hist-stop') { if (run) { run.stop = true; run.ctl.abort(); } else stopPaused(p); }
    else if (msg.type === 'hist-clear') clear(p);
    else if (msg.type === 'hist-remove') remove(p);
    else if (msg.type === 'hist-init') init();
    else if (msg.type === 'hist-overlay') { holdN = Math.max(0, holdN + (msg.busy ? 1 : -1)); holdUntil = holdN ? Date.now() + 8000 : 0; }   // at most 8 s, in case the page closes mid-lookup
    // hist-ping: answered like every command, so the popup knows this script is the current one
    return true;
  }
  return { handle, init, getJson, streamGames, get running() { return !!run; }, get state() { return X.cc.S; }, get stateLi() { return X.li.S; } };
})();
